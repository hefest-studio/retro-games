/* ПРИИСК · js/campaign.js — движок миссий кампании (без DOM): миссия = объект данных (js/missions/*.js).
   Карта — ASCII-сетка: '#' скала, '~' вода, '=' лёд (проходим, может треснуть), '_' полынья, 'o' медь (300), 'O' богатая медь (500),
   '.' земля, ',' зыбкий грунт (проходим, строить нельзя, здания на нём трещат), '^' провал (яма подземного жара, непроходим);
   любая другая буква/цифра — именованная точка (земля под ней, либо клетка из mission.legend, например { R: 'o' }).
   Зоны: { at:'K', r:6 } — круг вокруг точки; { x, y, w, h } — прямоугольник клеток; { pts: ['1', 'H'] } — все клетки точек с этими
   буквами/цифрами (например, участки грунта, которые провалятся на этапе 1).
   Условия (cond): time, zone, built, builtIn (здания типа в зоне), hp (здоровье тега), units, trained, mined, copper, gone, killed, heroDead, obj, flag, seen, alerted, lostB, lostU,
   all/any/not. Действия: if (when → do / else), say, msg, spawn, group, despawn, tiles, reveal, objective, weather, night, flag, copper, win, lose, wait,
   ai (волновой ИИ скирмиша), allow. spawn.speed — множитель скорости (тяжёлые сани обоза), spawn.hp — своё здоровье, spawn.locked — игрок не командует.
   train — тягач с вагонами (сцепка: вагоны едут по следу тягача). ':' на карте — мост (проходим; tiles может его «взорвать»).
   Сценарный ИИ групп по тегу: hold, patrol, attack (target — точка, prey — охота за юнитами с тегом), convoy (route, halt — стоять,
   пока враг ближе halt клеток; годится и для своей колонны owner:0) (+ реакция на обстрел). tiles после смены карты перестраивает
   пути, шедшие через исчезнувшие клетки (враг ищет обход). Флаги прошлых миссий: def.carry = ['convoy'] (из сохранения кампании),
   стартовые силы с when — только если условие верно на старте. player.repair — ремонт зданий открыт (в скирмише нет).
   Миссии 5–6: def.treaty — договор артелей (здания пулей не берутся, выстрел по ним — в условии hit; ИИ гонки ai:{mode:'race'}
   ставит буры на жилы и шлёт подрывников); def.race = { goal } — счётчик добычи обеих сторон на экране; player.pack — перенос
   зданий (свернуть в фургон / развернуть); def.shaky = { dmg } — здания на зыбком грунте трещат (доля прочности в секунду);
   def.haulCap / def.rigRate — груз рудовоза за ходку и выработка вышки в секунду в этой миссии;
   def.geysers = { id: { at, r, period, warn, dmg, phase, on } } — гейзеры бьют паром по области (с предупреждением);
   действие quake — предупреждение о провале зоны (трещины на карте), tiles в '^' — провал (здания над ямой рушатся);
   spawn.calm — мирные (сами не стреляют, по ним — только по приказу). Условия hit (по кому стреляли), razed (снесённые здания).
   Миссии 7–8: def.teams = [0, 1, 0] — союзник (владелец 2) в команде игрока: не стреляем друг в друга, общий обзор; def.ally.start —
   его стартовые силы; def.paint — цвет владельцев на экране (например, { 1: 3 } — наёмники); действие owner — сменить владельца
   по тегу (союз или вражда после развилки); choice — развилка: игра стоит, пока игрок не выберет (флаг = ключ варианта, вариант
   выполняет свои действия; C.choose); fire / douse — очаги пожара (и погасить сценарно); def.depots и depot — бочки с водой;
   boss — маршрут громады; группа mode 'douse' — водовозы тушат огонь в своей зоне. Условия fires (сколько очагов), doused
   (сколько потушено), owned (здания с тегом у владельца — захват), captured, part (узел громады сломан), bossDone (дошла).
   Прогресс — localStorage 'arcade.priisk.campaign' (через переданное хранилище, с try/catch). Экспорт: PRIISK.campaign. */
