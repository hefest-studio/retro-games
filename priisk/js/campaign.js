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
   Сценарный ИИ групп по тегу: hold, patrol, attack (target — точка, prey — охота за юнитами с тегом), capture (инженеры занимают
   чужие здания с тегами g.tags, охрана идёт с ними), convoy (route, halt — стоять,
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
   по тегу (союз или вражда после развилки; развилка — действием игрока: обычные триггеры zone / captured / hit ставят флаг);
   fire / douse — очаги пожара (и погасить сценарно); def.depots и depot — бочки с водой / кучи песка; def.sand — рудовозы
   тоже тушат (груз песка); boss — маршрут и настройка громады ({ tag, route, cfg }); гейзер под громадой обваривает её узлы
   (gd.boss — урон узлу, gd.stun — на сколько секунд встанет); группа mode 'douse' — водовозы тушат огонь в своей зоне.
   Условия fires (сколько очагов), doused (сколько потушено), owned (здания с тегом у владельца — захват), captured, part
   (узел громады сломан), parts (сколько узлов сломано), since (секунд после выполнения цели), bossDone (дошла до конца маршрута), scalded (громаду обварило гейзером).
   Миссии 9–10: def.lifts = { id: { a, b, cap, ride, wait, at, on, label } } — клети шахты (переход между ярусами карты: юниты с
   приказом «ехать» ждут на площадке, едут частями по cap; действие lift включает/выключает); def.lamps = { id: { at, r, on } } —
   фонари (свой юнит рядом зажигает — обзор вокруг фонаря остаётся навсегда; темнота — def.night; def.rest = { hp, r, calm } —
   привал: пехота у зажжённого фонаря вне боя перевязывается); def.los — прямая видимость: сквозь породу не видно и не стреляют; def.sites = { id: { at, r, who,
   time, on, done, label } } — места работ (закладка заряда, подрывная машинка: юнит типа who стоит на месте time секунд; действие
   site включает/отмечает сделанным); действие teams — сменить команды владельцев (третья сторона); tiles.dmg — урон тем, кого
   накрыл обвал; группа mode 'escort' — идёт за героем/тегом (g.follow), сама ездит клетями; def.finale — данные экрана финала
   кампании (рисует campaign-ui). Условия site, sites (сколько сделано), lit (сколько фонарей горит), rode (клеть возила своих),
   liftAt (где стоит клеть), pumped (сколько выкачали вышки игрока в зоне из def.pumped).
   Кампания Сизого Перевала («Долг перевала»): миссия с def.camp = 'sizye' регистрируется в P.MISSIONS_S (P.MISSIONS — только
   Медный Ключ, как раньше); def.side = 'sizye' — игрок за Сизых (ветряки, канатка, своя палитра — L.setSides); def.wind —
   ветер на старте ({ dir, s, lock }), действие wind — сменить ветер; spawn.talk — пост, который Митяй может уговорить
   (условие talked, событие — группа поста больше не реагирует); условие linked — у игрока есть забой с канатом до Станции; paid — сколько меди пришло по канату на станцию с тегом (торговый пост, spawn.mult — во сколько раз дороже);
   действие seize — забрать у владельца юниты типов types (заводчик берёт технику в счёт долга);
   cabled — сколько своих приехало по канату; wind — сила ветра (gte/lte). «Ночная проверка» и «Ветер с перевала» (С4–С5):
   условие scouted (сколько чужих зданий разведано — видели хоть раз; type/tag), def.keepHq — снос чужой конторы не кончает
   миссию победой (разведка, а не разгром), '+' на карте — высота (W.high: ветряк ставится и крутится только там), погода
   buran — буран (метель, в разгар все идут медленнее: slow), weather.fromNow — цикл метели от момента действия, условие storm
   (сила метели 0…1), группа stormy — дозор в метель/ночью замечает ближе (notice × обзор); def.holdFire / действие holdFire —
   свои не открывают огонь сами (только по приказу или в ответ на выстрел); def.campBuild — стройка без конторы (стоянка); def.foeBlind — ночью/в метель
   и соперник сам замечает цель ближе. Связка кампаний: def.xcarry = { copper: ['alliance'] } —
   флаги ЧУЖОЙ кампании (если она пройдена; читаются из её сохранения) попадают во флаги миссии как 'copper.alliance';
   'copper.done' — сколько миссий Медного Ключа пройдено (0, если не играли). Обязательности нет: без сохранения — флагов нет.
   «Горящий рудник» и «Заводчик» (С6–С7): def.ferry = true | { r, cap, gap, speed, walk, home } — автолюльки с людьми (spawn.fare — горняки
   сами идут к ближнему узлу канатки и уезжают на Станцию; сгорела опора впереди — люлька срывается), условие ferried (сколько
   довезли, tag), действие ferry (вкл/выкл); fire.drift — пожар идёт по ветру (новые очаги — с подветренной стороны, ветер
   повернул — повернул и огонь); despawn.zone — убрать только тех, кто дошёл до зоны (наёмники ушли с карты).
   «Канатка над пропастью» и «Последний перевал» (С8–С9): ferry.exposed / armor — пассажирские люльки под обстрелом с земли
   (сбили — люди падают), ferry.sway — ветер раскачивает и тормозит люльки, в порыв (stop) они ждут у опор; действие cut — обрыв
   пролёта: канат на опоре с тегом сорвёт с ролика через warn секунд (люльки через неё не отправляются, едущие — висят), условие
   cut (сейчас оборван), def.ropeFix — Агафья, стоя у опоры, чинит её и сращивает канат (условие spliced — сколько срастила);
   условие routed — от узла с тегом есть канат до Станции (пролёт перестроили в обход рухнувшей опоры);
   действие build — поставить здание сценарием (setup — «вырастает» за секунды). Эпилог «Общий посёлок»: миссия с
   def.camp = 'both' (P.MISSIONS_B, своё сохранение) открывается, когда пройдены финалы ОБЕИХ кампаний и их флаги совпадают с
   def.unlock = { copper: { флаг: значение | [значения] }, sizye: { … } } — C.epilogueState(def, saves); флаги обеих — через
   def.xcarry. def.finale.camps — на экране эпилога ещё и итог звёзд обеих кампаний.
   Прогресс — localStorage 'arcade.priisk.campaign' (Медный Ключ) и 'arcade.priisk.campaign.sizye' (Сизые), через переданное
   хранилище, с try/catch. Экспорт: PRIISK.campaign.
   Общее ядро кампаний — _shared/campaign-core.js (копия js/campaign-core.js, подключается до этого файла): разбор карты, точки и
   зоны, триггеры wait/if/repeat, цели, звёзды, прогресс, перенос флагов (carry/xcarry) и героев, финал по флагам. Здесь — только
   правила ПРИИСКа: легенда карты, условия и действия (словари CONDS/ACTS), события мира, сценарный ИИ групп, погода, жар, клети. */
(function (root) {
  'use strict';
  var P = root.PRIISK = root.PRIISK || {};
  var L = P.logic;
  // Общее ядро кампаний (_shared/campaign-core.js → js/campaign-core.js): карта и точки, зоны, триггеры, цели, звёзды, прогресс,
  // перенос флагов и героев, финал по флагам. Берётся при первом обращении: реестр миссий (register/list/byId) работает и без него.
  var K = root.HefestCampaign || null;
  function core() { if (!K) K = root.HefestCampaign || null; if (!K) throw new Error('ПРИИСК: нет ядра кампаний js/campaign-core.js (копия _shared/campaign-core.js) — подключите его до js/campaign.js'); return K; }
  var KEY = 'arcade.priisk.campaign', KEYS = { copper: KEY, sizye: KEY + '.sizye', both: KEY + '.both' }, CAMPS = ['copper', 'sizye'];
  P.MISSIONS = P.MISSIONS || []; P.MISSIONS_S = P.MISSIONS_S || []; P.MISSIONS_B = P.MISSIONS_B || []; // _B — эпилог обеих кампаний
  function campKey(camp) { return camp === 'sizye' || camp === 'both' ? camp : 'copper'; }
  function campOf(def) { return def && (def.camp === 'sizye' || def.camp === 'both') ? def.camp : 'copper'; }
  function list(camp) { return camp === 'sizye' ? P.MISSIONS_S : camp === 'both' ? P.MISSIONS_B : P.MISSIONS; }
  function register(def) { var ls = list(campOf(def)); for (var n = 0; n < ls.length; n++) if (ls[n].id === def.id) { ls[n] = def; return def; } ls.push(def); ls.sort(function (a, b) { return a.n - b.n; }); return def; }
  function byId(id) { var all = P.MISSIONS.concat(P.MISSIONS_S, P.MISSIONS_B); for (var n = 0; n < all.length; n++) if (all[n].id === id) return all[n]; return null; }

  // ---------- Карта (легенда ПРИИСКа поверх общего разбора) ----------
  var TILE = { '#': L.ROCK, '~': L.WATER, '=': L.ICE, '_': L.OPEN, ':': L.BRIDGE, '.': L.GROUND, 'o': L.GROUND, 'O': L.GROUND, ',': L.SHAKY, '^': L.PIT, '+': L.GROUND };
  function parseMap(rows, legend) {
    var ore = null, high = null, w = rows[0].length;
    ore = new Uint16Array(w * rows.length);
    var m = core().parseMap(rows, { tiles: TILE, legend: legend, unknown: L.GROUND, cell: function (k, i, j, ch, base) {
      if (base === 'o') ore[k] = 300; else if (base === 'O') ore[k] = 500;
      if (base === '+') { high = high || new Uint8Array(ore.length); high[k] = 1; } // '+' — высота (земля на гребне перевала)
    } });
    return { w: m.w, h: m.h, t: m.t, ore: ore, high: high, points: m.points };
  }
  function pointOf(MS, at) { return core().pointOf(MS, at); }
  function inZone(MS, z, x, y) { return core().inZone(MS, z, x, y); }
  function zoneCenter(MS, z) { return core().zoneCenter(MS, z); }
  function zoneOf(MS, z) { return core().zoneOf(MS, z); }
  function zoneCells(W, MS, z) { return core().zoneCells(MS, z, W.w, W.h); }

  // ---------- Мир миссии ----------
  function txt(o, lang) { return core().txt(o, lang); }
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
  // привязка ядра к миру ПРИИСКа: время — W.time, исход — W.winner (0 — игрок, 1 — соперник); старый порядок шага (strict: false)
  function handler(W, MS) {
    return core().handler({ ctx: W, now: function () { return W.time; }, over: function () { return W.winner >= 0; },
      end: function (win) { if (win) { W.winner = 0; MS.result = result(W); } else W.winner = 1; },
      conds: CONDS, acts: ACTS, tick: function () { scoutTick(W, MS); }, sayLife: 5.5, winDelay: 1.5, failReason: null, strict: false });
  }

  // opts: { save (данные кампании — герои/ветераны), seed, lang, xsave }
  function build(def, opts) {
    opts = opts || {};
    var K0 = core(), map = parseMap(def.map, def.legend), W = L.emptyWorld(map.w, map.h, opts.seed || def.seed || 7);
    W.t.set(map.t); W.ore.set(map.ore); W.oreMax = 520; if (map.high) W.high = map.high; // высоты: ветряки крутятся только там
    var save = opts.save || newSave();
    var MS = W.mission = K0.create(def, Object.assign({}, K0.carried(def, save), xcarried(def, opts.xsave)), { objectives: false }); // цели — после стартовых сил (как до ядра)
    Object.assign(MS, { points: map.points, groups: Object.create(null),
      talked: Object.create(null), cabled: 0, paid: Object.create(null),
      scouted: Object.create(null), scoutedN: Object.create(null), ferried: Object.create(null), spliced: Object.create(null),
      allow: Object.create(null), night: false, nightMul: 1, weather: def.weather ? Object.assign({}, def.weather) : null, storm: 0,
      aiT: 0, vetsUsed: 0, save: save, razed: Object.create(null), warn: [], geys: Object.create(null), creakT: 0,
      pumped: Object.create(null), lamps: Object.create(null), sites: Object.create(null), sitesN: 0, litN: 0, doused: Object.create(null), captured: Object.create(null), partsDown: Object.create(null), partsN: Object.create(null), bossDone: Object.create(null), scalded: Object.create(null) });
    MS.H = handler(W, MS);
    if (def.side === 'sizye') L.setSides(W, ['sizye', 'copper']); // игрок за Сизых: своя механика и сирень, Медный Ключ — латунь
    if (def.wind) L.setWind(W, Object.assign({ now: true }, def.wind));
    if (def.teams) W.team = def.teams.slice(); if (def.paint) { W.paint = {}; Object.keys(def.paint).forEach(function (k) { W.paint[k] = def.paint[k]; }); }
    Object.keys(def.depots || {}).forEach(function (id) { var dd = def.depots[id], dp = pointOf(MS, dd.at); W.depots.push({ id: id, x: dp.x, y: dp.y, w: dd.w == null ? 400 : dd.w, max: dd.max || dd.w || 400, team: dd.team == null ? null : dd.team, kind: dd.kind || 'water' }); });
    W.los = !!def.los; // шахта: сквозь породу не видно и не стреляют
    if (def.foeBlind) W.foeBlind = true; // ночью и соперник видит хуже (его автоприцел × обзор)
    if (def.campBuild) W.campBuild = true; // стоянка без конторы: стройка разрешена (у своих построек)
    if (def.ferry) { W.ferry = def.ferry === true ? true : Object.assign({}, def.ferry); if (W.ferry.home) W.ferry.home = pointOf(MS, W.ferry.home); } // автолюльки: горняки (spawn.fare) уезжают по канату сами; home — точка, куда уходят со Станции
    if (def.ropeFix) W.ropeFix = def.ropeFix === true ? {} : Object.assign({}, def.ropeFix); // Агафья чинит опоры и сращивает канат
    if (def.holdFire) W.holdFire = true; // разведка: свои стреляют только по приказу или в ответ (действие holdFire снимает)
    if (def.keepHq) W.hqSafe = { 1: true }; // снос чужой конторы — не победа: миссия решает сама (разведка, а не разгром)
    W.sand = def.sand || 0; W.haulCap = def.haulCap || 0; W.rigRate = def.rigRate || 0; W.treaty = !!def.treaty; W.packOn = !!def.player.pack; if (def.plantable) { W.plantable = {}; def.plantable.forEach(function (t) { W.plantable[t] = 1; }); }
    Object.keys(def.lifts || {}).forEach(function (id) { var ld = def.lifts[id]; L.addLift(W, { id: id, a: pointOf(MS, ld.a), b: pointOf(MS, ld.b), cap: ld.cap, ride: ld.ride, wait: ld.wait, at: ld.at, on: ld.on, label: ld.label }); });
    Object.keys(def.lamps || {}).forEach(function (id) { var lm = def.lamps[id], lp = pointOf(MS, lm.at); MS.lamps[id] = { id: id, x: lp.x, y: lp.y, r: lm.r || 4.5, on: false }; if (lm.on) lightLamp(W, MS, MS.lamps[id], true); });
    Object.keys(def.sites || {}).forEach(function (id) { var sd = def.sites[id], sp = pointOf(MS, sd.at); MS.sites[id] = { id: id, def: sd, x: sp.x, y: sp.y, r: sd.r || 1.6, p: 0, on: sd.on !== false, done: false }; });
    Object.keys(def.sites || {}).forEach(function (id) { var sd = def.sites[id]; if (sd.done && (sd.done === true || cond(W, sd.done))) { MS.sites[id].done = true; MS.sitesN++; } }); // уже сделано (по флагам прошлых миссий)
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
        if (L.BLDS[s.type]) { var c = MS.points[s.at][0]; var b = L.addBuilding(W, owner, s.type, c.i, c.j, s.noFree); if (s.tag) b.tag = s.tag; if (s.cut) b.cut = true; if (s.hpFrac) b.hp = Math.round(b.maxHp * s.hpFrac); if (s.stock != null) b.stock = s.stock; if (s.mult) b.mult = s.mult; return; }
        var p = pointOf(MS, s.at), tiles = spreadAround(W, p.x, p.y, s.n || 1);
        tiles.forEach(function (tl) {
          var u = L.addUnit(W, owner, s.type, tl.i + 0.5, tl.j + 0.5); u.post = { x: u.x, y: u.y };
          if (s.tag) { u.tag = s.tag; K0.noteSpawn(MS, s.tag); }
          if (L.HEROES[s.type] && owner === 0) { MS.heroes[s.type] = u.id; if (K0.wounded(save, s.type)) { u.hp = Math.round(u.maxHp * 0.6); u.wounded = true; } }
          if (s.vets && owner === 0) { var k = vets.findIndex(function (v) { return v.type === s.type; }); if (k >= 0) { var v = vets.splice(k, 1)[0]; u.vet = v.vet || 1; u.kills = v.kills || 3; MS.vetsUsed++; } }
          if (s.heading != null) u.heading = u.aim = s.heading;
          if (s.locked) u.locked = true; if (s.speed) u.sm = s.speed; if (s.hp) u.hp = u.maxHp = s.hp; if (s.calm) u.calm = true; if (s.water != null) u.water = s.water; if (s.talk) u.talk = true; if (s.fare) u.fare = true;
        });
      });
    }
    spawnList(def.player.start, 0);
    spawnList(def.enemy && def.enemy.start, 1);
    spawnList(def.ally && def.ally.start, 2);
    MS.vetsLeft = vets; // невостребованные в этой миссии ветераны остаются в запасе
    Object.keys(def.groups || {}).forEach(function (tag) { setGroup(W, MS, Object.assign({ tag: tag }, def.groups[tag])); });
    K0.objectives(MS);
    if (def.night) { MS.night = true; MS.nightMul = def.night; }
    W.seedKey = 'mission:' + def.id; W.ground = def.ground || 'tundra';
    applyWeather(W, MS);
    L.calcPower(W); L.updateVis(W);
    return W;
  }
  // флаги чужой кампании (def.xcarry, ядро — xcarried): xsave — сохранения тех кампаний (если не переданы — читаем из C.store, его
  // ставит campaign-ui); нет — флагов нет
  function xcarried(def, xsave) {
    return core().xcarried(def, function (camp) { return xsave && xsave[camp] !== undefined ? xsave[camp] : (P.campaign.store !== undefined ? load(P.campaign.store, camp) : null); });
  }
  // Поезд: тягач в точке at + wagons вагонов позади (против heading), след тягача заранее проложен по ним.
  // o: { owner, at, tag, wagons, heading, speed, locked, hp, wagonHp }
  function makeTrain(W, MS, o) {
    var p = pointOf(MS, o.at), hd = o.heading || 0, dx = Math.cos(hd), dy = Math.sin(hd), own = o.owner == null ? 0 : o.owner;
    var head = L.addUnit(W, own, 'tractor', p.x, p.y), prev = head; head.heading = head.aim = hd; head.trail = [];
    for (var s = 0.2; s <= ((o.wagons || 0) + 1) * 1.15 + 0.5; s += 0.2) head.trail.push({ x: p.x - dx * s, y: p.y - dy * s });
    var all = [head];
    for (var n = 1; n <= (o.wagons || 0); n++) { var w = L.addUnit(W, own, 'wagon', p.x - dx * n * 1.15, p.y - dy * n * 1.15); w.tow = prev.id; w.heading = w.aim = hd; if (o.wagonHp) w.hp = w.maxHp = o.wagonHp; all.push(w); prev = w; }
    all.forEach(function (u) { u.post = { x: u.x, y: u.y }; if (o.tag) { u.tag = o.tag; core().noteSpawn(MS, o.tag); } if (o.locked) u.locked = true; if (o.speed) u.sm = o.speed; });
    if (o.hp) head.hp = head.maxHp = o.hp;
    return head;
  }
  function setGroup(W, MS, g) { core().setGroup(MS, g); }

  // ---------- Условия ПРИИСКа (общие time/obj/since/flag/heroDead/killed/all/any/not — в ядре) ----------
  function matchWho(MS, u, who, type) {
    if (type && u.type !== type) return false;
    if (!who || who === 'any') return true;
    return u.type === who || u.tag === who;
  }
  function own(c) { return c.owner == null ? 0 : c.owner; }
  var CONDS = {
    zone: function (W, c, MS) {
      var o = own(c), inside = 0, total = 0;
      for (var n = 0; n < W.units.length; n++) { var u = W.units[n]; if (u.owner !== o || !matchWho(MS, u, c.who, c.type)) continue; total++; if (inZone(MS, c.zone, u.x, u.y)) inside++; }
      return c.all ? total > 0 && inside === total : inside >= (c.n || 1);
    },
    built: function (W, c) { var o = own(c); return W.blds.filter(function (b) { return b.owner === o && b.type === c.type; }).length >= (c.n || 1); },
    units: function (W, c) { var o = own(c); return everyone(W).filter(function (u) { return u.owner === o && (!c.type || u.type === c.type); }).length >= (c.n || 1); },
    hp: function (W, c) { // здоровье юнита/здания с тегом: доля от максимума ≥ gte (или ≤ lte)
      var he = W.blds.concat(W.units).filter(function (e) { return e.tag === c.tag; })[0]; if (!he) return false;
      var fr = he.hp / he.maxHp; return (c.gte == null || fr >= c.gte - 1e-6) && (c.lte == null || fr <= c.lte);
    },
    builtIn: function (W, c, MS) { var o = own(c), tl = c.type == null ? null : [].concat(c.type); return W.blds.filter(function (b) { var bc = L.center(b); return b.owner === o && (!tl || tl.indexOf(b.type) >= 0) && inZone(MS, c.zone, bc.x, bc.y); }).length >= (c.n || 1); },
    trained: function (W, c) { return (W.players[own(c)].trained[c.type] || 0) >= (c.n || 1); },
    mined: function (W, c) { return W.players[own(c)].mined >= c.gte; },
    copper: function (W, c) { return W.players[own(c)].copper >= c.gte; },
    gone: function (W, c, MS) { return (MS.spawned[c.tag] || 0) > 0 && !everyone(W).some(function (u) { return u.tag === c.tag && (!c.type || u.type === c.type); }); },
    hit: function (W, c) { return (W.hits[(c.by == null ? 0 : c.by) + ':' + c.tag] || 0) >= (c.gte || 1); }, // по тегу стрелял владелец by
    razed: function (W, c, MS) { return (MS.razed[own(c) + ':' + (c.type || '*')] || 0) >= (c.gte || 1); },      // снесено зданий владельца owner
    seen: function (W, c, MS) { var zc = zoneCenter(MS, c.zone), i = Math.floor(zc.x), j = Math.floor(zc.y); return W.vis[j * W.w + i] === 2; },
    alerted: function (W, c, MS) { return !!(MS.groups[c.group] && MS.groups[c.group].alerted); },
    fires: function (W, c, MS) { var nf = W.fires.filter(function (f) { return f.hp > 0 && (!c.tag || [].concat(c.tag).indexOf(f.tag) >= 0) && (!c.zone || inZone(MS, c.zone, f.x, f.y)); }).length; return (c.lte == null || nf <= c.lte) && (c.gte == null || nf >= c.gte); },
    doused: function (W, c, MS) { return (MS.doused[c.tag || '*'] || 0) >= (c.gte || 1); },
    owned: function (W, c) { var o = own(c); return W.blds.filter(function (b) { return b.owner === o && (b.tag === c.tag || b.tag0 === c.tag) && (!c.type || b.type === c.type); }).length >= (c.n || 1); },
    captured: function (W, c, MS) { return (MS.captured[(c.type || '*')] || 0) >= (c.gte || 1); },
    part: function (W, c, MS) { return !!MS.partsDown[(c.tag || '*') + ':' + c.k]; },
    parts: function (W, c, MS) { return (MS.partsN[c.tag || '*'] || 0) >= (c.gte || 1); },
    scalded: function (W, c, MS) { return (MS.scalded[c.tag || '*'] || 0) >= (c.gte || 1); },
    bossDone: function (W, c, MS) { return !!MS.bossDone[c.tag || '*']; },
    site: function (W, c, MS) { var ss = MS.sites[c.id]; return !!ss && ss.done; },
    sites: function (W, c, MS) { var sn = c.ids ? c.ids.filter(function (k) { return MS.sites[k] && MS.sites[k].done; }).length : MS.sitesN; return (c.gte == null || sn >= c.gte) && (c.lte == null || sn <= c.lte); },
    lit: function (W, c, MS) { return MS.litN >= (c.gte || 1); },
    rode: function (W, c) { var rl = L.liftById(W, c.id); return !!rl && rl.trips >= (c.gte || 1); },
    liftAt: function (W, c) { var la = L.liftById(W, c.id); return !!la && la.st !== 'move' && la.at === c.end; },
    pumped: function (W, c, MS) { return (MS.pumped[c.zone] || 0) >= c.gte; }, // сколько меди выкачали вышки игрока в зоне (def.pumped — список зон учёта)
    talked: function (W, c, MS) { return !!MS.talked[c.tag]; },
    scouted: function (W, c, MS) { var sk = (c.owner == null ? 1 : c.owner) + ':' + (c.type || c.tag || '*'); return (MS.scoutedN[sk] || 0) >= (c.gte || 1); }, // сколько чужих зданий разведано (видели хоть раз)
    storm: function (W, c, MS) { return (c.gte == null || MS.storm >= c.gte) && (c.lte == null || MS.storm <= c.lte); }, // сила метели/бурана 0…1
    cabled: function (W, c, MS) { return MS.cabled >= (c.gte || 1); },
    cut: function (W, c) { return W.blds.some(function (b) { return b.tag === c.tag && b.hp > 0 && (b.cut || b.cutAt > 0); }); }, // пролёт на опоре с тегом оборван (или вот-вот)
    spliced: function (W, c, MS) { return (MS.spliced[c.tag || '*'] || 0) >= (c.gte || 1); },
    routed: function (W, c) { var o = own(c); return W.blds.some(function (b) { return b.tag === c.tag && b.owner === o && b.hp > 0 && L.BLDS[b.type].cable && !b.cut && L.cableRoute(W, b, function (x) { return !!L.BLDS[x.type].terminal; }).length > 0; }); }, // от узла с тегом есть канат до Станции
    ferried: function (W, c, MS) { return [].concat(c.tag || '*').reduce(function (s, t) { return s + (MS.ferried[t] || 0); }, 0) >= (c.gte || 1); }, // сколько горняков с тегом довезли люльками до Станции
    paid: function (W, c, MS) { return (MS.paid[c.tag] || 0) >= (c.gte || 1); },
    wind: function (W, c) { return !!W.wind && (c.gte == null || W.wind.s >= c.gte) && (c.lte == null || W.wind.s <= c.lte); },
    linked: function (W, c) { var o = own(c); return W.blds.some(function (b) { return b.owner === o && L.BLDS[b.type].face && L.cableRoute(W, b, function (x) { return !!L.BLDS[x.type].terminal; }).length > 0; }); },
    lostB: function (W, c) { return W.players[0].lostB <= (c.lte || 0); },
    lostU: function (W, c) { var pl = W.players[0]; return pl.lost - pl.lostB <= (c.lte || 0); }
  };
  function cond(W, c) { var MS = W.mission; return core().cond(MS, MS.H, c); }

  // ---------- Действия ПРИИСКа (общие wait/if/say/msg/objective/flag/win/lose — в ядре) ----------
  var TCH = { '#': L.ROCK, '~': L.WATER, '=': L.ICE, '_': L.OPEN, ':': L.BRIDGE, '.': L.GROUND, ',': L.SHAKY, '^': L.PIT };
  function run(W, list, from) { var MS = W.mission; core().run(MS, MS.H, list, from); }
  function act(W, a) { var MS = W.mission; core().act(MS, MS.H, a); }
  var ACTS = {
    spawn: function (W, a, MS) {
      var p = pointOf(MS, a.at), tiles = spreadAround(W, p.x, p.y, a.n || 1), o = a.owner == null ? 1 : a.owner;
      tiles.forEach(function (tl) { var u = L.addUnit(W, o, a.type, tl.i + 0.5, tl.j + 0.5); u.post = { x: u.x, y: u.y }; if (a.tag) { u.tag = a.tag; core().noteSpawn(MS, a.tag); } if (a.heading != null) u.heading = u.aim = a.heading; if (a.speed) u.sm = a.speed; if (a.hp) u.hp = u.maxHp = a.hp; if (a.locked) u.locked = true; if (a.calm) u.calm = true; if (a.talk) u.talk = true; if (a.fare) u.fare = true; if (a.water != null) u.water = a.water; });
    },
    train: function (W, a, MS) { makeTrain(W, MS, a); },
    group: function (W, a, MS) { setGroup(W, MS, Object.assign({}, a, { a: undefined })); },
    despawn: function (W, a, MS) { W.units = W.units.filter(function (u) { if (u.tag === a.tag && (!a.type || u.type === a.type) && (!a.zone || inZone(MS, a.zone, u.x, u.y)) && !u.riding) { delete W.byId[u.id]; return false; } return true; }); },
    tiles: function (W, a, MS) {
      var to = TCH[a.to], from = a.from != null ? TCH[a.from] : null;
      var hitSet = a.dmg ? Object.create(null) : null;
      zoneCells(W, MS, a.zone).forEach(function (c) { var k = c.j * W.w + c.i; if (from == null || W.t[k] === from) { W.t[k] = to; if (!L.walkable(to)) W.ore[k] = 0; if (hitSet) hitSet[k] = 1; } });
      if (hitSet) W.units.forEach(function (u) { if (hitSet[Math.floor(u.y) * W.w + Math.floor(u.x)] && !u.parts) { u.hp -= a.dmg; u.hitT = W.time; } }); // обвал: кого накрыло
      // здание над исчезнувшей твердью (провал) рушится
      W.blds.forEach(function (b) { for (var j = 0; j < b.h; j++) for (var i = 0; i < b.w; i++) if (!L.walkable(W.t[(b.ty + j) * W.w + b.tx + i]) && W.t[(b.ty + j) * W.w + b.tx + i] !== L.GROUND) { b.hp = 0; b.fell = true; } });
      // кто стоял на треснувшем — выбирается на ближайшую твёрдую клетку
      W.units.forEach(function (u) { var i = Math.floor(u.x), j = Math.floor(u.y); if (!L.walkable(W.t[j * W.w + i])) { var np = L.nearestPassable(W, i, j, 8); if (np) { u.x = np.i + 0.5; u.y = np.j + 0.5; } u.path = []; if (u.order.t === 'move' || u.order.t === 'amove') u.order = { t: 'idle' }; } });
      W.mapRev++; W.seedKey = 'mission:' + MS.id + ':' + W.mapRev;
      L.repathBlocked(W); // у кого путь шёл через исчезнувшую клетку — ищут обход
    },
    reveal: function (W, a, MS) { var rp = pointOf(MS, a.at); W.flares.push({ x: rp.x, y: rp.y, r: a.r || 5, t: a.s || 8, max: a.s || 8, owner: 0 }); W.visT = 0; },
    weather: function (W, a, MS) { MS.weather = a.kind ? Object.assign({ t0: a.fromNow ? W.time : 0 }, a) : null; applyWeather(W, MS); },
    night: function (W, a, MS) { MS.night = a.on !== false; MS.nightMul = a.mul || 0.65; applyWeather(W, MS); MS.ui.push({ t: 'night', on: MS.night }); },
    copper: function (W, a) { W.players[a.owner || 0].copper += a.n; },
    quake: function (W, a, MS) { var qc = zoneCells(W, MS, a.zone).map(function (c) { return c.j * W.w + c.i; }); MS.warn.push({ cells: qc, t: a.s || 15, max: a.s || 15, zone: a.zone }); MS.ui.push({ t: 'quake', zone: a.zone }); },
    geyser: function (W, a, MS) { // включить/выключить гейзер; burst — сразу предупреждение и выброс через warn секунд (сценарный удар)
      (a.id === '*' ? Object.keys(MS.geys) : [].concat(a.id)).forEach(function (id) { var gz = MS.geys[id]; if (!gz) return; gz.on = a.on !== false; var gd = gz.def; gz.t0 = a.burst ? W.time + (gd.phase || 0) - ((gd.period || 30) - (gd.warn || 3)) + 0.05 : W.time; gz.prev = null; }); },
    ai: function (W, a, MS) { if (a.mode === 'race') { var ra = Object.assign({}, a); ra.spots = (a.spots || []).map(function (k) { return pointOf(MS, k); }); W.ai = L.newRaceAI(W, a.owner == null ? 1 : a.owner, ra); return; }
      if (a.mode === 'waves') { W.ai = L.newAI(W, a.owner == null ? 1 : a.owner); if (a.first) W.ai.nextWave = W.time + a.first; } else W.ai = null; },
    owner: function (W, a, MS) { // сменить владельца всем юнитам и зданиям с тегом (союз / вражда после развилки)
      var to = a.to; W.units.concat(W.blds).forEach(function (e) { if (e.tag === a.tag && (!a.type || e.type === a.type)) { L.setOwner(W, e, to); if (a.calm != null && e.kind === 'unit') e.calm = !!a.calm; } });
      if (MS.groups[a.tag]) MS.groups[a.tag].owner = to; },
    paint: function (W, a) { W.paint = W.paint || {}; W.paint[a.owner] = a.to; W.units.concat(W.blds).forEach(function (e) { if (e.owner === a.owner) e.pi = a.to; }); },
    fire: function (W, a, MS) { var fat = a.at; // at — точка или список точек (тогда — случайная из тех, где ещё не горит)
      if (Array.isArray(fat)) { var freeAt = fat.filter(function (k) { var q = pointOf(MS, k); return !W.fires.some(function (f) { return f.hp > 0 && Math.hypot(f.x - q.x, f.y - q.y) < 1.2; }); }); if (!freeAt.length) return; fat = freeAt[Math.floor(W.rng() * freeAt.length) % freeAt.length]; }
      var fp = pointOf(MS, fat); var area = a.area ? Object.assign({ r: 3 }, pointOf(MS, a.area.at || fat), { r: a.area.r || 3 }) : null;
      L.addFire(W, fp.x + (a.dx || 0), fp.y + (a.dy || 0), { r: a.r, max: a.max, hp: a.hp, grow: a.grow, dps: a.dps, bdps: a.bdps, tag: a.tag, spread: a.spread, area: area, cap: a.cap, drift: a.drift }); },
    douse: function (W, a) { W.fires.forEach(function (f) { if (!a.tag || f.tag === a.tag) f.hp = 0; }); },
    depot: function (W, a) { W.depots.forEach(function (dp) { if (dp.id === a.id) { if (a.w != null) dp.w = a.w; if (a.team !== undefined) dp.team = a.team; } }); },
    boss: function (W, a, MS) { var rt = a.route ? a.route.map(function (k) { return pointOf(MS, k); }) : null; W.units.forEach(function (u) { if (u.tag === a.tag && u.bs) { if (a.cfg) L.setBoss(u, a.cfg); if (rt) { u.bs.route = rt; u.bs.ri = 0; u.bs.done = false; u.bs.goal = null; u.path = []; } } }); },
    teams: function (W, a) { W.team = a.set ? a.set.slice() : null; W.units.forEach(function (u) { if (u.order.t === 'attack') { var tg = W.byId[u.order.target]; if (tg && !L.hostile(W, tg.owner, u.owner)) { u.order = { t: 'idle' }; u.path = []; } } }); W.visT = 0; },
    lift: function (W, a) { [].concat(a.id).forEach(function (id) { var lf = L.liftById(W, id); if (lf) { lf.on = a.on !== false; if (a.at && lf.st === 'idle') lf.at = a.at; } }); },
    lamp: function (W, a, MS) { [].concat(a.id).forEach(function (id) { if (MS.lamps[id]) lightLamp(W, MS, MS.lamps[id], true); }); },
    site: function (W, a, MS) { [].concat(a.id).forEach(function (id) { var st = MS.sites[id]; if (!st) return; if (a.on != null) st.on = !!a.on; if (a.done && !st.done) { st.done = true; MS.sitesN++; } }); },
    calm: function (W, a) { W.units.forEach(function (u) { if (u.tag === a.tag) { u.calm = a.on !== false; if (u.calm && u.order.t === 'attack') { u.order = { t: 'idle' }; u.path = []; } } }); W.units.forEach(function (u) { if (u.order.t === 'attack') { var tg2 = W.byId[u.order.target]; if (tg2 && tg2.tag === a.tag && tg2.calm) { u.order = { t: 'idle' }; u.path = []; } } }); },
    wind: function (W, a) { L.setWind(W, a); },
    holdFire: function (W, a) { W.holdFire = a.on !== false; },
    cut: function (W, a, MS) { W.blds.forEach(function (b) { if (b.tag !== a.tag || b.hp <= 0) return; if (a.on === false) { b.cut = false; b.cutAt = 0; b.cutP = 0; } else if (!b.cut) b.cutAt = W.time + (a.warn || 0.01); }); if (a.on !== false) MS.ui.push({ t: 'cutWarn', tag: a.tag, s: a.warn || 0 }); },
    build: function (W, a, MS) { var bp = MS.points[a.at] && MS.points[a.at][0]; if (!bp) throw new Error('нет точки «' + a.at + '»'); var ow = a.owner == null ? 0 : a.owner, d0 = L.BLDS[a.type];
      for (var bj = 0; bj < d0.h; bj++) for (var bi = 0; bi < d0.w; bi++) if (W.occ[(bp.j + bj) * W.w + bp.i + bi]) return; // место занято — не ставим
      var nb = L.addBuilding(W, ow, a.type, bp.i, bp.j, true); if (a.tag) nb.tag = a.tag; if (a.hpFrac) nb.hp = Math.round(nb.maxHp * a.hpFrac); if (a.setup) { nb.setup = a.setup; L.calcPower(W); } },
    ferry: function (W, a) { W.ferry = a.on === false ? false : a.cfg ? Object.assign({}, a.cfg) : (W.ferry || true); }, // включить/выключить автолюльки
    seize: function (W, a, MS) { var sz0 = 0; W.units = W.units.filter(function (u) { if (u.owner === (a.owner || 0) && a.types.indexOf(u.type) >= 0) { delete W.byId[u.id]; sz0++; return false; } return true; }); var pz = W.players[a.owner || 0]; ['inf', 'veh'].forEach(function (q) { pz[q] = pz[q].filter(function (t) { if (a.types.indexOf(t) >= 0) { pz.copper += L.UNITS[t].cost; return false; } return true; }); }); MS.seized = (MS.seized || 0) + sz0; }, // заводчик забирает технику (и заказанную — медь возвращается)
    allow: function (W, a, MS) { (a.build || []).concat(a.units || []).forEach(function (b) { MS.allow[b] = true; }); if (a.repair) { MS.repair = W.repairOn = true; } if (a.pack) W.packOn = true; }
  };

  // ---------- Погода и ночь ----------
  function applyWeather(W, MS) {
    var m = 1, wt = MS.weather;
    if (wt && (wt.kind === 'snowstorm' || wt.kind === 'buran')) { var ph = 0.5 + 0.5 * Math.cos(2 * Math.PI * ((W.time - (wt.t0 || 0)) / (wt.period || 40))); m = wt.min + (wt.max - wt.min) * ph; }
    MS.storm = wt ? 1 - (m - wt.min) / Math.max(0.01, wt.max - wt.min) : 0;
    // буран (buran): та же метель, но в самый разгар все идут медленнее (wt.slow — во сколько раз при storm = 1)
    W.moveMul = wt && wt.kind === 'buran' ? 1 - (1 - (wt.slow || 0.7)) * MS.storm : 1;
    if (MS.night) m = Math.min(m, MS.nightMul);
    W.sightMul = m;
  }
  // ---------- Сценарный ИИ групп ----------
  function groupStep(W, MS, g) {
    if (g.talked) return; // пост уговорили — стоит мирно
    var mem = W.units.filter(function (u) { return u.tag === g.tag && u.owner === g.owner; });
    if (!mem.length) return;
    var armed = mem.filter(function (u) { return !!L.UNITS[u.type].weapon && !u.calm; }), foeOf = function (e) { return L.hostile(W, e.owner, g.owner); };
    // реакция: кого-то из группы обстреляли — или (convoy/notice) враг подошёл вплотную
    var hitter = null;
    mem.forEach(function (u) { if (W.time - u.hitT < 2 && L.alive(W.byId[u.hitBy])) hitter = W.byId[u.hitBy]; });
    var nr = g.notice ? g.notice * (g.stormy ? (W.sightMul == null ? 1 : W.sightMul) : 1) : 0; // stormy — в метель и ночью дозор замечает ближе
    if (!hitter && nr) mem.forEach(function (u) { W.units.forEach(function (e) { if (!hitter && foeOf(e) && !e.calm && e.hp > 0 && Math.hypot(e.x - u.x, e.y - u.y) <= nr) hitter = e; }); });
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
    } else if (g.mode === 'capture') { // инженеры группы занимают чужие здания (g.tags — только с такими тегами), остальные идут с ними и отгоняют охрану
      var engs = mem.filter(function (u) { return L.UNITS[u.type].engineer; }), goalB = null;
      engs.forEach(function (u) {
        var cur = u.order.t === 'capture' ? W.byId[u.order.target] : null; if (cur && L.canCapture(W, g.owner, cur)) { goalB = goalB || cur; return; }
        var best = null, bd = 1e9; W.blds.forEach(function (b) { if (!L.canCapture(W, g.owner, b) || (g.tags && g.tags.indexOf(b.tag) < 0 && g.tags.indexOf(b.tag0) < 0)) return;
          var d = L.distTo(u, b) + (engs.some(function (e) { return e !== u && e.order.t === 'capture' && e.order.target === b.id; }) ? 6 : 0); if (d < bd) { bd = d; best = b; } });
        if (best) { L.commandCapture(W, [u.id], best.id); goalB = goalB || best; }
      });
      var lead = engs[0], gp = lead ? { x: lead.x, y: lead.y } : g.target ? pointOf(MS, g.target) : null;
      if (gp) { var esc = idle.filter(function (u) { return !L.UNITS[u.type].engineer && Math.hypot(u.x - gp.x, u.y - gp.y) > 3; }); if (esc.length) L.commandMove(W, esc.map(function (u) { return u.id; }), gp.x, gp.y, true); }
      else if (idle.length) { var nf2 = nearestFoe(W, idle[0], foeOf); if (nf2) L.commandMove(W, idle.map(function (u) { return u.id; }), nf2.x, nf2.y, true); }
    } else if (g.mode === 'escort') { // идут за героем/тегом g.follow (владельца g.lead, по умолчанию — игрока), сами ездят клетями
      var lo = g.lead == null ? 0 : g.lead, all = everyone(W), lead = all.filter(function (u) { return u.owner === lo && (u.type === g.follow || u.tag === g.follow) && u.hp > 0; })[0] || all.filter(function (u) { return u.owner === lo && u.hp > 0; })[0];
      if (lead) {
        var lp = { x: lead.x, y: lead.y }; W.lifts.forEach(function (lf) { if (lf.riders.indexOf(lead) >= 0) lp = lf[lf.to]; });
        var goers = [];
        mem.forEach(function (u) {
          if (u.order.t === 'attack') return;
          var hop = L.liftRoute(W, u.x, u.y, lp.x, lp.y);
          if (hop) { if (!(u.order.t === 'lift' && u.order.lift === hop.lift.id && u.order.end === hop.end)) L.commandLift(W, [u.id], hop.lift, hop.end); return; }
          if (u.order.t === 'lift') { u.order = { t: 'idle' }; u.path = []; }
          var dd = Math.hypot(u.x - lp.x, u.y - lp.y), far = dd > (g.dist || 4.5);
          if (far && (u.order.t === 'idle' || (u.order.t === 'amove' && Math.hypot(u.order.x - lp.x, u.order.y - lp.y) > 5))) goers.push(u.id);
        });
        if (goers.length) L.commandMove(W, goers, lp.x, lp.y, true);
      }
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
    if (W.winner < 0) { applyWeather(W, MS); hazards(W, MS, dt); } // до разбора событий: выброс гейзера сам рождает события (обваренная громада, сбитые узлы)
    // события мира (каждое — один раз; main.js потом очищает W.events)
    W.events.forEach(function (ev) {
      if (ev._m) return; ev._m = 1;
      if (ev.t === 'die' && ev.kind === 'unit') {
        core().noteKill(MS, ev.tag, ev.type);
        if (ev.owner === 0 && L.HEROES[ev.type]) { MS.heroDead[ev.type] = true; MS.ui.push({ t: 'heroDown', who: ev.type }); }
      }
      if (ev.t === 'doused' && ev.by >= 0) { MS.doused[ev.tag || '-'] = (MS.doused[ev.tag || '-'] || 0) + 1; MS.doused['*'] = (MS.doused['*'] || 0) + 1; }
      if (ev.t === 'captured' && ev.owner === 0) { MS.captured[ev.type] = (MS.captured[ev.type] || 0) + 1; MS.captured['*'] = (MS.captured['*'] || 0) + 1; }
      if (ev.t === 'part') { MS.partsDown[(ev.tag || '-') + ':' + ev.k] = true; MS.partsDown['*:' + ev.k] = true; MS.partsN[ev.tag || '-'] = (MS.partsN[ev.tag || '-'] || 0) + 1; MS.partsN['*'] = (MS.partsN['*'] || 0) + 1; MS.ui.push({ t: 'part', k: ev.k, left: ev.left }); }
      if (ev.t === 'bossScald') { MS.scalded[ev.tag || '-'] = (MS.scalded[ev.tag || '-'] || 0) + 1; MS.scalded['*'] = (MS.scalded['*'] || 0) + 1; MS.ui.push({ t: 'scald' }); }
      if (ev.t === 'talked' && ev.owner === 0) { MS.talked[ev.tag] = true; if (MS.groups[ev.tag]) MS.groups[ev.tag].talked = true; MS.ui.push({ t: 'talked', tag: ev.tag }); }
      if (ev.t === 'talkFail' && ev.owner === 0) MS.ui.push({ t: 'talkFail', tag: ev.tag });
      if (ev.t === 'cableIn' && ev.owner === 0) { if (ev.fare) { MS.ferried[ev.tag || '-'] = (MS.ferried[ev.tag || '-'] || 0) + 1; MS.ferried['*'] = (MS.ferried['*'] || 0) + 1; } else MS.cabled++; }
      if (ev.t === 'ferry' && L.friendTo0(W, ev.owner)) MS.ui.push({ t: 'ferry', n: ev.n });
      if (ev.t === 'copper' && ev.cable && ev.owner === 0 && ev.tag) MS.paid[ev.tag] = (MS.paid[ev.tag] || 0) + ev.n; // медь, пришедшая по канату на станцию с тегом
      if (ev.t === 'carFall' && ev.owner === 0) MS.ui.push({ t: 'carFall', shot: !!ev.shot });
      if (ev.t === 'cut' && ev.owner === 0) MS.ui.push({ t: 'cut', tag: ev.tag });
      if (ev.t === 'spliced' && ev.owner === 0) { MS.spliced[ev.tag || '-'] = (MS.spliced[ev.tag || '-'] || 0) + 1; MS.spliced['*'] = (MS.spliced['*'] || 0) + 1; MS.ui.push({ t: 'spliced', tag: ev.tag }); }
      if (ev.t === 'windShift' && L.facOf(W, 0) === 'sizye') MS.ui.push({ t: 'wind' });
      if (ev.t === 'bossArrived') { MS.bossDone[ev.tag || '-'] = true; MS.bossDone['*'] = true; }
      var bt = ev.kind === 'bld' ? ev.type : ev.packed; // здание (или фургон со свёрнутым зданием) снесено
      if (ev.t === 'die' && bt) { MS.razed[ev.owner + ':' + bt] = (MS.razed[ev.owner + ':' + bt] || 0) + 1; MS.razed[ev.owner + ':*'] = (MS.razed[ev.owner + ':*'] || 0) + 1; }
    });
    if (W.winner >= 0) { if (W.winner === 1 && !MS.reason) MS.reason = 'hq'; return; }
    // ядро: отложенные действия (wait), триггеры, разведка и учёт вышек (scoutTick), цели, поражение, победа
    core().step(MS, MS.H, dt);
    MS.aiT -= dt;
    if (MS.aiT <= 0) { MS.aiT = 0.5; Object.keys(MS.groups).forEach(function (k) { groupStep(W, MS, MS.groups[k]); }); }
  }
  // раз в 0,25 с между триггерами и целями: разведка чужих зданий и медь вышек игрока по зонам учёта
  function scoutTick(W, MS) {
    W.blds.forEach(function (b) { // разведка: чужое здание хоть раз видно сейчас (vis 2 под ним) — запомнили
      if (b.owner === 0 || MS.scouted[b.id] || L.friendTo0(W, b.owner)) return; var seen = false;
      for (var j = 0; j < b.h && !seen; j++) for (var i = 0; i < b.w; i++) if (W.vis[(b.ty + j) * W.w + b.tx + i] === 2) { seen = true; break; }
      if (!seen) return; MS.scouted[b.id] = b.type; [b.type, b.tag || null, '*'].forEach(function (k) { if (k) { var key = b.owner + ':' + k; MS.scoutedN[key] = (MS.scoutedN[key] || 0) + 1; } }); MS.ui.push({ t: 'scouted', type: b.type, id: b.id });
    });
    if (MS.def.pumped) W.blds.forEach(function (b) { if (b.owner !== 0 || b.type !== 'rig') return; var d = (b.pumped || 0) - (b._pc || 0); if (d <= 0) return; b._pc = b.pumped; var bc = L.center(b); MS.def.pumped.forEach(function (z) { if (inZone(MS, z, bc.x, bc.y)) MS.pumped[z] = (MS.pumped[z] || 0) + d; }); });
  }
  function tick(W, dt) { L.step(W, dt); step(W, dt); }

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
        W.units.forEach(function (u) { if (u.parts) { if (Math.hypot(u.x - p.x, u.y - p.y) <= r + L.UNITS[u.type].r * 0.6) L.bossSteam(W, u, gd.boss, gd.stun); return; } // громаду обваривает по узлам
          if (Math.hypot(u.x - p.x, u.y - p.y) <= r) { u.hp -= dmg * (L.UNITS[u.type].cls === 'veh' ? 0.6 : 1); u.hitT = W.time; u.steamT = W.time; } });
        W.blds.forEach(function (b) { var c = L.center(b); if (Math.hypot(c.x - p.x, c.y - p.y) <= r + Math.max(b.w, b.h) / 2) b.hp -= dmg; });
        W.events.push({ t: 'geyser', id: id, x: p.x, y: p.y });
      }
      gz.prev = cyc;
    });
    // фонари: свой (или союзный) юнит рядом зажигает — обзор вокруг остаётся
    Object.keys(MS.lamps).forEach(function (id) { var lm = MS.lamps[id]; if (lm.on) return; for (var n2 = 0; n2 < W.units.length; n2++) { var u = W.units[n2]; if (u.owner === 0 && Math.hypot(u.x - lm.x, u.y - lm.y) <= 1.8) { lightLamp(W, MS, lm); break; } } });
    // привал у фонаря (def.rest = { hp, r, calm }): пехота игрока и союзника у зажжённого фонаря, по которой calm секунд не
    // стреляли, перевязывается — hp единиц здоровья в секунду (технику чинит Сава)
    if (MS.def.rest) { var rs = MS.def.rest, lit = Object.keys(MS.lamps).map(function (id) { return MS.lamps[id]; }).filter(function (lm) { return lm.on; });
      if (lit.length) W.units.forEach(function (u) { if (!L.friendTo0(W, u.owner) || L.UNITS[u.type].cls !== 'inf' || u.hp >= u.maxHp || W.time - u.hitT < (rs.calm || 4)) return;
        for (var n4 = 0; n4 < lit.length; n4++) if (Math.hypot(u.x - lit[n4].x, u.y - lit[n4].y) <= (rs.r || 2.6)) { u.hp = Math.min(u.maxHp, u.hp + (rs.hp || 4) * dt); u.restT = W.time; break; } }); }
    // места работ (закладка заряда, подрывная машинка): нужный юнит стоит на месте def.time секунд
    Object.keys(MS.sites).forEach(function (id) {
      var st = MS.sites[id]; if (!st.on || st.done) { st.busy = false; return; }
      var who = st.def.who ? [].concat(st.def.who) : null, worker = null;
      for (var n3 = 0; n3 < W.units.length && !worker; n3++) { var w = W.units[n3]; if (w.owner === 0 && w.hp > 0 && (!who || who.indexOf(w.type) >= 0) && !w.path.length && w.order.t !== 'attack' && Math.hypot(w.x - st.x, w.y - st.y) <= st.r) worker = w; }
      st.busy = !!worker;
      if (worker) { st.p += dt; worker.workT = W.time; if (st.p >= (st.def.time || 5)) { st.done = true; st.busy = false; MS.sitesN++; MS.ui.push({ t: 'site', id: id }); W.events.push({ t: 'site', id: id, x: st.x, y: st.y }); } }
      else if (st.p > 0) st.p = Math.max(0, st.p - dt * 0.5);
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

  function lightLamp(W, MS, lm, quiet) { if (lm.on) return; lm.on = true; MS.litN++; W.lights.push({ x: lm.x, y: lm.y, r: lm.r, id: lm.id }); W.visT = 0; if (!quiet) MS.ui.push({ t: 'lamp', id: lm.id }); }
  // все юниты, включая едущих в клетях (их нет в W.units)
  function everyone(W) { return W.lifts && W.lifts.length ? W.units.concat(L.riders(W)) : W.units; }

  // ---------- Итог ----------
  function result(W) {
    var MS = W.mission, pl = W.players[0], win = W.winner === 0;
    var stars = core().stars(MS, MS.H, win);
    var vets = everyone(W).filter(function (u) { return u.owner === 0 && u.vet && !L.HEROES[u.type]; }).map(function (u) { return { type: u.type, vet: u.vet, kills: u.kills || 0 }; });
    return { id: MS.id, win: win, reason: MS.reason, time: W.time, stars: stars, lostU: pl.lost - pl.lostB, lostB: pl.lostB, kills: pl.kills,
      flags: Object.assign({}, MS.flags), vets: vets.concat(MS.vetsLeft || []), heroes: core().heroesOf(MS), newVets: vets.length };
  }

  // ---------- Прогресс кампании (ядро; ключи и формат сохранения — прежние) ----------
  function saveOpts(camp) { return { vets: true, camp: camp === 'sizye' || camp === 'both' ? camp : null }; }
  function newSave(camp) { return core().newSave(saveOpts(camp)); }
  function load(store, camp) { camp = campKey(camp); return core().load(store, KEYS[camp], saveOpts(camp)); }
  function save(store, data) { return core().save(store, KEYS[campKey(data && data.camp)], data); }
  function reset(store, camp) { camp = campKey(camp); return core().reset(store, KEYS[camp], saveOpts(camp)); }
  // Победа: звёзды (лучшие), время, флаги, герои и ветераны (до 12) → в сохранение; открывается следующая миссия.
  function applyResult(data, res) { var m = byId(res.id); return core().applyResult(data, res, { n: m ? m.n : null, vets: 12 }); }

  // ---------- Финал кампании: итог по флагам (данные — def.finale последней миссии; рисует campaign-ui) ----------
  // def.finale = { title, sub — текст {ru,en} или выбор по флагу { key, значение: {ru,en}, … }; rows: [{ mission, key, text? }] — решения
  // игрока (текст — row.text[значение] или flagText той миссии); quotes: [{ who, when: { флаг: значение | [значения] }, text }]; note — пометка внизу }.
  function savedOf(xsaves, k) { return xsaves && xsaves[k] !== undefined ? xsaves[k] : load(P.campaign.store, k); }
  function finale(def, data, xsaves) {
    var f = def && def.finale; if (!f) return null; var K0 = core(), flags = (data && data.flags) || {};
    var rows = (f.rows || []).map(function (r) { var m = byId(r.mission), v = flags[r.key], t = (r.text && r.text[v]) || (m && m.flagText && m.flagText[r.key] && m.flagText[r.key][v]); return t ? { n: m.n, title: m.title, text: t, key: r.key, value: v, camp: campOf(m) } : null; }).filter(Boolean);
    var st = K0.starsOf(list(campOf(def)), data, 3);
    // f.camps — эпилог: итог звёзд каждой из кампаний (сохранения — xsaves или хранилище C.store)
    var totals = (f.camps || []).map(function (k) { var s = K0.starsOf(list(k), savedOf(xsaves, k), 3); return { camp: k, total: s.total, max: s.max }; });
    return { title: K0.pick(f.title, flags), sub: K0.pick(f.sub, flags), rows: rows, stars: st.rows, total: st.total, max: st.max, totals: totals,
      quotes: (f.quotes || []).filter(function (q) { return K0.flagsMatch(q.when, flags); }).slice(0, f.maxQuotes || 4), note: K0.pick(f.note, flags), ending: flags[f.key || 'ending'] || null };
  }

  // ---------- Эпилог обеих кампаний (def.camp = 'both') ----------
  // кампания пройдена — выигран её финал (миссия с def.finale; нет такой — последняя по номеру)
  function campDone(camp, sv) { var ls = list(camp), fin = ls.filter(function (m) { return m.finale; })[0] || ls[ls.length - 1]; return !!(fin && sv && sv.missions && sv.missions[fin.id]); }
  // состояние эпилога: open — обе кампании пройдены и флаги каждой совпадают с def.unlock[кампания]; done — эпилог уже пройден;
  // camps — по каждой кампании { done, match } (для подсказок на экранах финала). saves — { copper, sizye, both } или из C.store
  function epilogueState(def, saves) {
    if (!def) return { open: false, done: false, camps: {} };
    var sv = function (k) { return savedOf(saves, k); }, us = core().unlockState(def.unlock, sv, campDone), b = sv('both');
    return { open: us.open, done: !!(b && b.missions && b.missions[def.id]), camps: us.camps };
  }
  function epilogue() { return P.MISSIONS_B[0] || null; }

  P.campaign = { finale: finale, epilogue: epilogue, epilogueState: epilogueState, campDone: campDone, flagsMatch: function (when, flags) { return core().flagsMatch(when, flags); }, KEY: KEY, KEYS: KEYS, CAMPS: CAMPS, campOf: campOf, list: list, xcarried: xcarried, register: register, byId: byId, parseMap: parseMap, build: build, step: step, tick: tick, cond: cond, act: act, run: run,
    result: result, newSave: newSave, load: load, save: save, reset: reset, applyResult: applyResult, pointOf: pointOf, inZone: inZone, zoneCenter: zoneCenter,
    zoneCells: zoneCells, txt: txt, everyone: everyone, makeTrain: makeTrain, hazards: hazards, allowed: function (W, type) { return !W.mission || !!W.mission.allow[type]; } };
})(typeof window !== 'undefined' ? window : globalThis);