(function (root) {
  'use strict';
  var P = root.PRIISK = root.PRIISK || {};
  var L = P.logic;
  var KEY = 'arcade.priisk.campaign';
  P.MISSIONS = P.MISSIONS || [];
  function register(def) { for (var n = 0; n < P.MISSIONS.length; n++) if (P.MISSIONS[n].id === def.id) { P.MISSIONS[n] = def; return def; } P.MISSIONS.push(def); P.MISSIONS.sort(function (a, b) { return a.n - b.n; }); return def; }
  function byId(id) { for (var n = 0; n < P.MISSIONS.length; n++) if (P.MISSIONS[n].id === id) return P.MISSIONS[n]; return null; }

  // ---------- Карта ----------
  var TILE = { '#': L.ROCK, '~': L.WATER, '=': L.ICE, '_': L.OPEN, ':': L.BRIDGE, '.': L.GROUND, 'o': L.GROUND, 'O': L.GROUND, ',': L.SHAKY, '^': L.PIT };
  function parseMap(rows, legend) {
    legend = legend || {};
    var h = rows.length, w = rows[0].length, t = new Uint8Array(w * h), ore = new Uint16Array(w * h), points = Object.create(null);
    for (var j = 0; j < h; j++) {
      if (rows[j].length !== w) throw new Error('карта: строка ' + j + ' длиной ' + rows[j].length + ', ждали ' + w);
      for (var i = 0; i < w; i++) {
        var ch = rows[j][i], k = j * w + i, base = ch;
        if (!(ch in TILE)) { (points[ch] = points[ch] || []).push({ i: i, j: j }); base = legend[ch] || '.'; }
        t[k] = TILE[base] == null ? L.GROUND : TILE[base];
        if (base === 'o') ore[k] = 300; else if (base === 'O') ore[k] = 500;
      }
    }
    return { w: w, h: h, t: t, ore: ore, points: points };
  }
  function pointOf(MS, at) {
    if (at && typeof at === 'object') return { x: at.x, y: at.y };
    var cells = MS.points[at]; if (!cells) throw new Error('нет точки «' + at + '»');
    var x = 0, y = 0; cells.forEach(function (c) { x += c.i + 0.5; y += c.j + 0.5; });
    return { x: x / cells.length, y: y / cells.length };
  }
  function zoneOf(MS, name) { var z = typeof name === 'string' ? MS.def.zones[name] : name; if (!z) throw new Error('нет зоны «' + name + '»'); return z; }
  function ptsSet(MS, z) { if (!z._set) { z._set = Object.create(null); z._cells = []; [].concat(z.pts).forEach(function (k) { (MS.points[k] || []).forEach(function (c) { var key = c.i + ',' + c.j; if (!z._set[key]) { z._set[key] = 1; z._cells.push(c); } }); }); } return z; }
  function inZone(MS, z, x, y) {
    z = zoneOf(MS, z);
    if (z.pts) return !!ptsSet(MS, z)._set[Math.floor(x) + ',' + Math.floor(y)];
    if (z.at != null) { var p = pointOf(MS, z.at); return Math.hypot(x - p.x, y - p.y) <= (z.r || 3); }
    return x >= z.x && x < z.x + z.w && y >= z.y && y < z.y + z.h;
  }
  function zoneCenter(MS, z) { z = zoneOf(MS, z); if (z.pts) { var cs = ptsSet(MS, z)._cells, sx = 0, sy = 0; cs.forEach(function (c) { sx += c.i + 0.5; sy += c.j + 0.5; }); return { x: sx / Math.max(1, cs.length), y: sy / Math.max(1, cs.length) }; } if (z.at != null) return pointOf(MS, z.at); return { x: z.x + z.w / 2, y: z.y + z.h / 2 }; }
  function zoneCells(W, MS, z) {
    z = zoneOf(MS, z); var out = [], x0, y0, x1, y1;
    if (z.pts) return ptsSet(MS, z)._cells.filter(function (c) { return L.inb(W, c.i, c.j); }).map(function (c) { return { i: c.i, j: c.j }; });
    if (z.at != null) { var p = pointOf(MS, z.at), r = z.r || 3; x0 = Math.floor(p.x - r); y0 = Math.floor(p.y - r); x1 = Math.ceil(p.x + r); y1 = Math.ceil(p.y + r); }
    else { x0 = z.x; y0 = z.y; x1 = z.x + z.w - 1; y1 = z.y + z.h - 1; }
    for (var j = y0; j <= y1; j++) for (var i = x0; i <= x1; i++) if (L.inb(W, i, j) && inZone(MS, z, i + 0.5, j + 0.5)) out.push({ i: i, j: j });
    return out;
  }

  // ---------- Мир миссии ----------
  function txt(o, lang) { return o == null ? '' : typeof o === 'string' ? o : (o[lang] || o.ru || ''); }
  function spreadAround(W, x, y, n) {
    var st = L.nearestPassable(W, Math.floor(x), Math.floor(y), 12); if (!st) return [];
    var out = [], seen = Object.create(null), q = [st], DX = [1, 0, -1, 0, 1, -1, -1, 1], DY = [0, 1, 0, -1, 1, 1, -1, -1]; seen[st.j * W.w + st.i] = 1;
    for (var h = 0; h < q.length && out.length < n; h++) {
      var c = q[h]; if (!unitNear(W, c.i + 0.5, c.j + 0.5, 0.6)) out.push(c);
      for (var d = 0; d < 8; d++) { var a = c.i + DX[d], b = c.j + DY[d], k = b * W.w + a; if (L.inb(W, a, b) && !seen[k] && L.passable(W, a, b)) { seen[k] = 1; q.push({ i: a, j: b }); } }
    }
    return out;
  }
  function unitNear(W, x, y, r) { for (var n = 0; n < W.units.length; n++) { var u = W.units[n]; if (Math.hypot(u.x - x, u.y - y) < r) return true; } return false; }

  // opts: { save (данные кампании — герои/ветераны), seed, lang }
  function build(def, opts) {
    opts = opts || {};
    var map = parseMap(def.map, def.legend), W = L.emptyWorld(map.w, map.h, opts.seed || def.seed || 7);
    W.t.set(map.t); W.ore.set(map.ore); W.oreMax = 520;
    var save = opts.save || newSave();
    var MS = W.mission = {
      def: def, id: def.id, points: map.points, objs: [], byObj: Object.create(null), fired: Object.create(null), queue: [], groups: Object.create(null),
      flags: Object.assign({}, def.flags || {}, carried(def, save)), spawned: Object.create(null), killed: Object.create(null), heroDead: Object.create(null), heroes: Object.create(null),
      ui: [], allow: Object.create(null), night: false, nightMul: 1, weather: def.weather ? Object.assign({}, def.weather) : null, storm: 0,
      winAt: -1, reason: null, trigT: 0, aiT: 0, vetsUsed: 0, save: save, razed: Object.create(null), warn: [], geys: Object.create(null), creakT: 0,
      choice: null, doused: Object.create(null), captured: Object.create(null), partsDown: Object.create(null), bossDone: Object.create(null)
    };
    if (def.teams) W.team = def.teams.slice(); if (def.paint) { W.paint = {}; Object.keys(def.paint).forEach(function (k) { W.paint[k] = def.paint[k]; }); }
    Object.keys(def.depots || {}).forEach(function (id) { var dd = def.depots[id], dp = pointOf(MS, dd.at); W.depots.push({ id: id, x: dp.x, y: dp.y, w: dd.w == null ? 400 : dd.w, max: dd.max || dd.w || 400, team: dd.team == null ? null : dd.team }); });
    W.haulCap = def.haulCap || 0; W.rigRate = def.rigRate || 0; W.treaty = !!def.treaty; W.packOn = !!def.player.pack; if (def.plantable) { W.plantable = {}; def.plantable.forEach(function (t) { W.plantable[t] = 1; }); }
    Object.keys(def.geysers || {}).forEach(function (id) { var gd = def.geysers[id]; MS.geys[id] = { id: id, def: gd, on: gd.on !== false, t0: 0, warn: false, burst: -99, n: 0 }; });
    (def.player.build || []).forEach(function (b) { MS.allow[b] = true; });
    (def.player.units || []).forEach(function (u) { MS.allow[u] = true; });
    MS.repair = !!def.player.repair; W.repairOn = MS.repair; // ремонт зданий открыт миссией (в скирмише — нет)
    W.players[0].copper = def.player.copper || 0; W.players[1].copper = (def.enemy && def.enemy.copper) || 0; W.players[2].copper = (def.ally && def.ally.copper) || 0;
    var vets = (save.roster && save.roster.vets || []).slice();
    function spawnList(list, owner0) {
      (list || []).forEach(function (s) {
        if (s.when && !cond(W, s.when)) return; // стартовые силы по флагам прошлых миссий (например, обоз из миссии 2)
        var owner = s.owner == null ? owner0 : s.owner;
        if (s.type === 'train') { makeTrain(W, MS, Object.assign({ owner: owner }, s)); return; }
        if (L.BLDS[s.type]) { var c = MS.points[s.at][0]; var b = L.addBuilding(W, owner, s.type, c.i, c.j, s.noFree); if (s.tag) b.tag = s.tag; if (s.hpFrac) b.hp = Math.round(b.maxHp * s.hpFrac); if (s.stock != null) b.stock = s.stock; return; }
        var p = pointOf(MS, s.at), tiles = spreadAround(W, p.x, p.y, s.n || 1);
        tiles.forEach(function (tl) {
          var u = L.addUnit(W, owner, s.type, tl.i + 0.5, tl.j + 0.5); u.post = { x: u.x, y: u.y };
          if (s.tag) { u.tag = s.tag; MS.spawned[s.tag] = (MS.spawned[s.tag] || 0) + 1; }
          if (L.HEROES[s.type] && owner === 0) { MS.heroes[s.type] = u.id; var hs = save.roster && save.roster.heroes && save.roster.heroes[s.type]; if (hs && hs.wounded) { u.hp = Math.round(u.maxHp * 0.6); u.wounded = true; } }
          if (s.vets && owner === 0) { var k = vets.findIndex(function (v) { return v.type === s.type; }); if (k >= 0) { var v = vets.splice(k, 1)[0]; u.vet = v.vet || 1; u.kills = v.kills || 3; MS.vetsUsed++; } }
          if (s.heading != null) u.heading = u.aim = s.heading;
          if (s.locked) u.locked = true; if (s.speed) u.sm = s.speed; if (s.hp) u.hp = u.maxHp = s.hp; if (s.calm) u.calm = true;
        });
      });
    }
    spawnList(def.player.start, 0);
    spawnList(def.enemy && def.enemy.start, 1);
    spawnList(def.ally && def.ally.start, 2);
    MS.vetsLeft = vets; // невостребованные в этой миссии ветераны остаются в запасе
    Object.keys(def.groups || {}).forEach(function (tag) { setGroup(W, MS, Object.assign({ tag: tag }, def.groups[tag])); });
    (def.objectives || []).forEach(function (o) { var st = { id: o.id, def: o, state: (o.after || o.hidden) ? 'hidden' : 'active', t: 0 }; MS.objs.push(st); MS.byObj[o.id] = st; });
    if (def.night) { MS.night = true; MS.nightMul = def.night; }
    W.seedKey = 'mission:' + def.id; W.ground = def.ground || 'tundra';
    applyWeather(W, MS);
    L.calcPower(W); L.updateVis(W);
    return W;
  }
  // флаги прошлых миссий: def.carry = ['convoy'] — взять из сохранения кампании (если есть), иначе остаётся def.flags
  function carried(def, save) { var out = {}; (def.carry || []).forEach(function (k) { if (save && save.flags && save.flags[k] != null) out[k] = save.flags[k]; }); return out; }
  // Поезд: тягач в точке at + wagons вагонов позади (против heading), след тягача заранее проложен по ним.
  // o: { owner, at, tag, wagons, heading, speed, locked, hp, wagonHp }
  function makeTrain(W, MS, o) {
    var p = pointOf(MS, o.at), hd = o.heading || 0, dx = Math.cos(hd), dy = Math.sin(hd), own = o.owner == null ? 0 : o.owner;
    var head = L.addUnit(W, own, 'tractor', p.x, p.y), prev = head; head.heading = head.aim = hd; head.trail = [];
    for (var s = 0.2; s <= ((o.wagons || 0) + 1) * 1.15 + 0.5; s += 0.2) head.trail.push({ x: p.x - dx * s, y: p.y - dy * s });
    var all = [head];
    for (var n = 1; n <= (o.wagons || 0); n++) { var w = L.addUnit(W, own, 'wagon', p.x - dx * n * 1.15, p.y - dy * n * 1.15); w.tow = prev.id; w.heading = w.aim = hd; if (o.wagonHp) w.hp = w.maxHp = o.wagonHp; all.push(w); prev = w; }
    all.forEach(function (u) { u.post = { x: u.x, y: u.y }; if (o.tag) { u.tag = o.tag; MS.spawned[o.tag] = (MS.spawned[o.tag] || 0) + 1; } if (o.locked) u.locked = true; if (o.speed) u.sm = o.speed; });
    if (o.hp) head.hp = head.maxHp = o.hp;
    return head;
  }
  function setGroup(W, MS, g) { var old = MS.groups[g.tag] || {}; MS.groups[g.tag] = Object.assign({ owner: 1, mode: 'hold', ri: 0, alerted: old.alerted || false }, g); }

  // ---------- Условия ----------
  function matchWho(MS, u, who, type) {
    if (type && u.type !== type) return false;
    if (!who || who === 'any') return true;
    return u.type === who || u.tag === who;
  }
  function cond(W, c) {
    var MS = W.mission, pl = W.players[0], o = c.owner == null ? 0 : c.owner, n;
    switch (c.t) {
      case 'time': return W.time >= (c.gte || 0) && (c.lte == null || W.time <= c.lte);
      case 'zone': {
        var inside = 0, total = 0;
        for (n = 0; n < W.units.length; n++) { var u = W.units[n]; if (u.owner !== o || !matchWho(MS, u, c.who, c.type)) continue; total++; if (inZone(MS, c.zone, u.x, u.y)) inside++; }
        return c.all ? total > 0 && inside === total : inside >= (c.n || 1);
      }
      case 'built': return W.blds.filter(function (b) { return b.owner === o && b.type === c.type; }).length >= (c.n || 1);
      case 'units': return W.units.filter(function (u) { return u.owner === o && (!c.type || u.type === c.type); }).length >= (c.n || 1);
      case 'hp': { // здоровье юнита/здания с тегом: доля от максимума ≥ gte (или ≤ lte)
        var he = W.blds.concat(W.units).filter(function (e) { return e.tag === c.tag; })[0]; if (!he) return false;
        var fr = he.hp / he.maxHp; return (c.gte == null || fr >= c.gte - 1e-6) && (c.lte == null || fr <= c.lte);
      }
      case 'builtIn': { var tl = c.type == null ? null : [].concat(c.type); return W.blds.filter(function (b) { var bc = L.center(b); return b.owner === o && (!tl || tl.indexOf(b.type) >= 0) && inZone(MS, c.zone, bc.x, bc.y); }).length >= (c.n || 1); }
      case 'trained': return (W.players[o].trained[c.type] || 0) >= (c.n || 1);
      case 'mined': return W.players[o].mined >= c.gte;
      case 'copper': return W.players[o].copper >= c.gte;
      case 'gone': return (MS.spawned[c.tag] || 0) > 0 && !W.units.some(function (u) { return u.tag === c.tag && (!c.type || u.type === c.type); });
      case 'killed': return (MS.killed[c.tag + (c.type ? ':' + c.type : '')] || 0) >= (c.gte || 1);
      case 'heroDead': return !!MS.heroDead[c.hero];
      case 'hit': return (W.hits[(c.by == null ? 0 : c.by) + ':' + c.tag] || 0) >= (c.gte || 1); // по тегу стрелял владелец by
      case 'razed': return (MS.razed[o + ':' + (c.type || '*')] || 0) >= (c.gte || 1);      // снесено зданий владельца owner
      case 'obj': { var ob = MS.byObj[c.id]; return !!ob && ob.state === (c.state || 'done'); }
      case 'flag': return c.value == null ? !!MS.flags[c.key] : MS.flags[c.key] === c.value;
      case 'seen': { var zc = zoneCenter(MS, c.zone), i = Math.floor(zc.x), j = Math.floor(zc.y); return W.vis[j * W.w + i] === 2; }
      case 'alerted': return !!(MS.groups[c.group] && MS.groups[c.group].alerted);
      case 'fires': { var nf = W.fires.filter(function (f) { return f.hp > 0 && (!c.tag || [].concat(c.tag).indexOf(f.tag) >= 0) && (!c.zone || inZone(MS, c.zone, f.x, f.y)); }).length; return (c.lte == null || nf <= c.lte) && (c.gte == null || nf >= c.gte); }
      case 'doused': return (MS.doused[c.tag || '*'] || 0) >= (c.gte || 1);
      case 'owned': return W.blds.filter(function (b) { return b.owner === o && (b.tag === c.tag || b.tag0 === c.tag) && (!c.type || b.type === c.type); }).length >= (c.n || 1);
      case 'captured': return (MS.captured[(c.type || '*')] || 0) >= (c.gte || 1);
      case 'part': return !!MS.partsDown[(c.tag || '*') + ':' + c.k];
      case 'bossDone': return !!MS.bossDone[c.tag || '*'];
      case 'lostB': return pl.lostB <= (c.lte || 0);
      case 'lostU': return pl.lost - pl.lostB <= (c.lte || 0);
      case 'all': return c.of.every(function (x) { return cond(W, x); });
      case 'any': return c.of.some(function (x) { return cond(W, x); });
      case 'not': return !cond(W, c.of);
    }
    throw new Error('неизвестное условие ' + c.t);
  }

  // ---------- Действия ----------
  var TCH = { '#': L.ROCK, '~': L.WATER, '=': L.ICE, '_': L.OPEN, ':': L.BRIDGE, '.': L.GROUND, ',': L.SHAKY, '^': L.PIT };
  function run(W, list, from) {
    var MS = W.mission;
    for (var n = from || 0; n < list.length; n++) {
      var a = list[n];
      if (a.a === 'wait') { MS.queue.push({ at: W.time + a.s, list: list, from: n + 1 }); return; }
      if (a.a === 'if') { run(W, (cond(W, a.when) ? a.do : a.else) || []); continue; } // ветка по условию (со своими wait)
      act(W, a);
    }
  }
  function act(W, a) {
    var MS = W.mission;
    switch (a.a) {
      case 'say': MS.ui.push({ t: 'say', who: a.who, text: a.text, life: a.life || 5.5 }); break;
      case 'msg': MS.ui.push({ t: 'msg', text: a.text, col: a.col }); break;
      case 'spawn': {
        var p = pointOf(MS, a.at), tiles = spreadAround(W, p.x, p.y, a.n || 1), o = a.owner == null ? 1 : a.owner;
        tiles.forEach(function (tl) { var u = L.addUnit(W, o, a.type, tl.i + 0.5, tl.j + 0.5); u.post = { x: u.x, y: u.y }; if (a.tag) { u.tag = a.tag; MS.spawned[a.tag] = (MS.spawned[a.tag] || 0) + 1; } if (a.heading != null) u.heading = u.aim = a.heading; if (a.speed) u.sm = a.speed; if (a.hp) u.hp = u.maxHp = a.hp; if (a.locked) u.locked = true; if (a.calm) u.calm = true; });
        break;
      }
      case 'train': makeTrain(W, MS, a); break;
      case 'group': setGroup(W, MS, Object.assign({}, a, { a: undefined })); break;
      case 'despawn': W.units = W.units.filter(function (u) { if (u.tag === a.tag && (!a.type || u.type === a.type)) { delete W.byId[u.id]; return false; } return true; }); break;
      case 'tiles': {
        var to = TCH[a.to], from = a.from != null ? TCH[a.from] : null;
        zoneCells(W, MS, a.zone).forEach(function (c) { var k = c.j * W.w + c.i; if (from == null || W.t[k] === from) { W.t[k] = to; if (!L.walkable(to)) W.ore[k] = 0; } });
        // здание над исчезнувшей твердью (провал) рушится
        W.blds.forEach(function (b) { for (var j = 0; j < b.h; j++) for (var i = 0; i < b.w; i++) if (!L.walkable(W.t[(b.ty + j) * W.w + b.tx + i]) && W.t[(b.ty + j) * W.w + b.tx + i] !== L.GROUND) { b.hp = 0; b.fell = true; } });
        // кто стоял на треснувшем — выбирается на ближайшую твёрдую клетку
        W.units.forEach(function (u) { var i = Math.floor(u.x), j = Math.floor(u.y); if (!L.walkable(W.t[j * W.w + i])) { var np = L.nearestPassable(W, i, j, 8); if (np) { u.x = np.i + 0.5; u.y = np.j + 0.5; } u.path = []; if (u.order.t === 'move' || u.order.t === 'amove') u.order = { t: 'idle' }; } });
        W.mapRev++; W.seedKey = 'mission:' + MS.id + ':' + W.mapRev;
        L.repathBlocked(W); // у кого путь шёл через исчезнувшую клетку — ищут обход
        break;
      }
      case 'reveal': { var rp = pointOf(MS, a.at); W.flares.push({ x: rp.x, y: rp.y, r: a.r || 5, t: a.s || 8, max: a.s || 8, owner: 0 }); W.visT = 0; break; }
      case 'objective': setObj(W, MS, a.id, a.state || 'active'); break;
      case 'weather': MS.weather = a.kind ? Object.assign({}, a) : null; applyWeather(W, MS); break;
      case 'night': MS.night = a.on !== false; MS.nightMul = a.mul || 0.65; applyWeather(W, MS); MS.ui.push({ t: 'night', on: MS.night }); break;
      case 'flag': MS.flags[a.key] = a.value == null ? true : a.value; break;
      case 'copper': W.players[a.owner || 0].copper += a.n; break;
      case 'win': if (W.winner < 0) MS.winAt = W.time + (a.delay == null ? 1.5 : a.delay); break;
      case 'lose': if (W.winner < 0) { MS.reason = a.reason || null; W.winner = 1; } break;
      case 'quake': { var qc = zoneCells(W, MS, a.zone).map(function (c) { return c.j * W.w + c.i; }); MS.warn.push({ cells: qc, t: a.s || 15, max: a.s || 15, zone: a.zone }); MS.ui.push({ t: 'quake', zone: a.zone }); break; }
      case 'geyser': { // включить/выключить гейзер; burst — сразу предупреждение и выброс через warn секунд (сценарный удар)
        (a.id === '*' ? Object.keys(MS.geys) : [].concat(a.id)).forEach(function (id) { var gz = MS.geys[id]; if (!gz) return; gz.on = a.on !== false; var gd = gz.def; gz.t0 = a.burst ? W.time + (gd.phase || 0) - ((gd.period || 30) - (gd.warn || 3)) + 0.05 : W.time; gz.prev = null; }); break; }
      case 'ai': if (a.mode === 'race') { var ra = Object.assign({}, a); ra.spots = (a.spots || []).map(function (k) { return pointOf(MS, k); }); W.ai = L.newRaceAI(W, a.owner == null ? 1 : a.owner, ra); break; }
        if (a.mode === 'waves') { W.ai = L.newAI(W, a.owner == null ? 1 : a.owner); if (a.first) W.ai.nextWave = W.time + a.first; } else W.ai = null; break;
      case 'owner': { // сменить владельца всем юнитам и зданиям с тегом (союз / вражда после развилки)
        var to = a.to; W.units.concat(W.blds).forEach(function (e) { if (e.tag === a.tag && (!a.type || e.type === a.type)) { L.setOwner(W, e, to); if (a.calm != null && e.kind === 'unit') e.calm = !!a.calm; } });
        if (MS.groups[a.tag]) MS.groups[a.tag].owner = to; break; }
      case 'paint': W.paint = W.paint || {}; W.paint[a.owner] = a.to; W.units.concat(W.blds).forEach(function (e) { if (e.owner === a.owner) e.pi = a.to; }); break;
      case 'fire': { var fp = pointOf(MS, a.at); var area = a.area ? Object.assign({ r: 3 }, pointOf(MS, a.area.at || a.at), { r: a.area.r || 3 }) : null;
        L.addFire(W, fp.x + (a.dx || 0), fp.y + (a.dy || 0), { r: a.r, max: a.max, hp: a.hp, grow: a.grow, dps: a.dps, bdps: a.bdps, tag: a.tag, spread: a.spread, area: area, cap: a.cap }); break; }
      case 'douse': W.fires.forEach(function (f) { if (!a.tag || f.tag === a.tag) f.hp = 0; }); break;
      case 'depot': W.depots.forEach(function (dp) { if (dp.id === a.id) { if (a.w != null) dp.w = a.w; if (a.team !== undefined) dp.team = a.team; } }); break;
      case 'boss': { var rt = (a.route || []).map(function (k) { return pointOf(MS, k); }); W.units.forEach(function (u) { if (u.tag === a.tag && u.bs) { u.bs.route = rt; u.bs.ri = 0; u.bs.done = false; u.path = []; } }); break; }
      case 'choice': MS.choice = { id: a.id, key: a.key || a.id, who: a.who || null, title: a.title, text: a.text, options: a.options }; MS.ui.push({ t: 'choice', id: a.id }); break;
      case 'allow': (a.build || []).concat(a.units || []).forEach(function (b) { MS.allow[b] = true; }); if (a.repair) { MS.repair = W.repairOn = true; } if (a.pack) W.packOn = true; break;
      default: throw new Error('неизвестное действие ' + a.a);
    }
  }
  // Развилка: игрок выбрал вариант key — флаг развилки = key, выполняются действия варианта, игра идёт дальше
  function choose(W, key) {
    var MS = W.mission, ch = MS && MS.choice; if (!ch) return false;
    var opt = ch.options.filter(function (o) { return o.key === key; })[0]; if (!opt) return false;
    MS.choice = null; MS.flags[ch.key] = key; MS.ui.push({ t: 'chosen', id: ch.id, key: key });
    run(W, opt.do || []); return true;
  }
  function setObj(W, MS, id, state) {
    var ob = MS.byObj[id]; if (!ob || ob.state === state) return;
    ob.state = state; ob.t = W.time;
    MS.ui.push({ t: 'obj', id: id, state: state });
    if (state === 'done') MS.objs.forEach(function (x) { if (x.def.after === id && x.state === 'hidden') { x.state = 'active'; x.t = W.time; MS.ui.push({ t: 'obj', id: x.id, state: 'active' }); } });
    if (state === 'failed' && ob.def.kind !== 'opt') { MS.reason = ob.def.failText || null; W.winner = 1; }
  }

  // ---------- Погода и ночь ----------
  function applyWeather(W, MS) {
    var m = 1, wt = MS.weather;
    if (wt && wt.kind === 'snowstorm') { var ph = 0.5 + 0.5 * Math.cos(2 * Math.PI * W.time / (wt.period || 40)); m = wt.min + (wt.max - wt.min) * ph; }
    MS.storm = wt ? 1 - (m - wt.min) / Math.max(0.01, wt.max - wt.min) : 0;
    if (MS.night) m = Math.min(m, MS.nightMul);
    W.sightMul = m;
  }

  // ---------- Сценарный ИИ групп ----------
  function groupStep(W, MS, g) {
    var mem = W.units.filter(function (u) { return u.tag === g.tag && u.owner === g.owner; });
    if (!mem.length) return;
    var armed = mem.filter(function (u) { return !!L.UNITS[u.type].weapon && !u.calm; }), foeOf = function (e) { return L.hostile(W, e.owner, g.owner); };
    // реакция: кого-то из группы обстреляли — или (convoy/notice) враг подошёл вплотную
    var hitter = null;
    mem.forEach(function (u) { if (W.time - u.hitT < 2 && L.alive(W.byId[u.hitBy])) hitter = W.byId[u.hitBy]; });
    if (!hitter && g.notice) mem.forEach(function (u) { W.units.forEach(function (e) { if (!hitter && foeOf(e) && !e.calm && e.hp > 0 && Math.hypot(e.x - u.x, e.y - u.y) <= g.notice) hitter = e; }); });
    if (hitter) {
      if (!g.alerted) { g.alerted = true; MS.ui.push({ t: 'alert', tag: g.tag }); }
      var free = armed.filter(function (u) { return u.order.t !== 'attack' && Math.hypot(u.x - hitter.x, u.y - hitter.y) < 14; }).map(function (u) { return u.id; });
      if (free.length) L.commandAttack(W, free, hitter.id);
    }
    var idle = mem.filter(function (u) { return u.order.t === 'idle'; });
    if (g.mode === 'douse') { // водовозы группы тушат огонь в своей зоне (g.zone; без зоны — рядом), остальные держат пост
      var zc = g.zone ? zoneCenter(MS, g.zone) : null, zr = g.zone ? (zoneOf(MS, g.zone).r || 8) : 9;
      idle.forEach(function (u) {
        if (L.UNITS[u.type].water) { var f = L.nearestFire(W, zc ? zc.x : u.x, zc ? zc.y : u.y, zr); if (f) L.commandDouse(W, [u.id], f.id); else if (u.water < L.UNITS[u.type].water && L.waterSource(W, u)) L.commandFill(W, [u.id], L.waterSource(W, u)); else if (u.post && Math.hypot(u.x - u.post.x, u.y - u.post.y) > 2.5) L.commandMove(W, [u.id], u.post.x, u.post.y); }
        else if (u.post && Math.hypot(u.x - u.post.x, u.y - u.post.y) > 2.5) L.commandMove(W, [u.id], u.post.x, u.post.y);
      });
    } else if (g.mode === 'hold') {
      idle.forEach(function (u) { if (u.post && Math.hypot(u.x - u.post.x, u.y - u.post.y) > 2.5) L.commandMove(W, [u.id], u.post.x, u.post.y); });
    } else if (g.mode === 'patrol') {
      var busy = mem.some(function (u) { return u.order.t !== 'idle'; });
      if (!busy && g.route && g.route.length) { g.ri = (g.ri + 1) % g.route.length; var pp = pointOf(MS, g.route[g.ri]); L.commandMove(W, mem.map(function (u) { return u.id; }), pp.x, pp.y, true); }
    } else if (g.mode === 'attack') {
      if (idle.length) {
        var tp = g.target ? pointOf(MS, g.target) : null, near = idle[0], prey = g.prey ? nearestTagged(W, near, foeOf, g.prey) : null;
        var goal = prey || (tp && Math.hypot(near.x - tp.x, near.y - tp.y) > 3 ? tp : nearestFoe(W, near, foeOf));
        if (goal) L.commandMove(W, idle.map(function (u) { return u.id; }), goal.x, goal.y, true);
      }
    } else if (g.mode === 'convoy' && g.route) {
      if (g.ri >= g.route.length) return;
      var movers = mem.filter(function (u) { return u.order.t !== 'attack' && !u.tow; }), wp = pointOf(MS, g.route[g.ri]);
      if (!movers.length) return;
      // halt: враг ближе halt клеток к любому из колонны — колонна стоит (ждёт, пока охрана расчистит путь)
      if (g.halt) { var danger = mem.some(function (u) { return W.units.some(function (e) { return foeOf(e) && !e.calm && e.hp > 0 && Math.hypot(e.x - u.x, e.y - u.y) <= g.halt; }) || (g.fire && W.fires.some(function (f) { return f.hp > 0 && Math.hypot(f.x - u.x, f.y - u.y) <= f.r + g.fire; })); });
        if (danger !== !!g.halted) { g.halted = danger; MS.ui.push({ t: 'halt', tag: g.tag, on: danger }); }
        if (danger) { movers.forEach(function (u) { if (u.order.t === 'move') { u.order = { t: 'idle' }; u.path = []; } }); return; } }
      if (movers.every(function (u) { return Math.hypot(u.x - wp.x, u.y - wp.y) < 3.5; })) { g.ri++; if (g.ri >= g.route.length) return; wp = pointOf(MS, g.route[g.ri]); movers.forEach(function (u) { u.order = { t: 'idle' }; u.path = []; }); }
      var go = movers.filter(function (u) { return u.order.t === 'idle'; }).map(function (u) { return u.id; });
      if (go.length) L.commandMove(W, go, wp.x, wp.y);
    }
  }
  function nearestTagged(W, u, foe, tag) { var best = null, bd = 1e9; W.units.forEach(function (e) { if (foe(e) && e.tag === tag) { var d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = { x: e.x, y: e.y }; } } }); return best; }
  function nearestFoe(W, u, foe) {
    var best = null, bd = 1e9;
    W.units.forEach(function (e) { if (foe(e) && !e.calm) { var d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = { x: e.x, y: e.y }; } } });
    W.blds.forEach(function (b) { if (foe(b)) { var c = L.center(b), d = Math.hypot(c.x - u.x, c.y - u.y); if (d < bd) { bd = d; best = c; } } });
    return best;
  }

  // ---------- Шаг миссии (после L.step) ----------
  function step(W, dt) {
    var MS = W.mission; if (!MS) return;
    // события мира (каждое — один раз; main.js потом очищает W.events)
    W.events.forEach(function (ev) {
      if (ev._m) return; ev._m = 1;
      if (ev.t === 'die' && ev.kind === 'unit') {
        if (ev.tag) { MS.killed[ev.tag] = (MS.killed[ev.tag] || 0) + 1; MS.killed[ev.tag + ':' + ev.type] = (MS.killed[ev.tag + ':' + ev.type] || 0) + 1; }
        if (ev.owner === 0 && L.HEROES[ev.type]) { MS.heroDead[ev.type] = true; MS.ui.push({ t: 'heroDown', who: ev.type }); }
      }
      if (ev.t === 'doused' && ev.by >= 0) { MS.doused[ev.tag || '-'] = (MS.doused[ev.tag || '-'] || 0) + 1; MS.doused['*'] = (MS.doused['*'] || 0) + 1; }
      if (ev.t === 'captured' && ev.owner === 0) { MS.captured[ev.type] = (MS.captured[ev.type] || 0) + 1; MS.captured['*'] = (MS.captured['*'] || 0) + 1; }
      if (ev.t === 'part') { MS.partsDown[(ev.tag || '-') + ':' + ev.k] = true; MS.partsDown['*:' + ev.k] = true; }
      if (ev.t === 'bossArrived') { MS.bossDone[ev.tag || '-'] = true; MS.bossDone['*'] = true; }
      var bt = ev.kind === 'bld' ? ev.type : ev.packed; // здание (или фургон со свёрнутым зданием) снесено
      if (ev.t === 'die' && bt) { MS.razed[ev.owner + ':' + bt] = (MS.razed[ev.owner + ':' + bt] || 0) + 1; MS.razed[ev.owner + ':*'] = (MS.razed[ev.owner + ':*'] || 0) + 1; }
    });
    if (W.winner >= 0) { if (W.winner === 1 && !MS.reason) MS.reason = 'hq'; return; }
    applyWeather(W, MS);
    hazards(W, MS, dt);
    // отложенные действия (wait)
    for (var n = MS.queue.length - 1; n >= 0; n--) { var q = MS.queue[n]; if (W.time >= q.at) { MS.queue.splice(n, 1); run(W, q.list, q.from); } }
    MS.trigT -= dt;
    if (MS.trigT <= 0) {
      MS.trigT = 0.25;
      (MS.def.triggers || []).forEach(function (tr) {
        if (MS.fired[tr.id] && !tr.repeat) return;
        if (MS.fired[tr.id] && W.time - MS.fired[tr.id] < tr.repeat) return;
        if (cond(W, tr.when)) { MS.fired[tr.id] = W.time || 1e-6; run(W, tr.do); }
      });
      MS.objs.forEach(function (ob) {
        if (ob.state !== 'active') return;
        if (ob.def.fail && cond(W, ob.def.fail)) { setObj(W, MS, ob.id, 'failed'); return; }
        if (ob.def.done && cond(W, ob.def.done)) setObj(W, MS, ob.id, 'done');
      });
      (MS.def.lose || []).forEach(function (l) { if (W.winner < 0 && cond(W, l.when)) { MS.reason = l.reason; W.winner = 1; } });
      var mains = MS.objs.filter(function (ob) { return ob.def.kind !== 'opt'; });
      if (MS.winAt < 0 && mains.length && mains.every(function (ob) { return ob.state === 'done'; })) MS.winAt = W.time + 2;
    }
    if (MS.winAt >= 0 && W.time >= MS.winAt && W.winner < 0) { W.winner = 0; MS.result = result(W); }
    MS.aiT -= dt;
    if (MS.aiT <= 0) { MS.aiT = 0.5; Object.keys(MS.groups).forEach(function (k) { groupStep(W, MS, MS.groups[k]); }); }
  }
  function tick(W, dt) { if (W.mission && W.mission.choice) return; L.step(W, dt); step(W, dt); } // развилка — мир стоит, пока игрок выбирает

  // ---------- Подземный жар: гейзеры, зыбкий грунт, предупреждения о провалах ----------
  // Гейзер: период period с, за warn с до выброса — предупреждение (w.warn), выброс — урон dmg всем юнитам в радиусе r
  // (технике ×0.6, зданиям ×0.25 от dmg·4). Зыбкий грунт: здание, стоящее хоть одной клеткой на ',', теряет def.shaky.dmg
  // своей прочности в секунду (трещит).
  function hazards(W, MS, dt) {
    Object.keys(MS.geys).forEach(function (id) {
      var gz = MS.geys[id], gd = gz.def; if (!gz.on) { gz.warn = false; return; }
      var per = gd.period || 30, tt = W.time - gz.t0 + (gd.phase || 0), cyc = ((tt % per) + per) % per, warnS = gd.warn || 3;
      var wasWarn = gz.warn; gz.warn = cyc >= per - warnS;
      if (!wasWarn && gz.warn) MS.ui.push({ t: 'geyserWarn', id: id });
      if (gz.prev != null && cyc < gz.prev) { // выброс
        gz.burst = W.time; gz.n++; var p = pointOf(MS, gd.at), r = gd.r || 2.2, dmg = gd.dmg || 30;
        W.units.forEach(function (u) { if (!u.parts && Math.hypot(u.x - p.x, u.y - p.y) <= r) { u.hp -= dmg * (L.UNITS[u.type].cls === 'veh' ? 0.6 : 1); u.hitT = W.time; u.steamT = W.time; } });
        W.blds.forEach(function (b) { var c = L.center(b); if (Math.hypot(c.x - p.x, c.y - p.y) <= r + Math.max(b.w, b.h) / 2) b.hp -= dmg; });
        W.events.push({ t: 'geyser', id: id, x: p.x, y: p.y });
      }
      gz.prev = cyc;
    });
    if (MS.def.shaky) {
      var creak = null;
      W.blds.forEach(function (b) {
        var on = false; for (var j = 0; j < b.h && !on; j++) for (var i = 0; i < b.w; i++) if (W.t[(b.ty + j) * W.w + b.tx + i] === L.SHAKY) { on = true; break; }
        b.shaky = on; if (!on) return;
        b.hp -= b.maxHp * MS.def.shaky.dmg * dt; if (b.owner === 0 && !creak) creak = b;
      });
      MS.creakT -= dt; if (creak && MS.creakT <= 0) { MS.creakT = 25; MS.ui.push({ t: 'creak', type: creak.type }); }
    }
    for (var n = MS.warn.length - 1; n >= 0; n--) { MS.warn[n].t -= dt; if (MS.warn[n].t <= 0) MS.warn.splice(n, 1); }
  }

  // ---------- Итог ----------
  function result(W) {
    var MS = W.mission, pl = W.players[0], win = W.winner === 0;
    var stars = [win].concat((MS.def.stars || []).map(function (s) { return win && cond(W, s.when); }));
    var vets = W.units.filter(function (u) { return u.owner === 0 && u.vet && !L.HEROES[u.type]; }).map(function (u) { return { type: u.type, vet: u.vet, kills: u.kills || 0 }; });
    var heroes = {}; Object.keys(MS.heroes).forEach(function (h) { heroes[h] = { alive: !MS.heroDead[h] }; });
    return { id: MS.id, win: win, reason: MS.reason, time: W.time, stars: stars, lostU: pl.lost - pl.lostB, lostB: pl.lostB, kills: pl.kills,
      flags: Object.assign({}, MS.flags), vets: vets.concat(MS.vetsLeft || []), heroes: heroes, newVets: vets.length };
  }

  // ---------- Прогресс кампании ----------
  function newSave() { return { v: 1, unlocked: 1, missions: {}, flags: {}, roster: { heroes: {}, vets: [] } }; }
  function load(store) {
    var s = null;
    try { var raw = store && store.getItem(KEY); if (raw) s = JSON.parse(raw); } catch (e) { s = null; }
    if (!s || typeof s !== 'object' || s.v !== 1) return newSave();
    var d = newSave(); d.unlocked = Math.max(1, s.unlocked | 0); d.missions = s.missions || {}; d.flags = s.flags || {};
    d.roster = { heroes: (s.roster && s.roster.heroes) || {}, vets: (s.roster && Array.isArray(s.roster.vets)) ? s.roster.vets : [] };
    return d;
  }
  function save(store, data) { try { store && store.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; } }
  function reset(store) { try { store && store.removeItem(KEY); } catch (e) {} return newSave(); }
  // Победа: звёзды (лучшие), время, флаги, герои и ветераны → в сохранение; открывается следующая миссия.
  function applyResult(data, res) {
    if (!res.win) return data;
    var m = byId(res.id), old = data.missions[res.id] || { stars: [], time: 0 };
    data.missions[res.id] = { stars: res.stars.map(function (s, i) { return !!(s || old.stars[i]); }), time: old.time ? Math.min(old.time, res.time) : res.time, lostU: res.lostU, lostB: res.lostB };
    Object.keys(res.flags || {}).forEach(function (k) { data.flags[k] = res.flags[k]; });
    Object.keys(res.heroes || {}).forEach(function (h) { data.roster.heroes[h] = { wounded: !res.heroes[h].alive }; });
    data.roster.vets = (res.vets || []).slice(0, 12);
    if (m) data.unlocked = Math.max(data.unlocked, m.n + 1);
    return data;
  }

  P.campaign = { KEY: KEY, register: register, byId: byId, parseMap: parseMap, build: build, step: step, tick: tick, cond: cond, act: act, run: run,
    result: result, newSave: newSave, load: load, save: save, reset: reset, applyResult: applyResult, pointOf: pointOf, inZone: inZone, zoneCenter: zoneCenter,
    zoneCells: zoneCells, txt: txt, makeTrain: makeTrain, hazards: hazards, choose: choose, allowed: function (W, type) { return !W.mission || !!W.mission.allow[type]; } };
})(typeof window !== 'undefined' ? window : globalThis);
