/* ПОРУБЕЖЬЕ · js/campaign.js — движок миссий кампаний (без DOM): миссия = объект данных (файлы js/missions/<id>.js полной версии,
   PORUB.registerMission). Общая часть (разбор карты, точки/зоны, триггеры с wait/if, цели, звёзды, прогресс, перенос флагов и героев) —
   общее ядро кампаний _shared/campaign-core.js (копия js/campaign-core.js, подключается до этого файла; PORUB.scenario — оно же); здесь — правила
   ПОРУБЕЖЬЯ: карта миссии, стартовые силы обеих рас, условия и действия этой игры, сценарный ИИ групп, мороз «Зимнего вала», герои.
   Карта — ASCII: '.' трава, ',' вереск, '#' лес, '~' вода, '^' камни, '*' снег (вязнут), '=' лёд (проходим, строить нельзя),
   'a' янтарь, '$' смоляной ключ (левый верхний угол 2×2; остальные три клетки — земля), 't' сухостой (дрова);
   заглавная буква или цифра — именованная точка (земля под ней — def.ground или def.legend[буква]).
   def: { id, n, camp: 'wright'|'thicket'|'barrow', race, foe, title, kind, brief, map, legend, ground, zones, cold, nodeAmt,
     player: { res, build, units, start: [{ type, at, n, tag, done, hp }] }, enemy: { res, start }, groups, heroes, carry,
     objectives, stars, lose, triggers, briefMarks, flagText, needs (для заготовок: def.stub = true — «в работе», не играбельна) }.
   Условия (кроме общих): zone { zone, owner, who (тип или тег), n, all }, built { type, n, owner }, builtIn { type, zone, n },
   units { owner, type, tag, fighters, gte, lte }, trained { type, n }, gathered { type, gte }, res { k, gte, owner }, killed { tag, gte },
   gone { tag }, alive { tag, gte, lte }, heroDead { hero }, lostB / lostU { lte }, spans { gte, lte, owner }, spanLost { lte },
   cold { gte, lte }, seen { zone }, near { who, of, r } (юнит who ближе r клеток к юниту/зданию с тегом of).
   Действия: spawn { owner, type, n, at, tag, hp, tough (здание: доля урона от всех, кроме машин), locked (юнит ведёт сценарий) }, group { tag, mode: hold|patrol|attack, target, route, prey, owner }, despawn { tag },
   tiles { zone, to, from }, reveal { at, r, s }, cold { to, over }, res { owner, k, n }, allow { build, units }, build { type, at, owner, tag, done },
   ai { owner, first } (волновой ИИ скирмиша), camera { at }, ping { at }.
   Под миссии 4–7: места работ def.sites = { id: { at, r, time, who, help, helpMax, helpK, calm, off, idle (подпись цели, когда мастера нет) } } — сборка (Тихон стоит у места,
   подмастерья рядом ускоряют, враг ближе calm клеток — работа стоит), условие site { id, gte } (0…1), действие site { id, on, time };
   общая карта битвы def.battle = '<id>' (PORUB.registerBattle: map, legend, ground, zones, forces[раса] — стартовые силы по расе игрока
   и врага, если в миссии их нет); третья сторона def.third = { race, rel: { 0: 'neutral'|'ally'|'enemy', 1: … }, start } (owner 2),
   действие rel { side, with, to } (условие rel { side, with, is }); exit { tag, zone } — юниты с тегом в зоне уходят с карты (условие escaped { tag, gte }); группа mode: convoy (route — по точкам, стоят, пока враг ближе stop клеток; locked — игрок не управляет),
   follow (lead — тег/тип юнита стороны leadOwner, держатся рядом); ползущий Зимний вал — действие wall { dir, pos, speed, dps, stop }
   (game.setWall), условие wall { gte, lte } (позиция фронта в клетках); def.finale — экран итога кампании (js/campaign-ui.js).
   Мороз: def.cold = { from, to, at0, at1 } — плавно от from к to между секундами at0…at1 (game.cold 0…1): вдали от тепла
   (у Мастеровых — острог/изба/котельня/знамя, у Чащи — своя грибница) ходят медленнее, добыча и рост/стройка медленнее.
   Под кампанию Чащи: '_' на карте — вырубка (game.felled); def.night / def.wind / def.thaw, player.spore; спавн smoke / quiet; условия regrown, smokes,
   myc, night, felled, lost { type }, stat { k }; действия night, wind, spore, thaw, smoke, quiet, fell, mend; def.xcarry — флаги другой кампании
   (opts.xsave или хранилище C.store), def.finale.who — чьи реплики в итоге.
   Под кампанию Курганного рода «Голос камня» и общий финал «Весна»: 'k' — каменная россыпь, 'o' — рудная жила (2×2); def.chill = { at, dps } (буран:
   при морозе ≥ at вдали от тепла стынут), def.stoneRest = { hps } («камень хранит тепло»: окаменевшие не стынут, вал их не жжёт, раны затягиваются);
   def.fourth = { race, rel, start } — четвёртая сторона (owner 3); спавн здания asleep (идол спит: не бьёт, враги не замечают); места работ — owner;
   условия awake { tag, gte } (разбуженных идолов), stone { zone, who, n } (окаменевших в зоне), hp { tag, lte, gte } (доля прочности здания);
   действия sleep { tag }, hurt { tag, n } (урон зданию мимо брони и tough), tough { tag, k }, crush { zone, dmg, owner } (обвал: урон всем стороны owner
   в зоне), chill { at, dps } (null — снять), stoneRest { hps }; группа mode: goto (дойти до target и стоять там).
   Прогресс — localStorage 'arcade.porubezhye.campaign.<camp>' (через переданное хранилище, try/catch). Экспорт: PORUB.campaign. */
(function (root) {
  'use strict';
  var P = root.PORUB = root.PORUB || {};
  var S = P.scenario = root.HefestCampaign, TR = P.TERR, T = P.T;   // общее ядро кампаний (_shared/campaign-core.js)
  var KEY = 'arcade.porubezhye.campaign', CAMPS = ['wright', 'thicket', 'barrow'];
  function campOf(def) { return def && CAMPS.indexOf(def.camp) >= 0 ? def.camp : 'wright'; }
  function keyOf(camp) { return KEY + '.' + (CAMPS.indexOf(camp) >= 0 ? camp : 'wright'); }
  function list(camp) { return (P.MISSIONS || []).filter(function (m) { return campOf(m) === camp; }).map(resolve).sort(function (a, b) { return a.n - b.n; }); }
  function byId(id) { var a = P.MISSIONS || []; for (var i = 0; i < a.length; i++) if (a[i].id === id) return resolve(a[i]); return null; }
  function playable(def) { resolve(def); return !!def && !def.stub && !!def.map; }
  // общая карта битвы (def.battle): карта, легенда, зоны и стартовые силы по расам берутся из PORUB.BATTLES[id] — одна битва
  // в двух кампаниях; своё в миссии (зоны, силы) важнее общего
  function resolve(def) {
    if (!def || !def.battle || def._battle) return def;
    var B = (P.BATTLES || {})[def.battle]; if (!B) return def;
    def._battle = true;
    if (!def.map) { def.map = B.map; def.legend = Object.assign({}, B.legend || {}, def.legend || {}); if (def.ground == null) def.ground = B.ground; }
    def.zones = Object.assign({}, B.zones || {}, def.zones || {});
    var F = B.forces || {}, race = def.race || 'wright', foe = def.foe || (race === 'thicket' ? 'wright' : 'thicket');
    def.player = Object.assign({}, def.player || {}); def.enemy = Object.assign({}, def.enemy || {});
    if (!def.player.start && F[race]) def.player.start = F[race].slice();
    if (!def.enemy.start && F[foe]) def.enemy.start = F[foe].slice();
    if (def.player.more) def.player.start = (def.player.start || []).concat(def.player.more);
    if (def.enemy.more) def.enemy.start = (def.enemy.start || []).concat(def.enemy.more);
    return def;
  }

  // ---------- Карта ----------
  var TILE = { '.': TR.GRASS, ',': TR.HEATH, '#': TR.WOOD, '~': TR.WATER, '^': TR.ROCK, '*': TR.SNOW, '=': TR.ICE, ':': TR.BRIDGE, '_': TR.HEATH };   // '_' — вырубка (кампания Чащи: рой-опылитель растит там лес)
  var NODE = { a: 'amber', $: 'resin', t: 'timber', k: 'stone', o: 'ore' }, BIG = { resin: 1, ore: 1 };   // k, o — камень и руда Курганного рода
  function isPoint(ch) { return /[A-Z0-9]/.test(ch); }
  function parseMap(def) {
    var ground = def.ground || '.', nodes = [], felled = [];
    var m = S.parseMap(def.map, { tiles: TILE, legend: def.legend, ground: ground, id: def.id, isPoint: isPoint, under: function (ch) { return !!NODE[ch] || isPoint(ch); },
      cell: function (k, i, j, ch, base) { if (NODE[ch]) nodes.push({ type: NODE[ch], tx: i, ty: j, amt: def.nodeAmt && def.nodeAmt[NODE[ch]] }); if (ch === '_' || base === '_') felled.push(k); } });
    var w = m.w, terr = m.t;
    // под смоляным ключом (2×2) — проходимая земля
    nodes.forEach(function (n) { if (BIG[n.type]) for (var y = 0; y < 2; y++) for (var x = 0; x < 2; x++) { var k = (n.ty + y) * w + n.tx + x; if (!P.PASS[terr[k]]) terr[k] = TILE[ground]; } });
    return { w: w, h: m.h, terr: terr, nodes: nodes, points: m.points, felled: felled };
  }

  // ---------- Сборка мира миссии ----------
  // opts: { save (данные кампании), flags (доп. флаги — тесты), seed, fogOff, onEvent }
  function build(def, opts) {
    opts = opts || {}; resolve(def);
    var map = parseMap(def), save = opts.save || S.newSave(), th = def.third || null, fo = th && def.fourth || null;
    var g = new P.Game({ map: map, playerRace: def.race || 'wright', aiRace: def.foe || (def.race === 'thicket' ? 'wright' : 'thicket'), thirdRace: th && (th.race || 'thicket'), fourthRace: fo && (fo.race || 'thicket'), endRule: 'none', key: 'm:' + def.id, seed: opts.seed || def.seed || 7, fogOff: !!opts.fogOff, onEvent: opts.onEvent });
    if (th) Object.keys(th.rel || {}).forEach(function (k) { g.setRel(2, +k, th.rel[k]); });
    if (fo) Object.keys(fo.rel || {}).forEach(function (k) { g.setRel(3, +k, fo.rel[k]); });
    if (def.chill) g.chill = Object.assign({}, def.chill); if (def.stoneRest) g.stoneRest = Object.assign({}, def.stoneRest);
    var MS = S.create(def, Object.assign({}, S.carried(def, save), xcarried(def, opts.xsave), opts.flags || {}));   // xcarry — флаги другой кампании ('wright.envoy')
    MS.points = map.points; MS.game = g; MS.groups = Object.create(null);   // heroes, heroDead, spawned, killed — заводит ядро
    MS.trained = Object.create(null); MS.gath = Object.create(null); MS.lostT = Object.create(null);
    MS.spanLost = 0; MS.aiT = 0; MS.coldK = def.cold ? Object.assign({}, def.cold) : null; MS.nightK = def.night ? Object.assign({}, def.night) : null; MS.save = save;
    MS.escaped = Object.create(null); MS.sites = Object.create(null); Object.keys(def.sites || {}).forEach(function (id) { MS.sites[id] = Object.assign({ id: id, prog: 0, on: !def.sites[id].off, busy: false, hot: false }, def.sites[id]); });
    var H = MS.H = handler(MS);
    // ресурсы и что можно строить/обучать
    var pr = def.player || {}, er = def.enemy || {};
    g.res[0] = Object.assign({ a: 0, r: 0, w: 0 }, pr.res || {}); g.res[1] = Object.assign({ a: 0, r: 0, w: 0 }, er.res || {}); if (th) g.res[2] = { a: 0, r: 0, w: 0 }; if (fo) g.res[3] = { a: 0, r: 0, w: 0 };
    if (pr.build) { g.allowB = {}; pr.build.forEach(function (b) { g.allowB[b] = true; }); }
    if (pr.units) { g.allowU = {}; pr.units.forEach(function (u) { g.allowU[u] = true; }); }
    if (pr.spore) g.sporeCfg = Object.assign({}, P.SPORE, pr.spore === true ? {} : pr.spore);   // споры (кампания Чащи)
    if (def.wind) g.wind = norm(def.wind);
    if (def.thaw) g.thaw = Object.assign({}, def.thaw === true ? {} : def.thaw);
    spawnList(MS, pr.start, 0); spawnList(MS, er.start, 1); if (th) spawnList(MS, th.start, 2); if (fo) spawnList(MS, fo.start, 3);
    Object.keys(def.groups || {}).forEach(function (tag) { setGroup(MS, Object.assign({ tag: tag }, def.groups[tag])); });
    applyCold(MS); applyNight(MS);
    g._recalcMyc(); g._updateVis();
    g.mission = MS;
    MS.step = function (dt) { applyCold(MS); applyNight(MS); siteStep(MS, dt); S.step(MS, H, dt); if (MS.over) return; MS.aiT -= dt; if (MS.aiT <= 0) { MS.aiT = 0.5; Object.keys(MS.groups).forEach(function (k) { groupStep(MS, MS.groups[k]); }); } };
    MS.event = function (t, d) { onEvent(MS, t, d); };
    return g;
  }
  function spawnList(MS, list, owner0) {
    (list || []).forEach(function (s) {
      if (s.when && !S.cond(MS, MS.H, s.when)) return;   // стартовые силы по флагам прошлых миссий
      spawn(MS, Object.assign({ owner: owner0 }, s), true);
    });
  }
  function spawn(MS, s, atStart) {
    var g = MS.game, owner = s.owner == null ? 1 : s.owner, R = g.race(owner);
    if (R.buildings[s.type]) {
      var c = S.cornerOf(MS, s.at), b = g._addBuilding(owner, s.type, c.i + (s.dx || 0), c.j + (s.dy || 0), s.done !== false);
      if (s.tag) b.tag = s.tag; if (s.hp) b.hp = Math.round(b.maxhp * s.hp); if (s.tough) b.tough = s.tough;   // tough: доля урона от немашин
      if (s.smoke) { b.smoke = s.smoke; g._mycDirty = true; }
      if (s.quiet) b.quiet = true;   // сами не бьют (только приказом)
      if (s.asleep) { b.asleep = true; b.quiet = true; }   // идол спит (кампания Курганного рода): не бьёт, враги не замечают; будит F Ведогора   // дым котельни (радиус, клетки) — кампания Чащи
      if (b.done && R.grow && g.def(b).larva) b.larva = P.consts.LARVA_MAX;
      if (b.done && g.def(b).deck) g._deck(b, true);
      if (!b.done && R.grow) b.planted = true;
      return [b];
    }
    var p = S.pointOf(MS, s.at), tiles = g._freeAround(Math.floor(p.x), Math.floor(p.y), s.n || 1), out = [];
    for (var k = 0; k < (s.n || 1); k++) {
      var tl = tiles[k] || tiles[tiles.length - 1], u = g._addUnit(owner, s.type, (tl[0] + 0.5) * T, (tl[1] + 0.5) * T);
      if (s.tag) { u.tag = s.tag; S.noteSpawn(MS, s.tag); }
      if (s.hp) { u.hp = Math.round(u.maxhp * s.hp); }
      if (s.speed) u.sm = s.speed;
      if (s.locked) u.locked = true;
      if (s.quiet) u.quiet = true;   // затаился: сами враги не замечают (кампания Чащи), снимает действие quiet { tag, on: false }
      if (g.def(u).hero && owner === 0) {
        MS.heroes[s.type] = u.id;
        if (atStart && S.wounded(MS.save, s.type)) { u.hp = Math.round(u.maxhp * 0.6); u.wounded = true; }   // мягкая цена: герой пал в прошлой миссии — пришёл раненым
      }
      out.push(u);
    }
    return out;
  }
  function setGroup(MS, gr) { S.setGroup(MS, gr, { t: 0 }); }

  // ---------- Мороз ----------
  function applyCold(MS) {
    var k = MS.coldK, g = MS.game; if (!k) { g.cold = 0; return; }
    var t = g.t, a = k.at0 || 0, b = k.at1 == null ? a : k.at1, f = b > a ? Math.max(0, Math.min(1, (t - a) / (b - a))) : (t >= a ? 1 : 0);
    g.cold = Math.max(0, Math.min(1, (k.from || 0) + ((k.to == null ? k.from : k.to) - (k.from || 0)) * f));
  }

  // ночь (кампания Чащи): def.night = { from, to, at0, at1 } — как мороз; действие night { to, over }
  function applyNight(MS) {
    var k = MS.nightK, g = MS.game; if (!k) { g.night = 0; return; }
    var t = g.t, a = k.at0 || 0, b = k.at1 == null ? a : k.at1, f = b > a ? Math.max(0, Math.min(1, (t - a) / (b - a))) : (t >= a ? 1 : 0);
    g.night = Math.max(0, Math.min(1, (k.from || 0) + ((k.to == null ? k.from : k.to) - (k.from || 0)) * f));
  }
  function norm(w) { var d = Math.hypot(w.x || 0, w.y || 0) || 1; return { x: (w.x || 0) / d, y: (w.y || 0) / d }; }
  // флаги чужой кампании (def.xcarry = { wright: ['envoy'] } → 'wright.envoy', 'wright.done'): opts.xsave — { camp: сохранение } или функция;
  // иначе — из хранилища P.campaign.store (его ставит экран кампании); кампания не начата — её флагов нет
  function xcarried(def, xsave) {
    if (!def.xcarry) return {};
    return S.xcarried(def, function (camp) {
      if (xsave) return typeof xsave === 'function' ? xsave(camp) : (xsave[camp] || null);
      var st = P.campaign && P.campaign.store; if (!st) return null; var sv = load(st, camp); return Object.keys(sv.missions || {}).length ? sv : null;
    });
  }

  // ---------- Места работ (сборка шагохода и т. п.) ----------
  // работа идёт, пока у места стоит who (тип или тег, своя сторона) и рядом нет врага (calm клеток); каждый помощник help (до helpMax)
  // ускоряет на helpK (по умолчанию 35 %); мороз и знамя Ярины действуют как на стройку
  function siteStep(MS, dt) {
    var g = MS.game;
    Object.keys(MS.sites).forEach(function (id) {
      var st = MS.sites[id]; st.busy = false; st.hot = false; if (!st.on || st.prog >= 1) return;
      var c = S.pointOf(MS, st.at), cx = c.x * T, cy = c.y * T, r = (st.r || 2.5) * T, calm = (st.calm == null ? 4 : st.calm) * T;
      var near = function (u) { return Math.hypot(u.x - cx, u.y - cy) <= r && (u.ord.t === 'idle' || u.ord.t === 'repair' || u.ord.t === 'build'); };
      var so = st.owner || 0, mine = g.ents.filter(function (u) { return !u.dead && u.kind === 'u' && u.owner === so; });   // owner — чьё место (союзник в «Весне»)
      var main = mine.filter(function (u) { return match(u, st.who || 'tikhon') && near(u); })[0];
      if (!main) return;
      st.hot = g.ents.some(function (e) { return !e.dead && e.kind === 'u' && g.hostile(so, e.owner) && !g.def(e).civil && Math.hypot(e.x - cx, e.y - cy) <= calm; });
      if (st.hot) return;
      var help = Math.min(st.helpMax == null ? 2 : st.helpMax, mine.filter(function (u) { return u !== main && match(u, st.help || 'worker') && near(u); }).length);
      st.busy = true; main.work = true;
      st.prog = Math.min(1, st.prog + dt / (st.time || 120) * (1 + (st.helpK == null ? 0.35 : st.helpK) * help) * (st.noCold ? 1 : g.coldGrow(so)) * (g.bannerAt(so, cx, cy) ? P.BANNER.mul : 1));
      if (st.prog >= 1) MS.ui.push({ t: 'siteDone', id: id });
    });
  }

  // ---------- Условия и действия ПОРУБЕЖЬЯ ----------
  function alive(g, owner) { return g.ents.filter(function (e) { return !e.dead && (owner == null || e.owner === owner); }); }
  function match(u, who) { if (Array.isArray(who)) return who.some(function (w) { return match(u, w); }); return !who || who === 'any' || u.type === who || u.tag === who; }
  // привязка ядра к игре: время — game.t, исход — game.end; условия и действия — словари CONDS / ACTS (ctx — объект игры)
  function handler(MS) {
    return S.handler({ ctx: MS.game, now: function () { return MS.game.t; },
      end: function (win) { MS.result = result(MS, win); MS.game.end(win ? 0 : 1); }, conds: CONDS, acts: ACTS });
  }
  function num(n, c) { return (c.gte == null || n >= c.gte) && (c.lte == null || n <= c.lte); }
  function own(c) { return c.owner == null ? 0 : c.owner; }
  // общие time/obj/since/flag/heroDead/killed/all/any/not — в ядре
  var CONDS = {
    zone: function (g, c, MS) {
      var o = own(c), inside = 0, total = 0;
      g.ents.forEach(function (u) { if (u.dead || u.kind !== 'u' || u.owner !== o || !match(u, c.who)) return; total++; if (S.inZone(MS, c.zone, u.x / T, u.y / T)) inside++; });
      return c.all ? total > 0 && inside === total : inside >= (c.n || 1);
    },
    built: function (g, c) { return g.count(own(c), 'b', c.type, function (b) { return b.done; }) >= (c.n || 1); },
    builtIn: function (g, c, MS) { return g.count(own(c), 'b', c.type, function (b) { return b.done && S.inZone(MS, c.zone, b.x / T, b.y / T); }) >= (c.n || 1); },
    units: function (g, c) { var n = alive(g, own(c)).filter(function (u) { return u.kind === 'u' && (!c.type || u.type === c.type) && (!c.tag || u.tag === c.tag) && (!c.fighters || (!g.def(u).worker && !g.def(u).civil && !g.def(u).passive)); }).length; return num(n, c) && (c.n == null || n >= c.n); },
    trained: function (g, c, MS) { return (MS.trained[c.type] || 0) >= (c.n || 1); },
    gathered: function (g, c, MS) { return (MS.gath[c.type || '*'] || 0) >= c.gte; },
    res: function (g, c) { return g.res[own(c)][c.k] >= c.gte; },
    gone: function (g, c, MS) { return (MS.spawned[c.tag] || 0) > 0 && !g.ents.some(function (e) { return !e.dead && e.tag === c.tag; }); },
    alive: function (g, c) { var tags = [].concat(c.tag); return num(g.ents.filter(function (e) { return !e.dead && tags.indexOf(e.tag) >= 0; }).length, c); },
    lostB: function (g, c) { return g.stats[0].lostB <= (c.lte || 0); },
    lostU: function (g, c) { return g.stats[0].lost - g.stats[0].lostB <= (c.lte || 0); },
    spans: function (g, c) { return num(g.decks(own(c)).filter(function (b) { return b.done; }).length, c); },
    spanLost: function (g, c, MS) { return MS.spanLost <= (c.lte || 0); },
    cold: function (g, c) { return (c.gte == null || g.cold >= c.gte - 1e-6) && (c.lte == null || g.cold <= c.lte + 1e-6); },
    seen: function (g, c, MS) { var zc = S.zoneCenter(MS, c.zone); return g.tileVis(0, Math.floor(zc.x), Math.floor(zc.y)) === 2; },
    escaped: function (g, c, MS) { return [].concat(c.tag).reduce(function (n, tg) { return n + (MS.escaped[tg] || 0); }, 0) >= (c.gte || 1); },   // tag — тег или список
    site: function (g, c, MS) { var st = MS.sites[c.id]; return !!st && st.prog >= (c.gte == null ? 1 : c.gte) - 1e-9; },
    wall: function (g, c) { var w = g.wall; if (!w) return false; return (c.gte == null || w.pos >= c.gte) && (c.lte == null || w.pos <= c.lte); },
    rel: function (g, c) { return g.relOf(c.side == null ? 2 : c.side, c.with == null ? 0 : c.with) === c.is; },
    // кампания Чащи: regrown { gte } — клеток леса выращено роем; smokes { lte, gte } — дымящих котелен; myc { zone, gte } — клеток своей грибницы в зоне;
    // night { gte, lte }; felled { lte } — клеток вырубки осталось (в зоне — zone)
    lost: function (g, c, MS) { return num(MS.lostT[c.type] || 0, c); },   // lost { type, lte } — своих такого типа погибло
    stat: function (g, c) { return num(g.stats[own(c)][c.k] || 0, c); },   // stat { k, gte, lte } — счётчик стороны (regrown, sporeLost, kills…)
    regrown: function (g, c) { return num(g.stats[own(c)].regrown || 0, c); },
    smokes: function (g, c) { return num(g.ents.filter(function (b) { return !b.dead && b.kind === 'b' && b.smoke && (!c.tag || b.tag === c.tag); }).length, c); },
    myc: function (g, c, MS) { var M = g.myc[own(c)], n = 0; S.zoneCells(MS, c.zone, g.MW, g.MH).forEach(function (q) { if (M[q.j * g.MW + q.i]) n++; }); return n >= (c.gte || 1); },
    night: function (g, c) { return (c.gte == null || g.night >= c.gte - 1e-6) && (c.lte == null || g.night <= c.lte + 1e-6); },
    felled: function (g, c, MS) { var n = 0; if (c.zone) S.zoneCells(MS, c.zone, g.MW, g.MH).forEach(function (q) { var k = q.j * g.MW + q.i; if (g.felled[k] && P.PASS[g.terr[k]]) n++; }); else n = g.felledLeft(); return num(n, c); },
    // кампания Курганного рода: awake { tag, gte } — разбуженных идолов (здания с тегом, не спят); stone { zone, who, n } — окаменевших в зоне;
    // hp { tag, lte, gte } — доля прочности первого здания/юнита с тегом
    awake: function (g, c) { var tags = [].concat(c.tag); return num(g.ents.filter(function (b) { return !b.dead && b.kind === 'b' && tags.indexOf(b.tag) >= 0 && !b.asleep; }).length, c.gte == null && c.lte == null ? { gte: 1 } : c); },
    stone: function (g, c, MS) { var o = own(c); return g.ents.filter(function (u) { return !u.dead && u.kind === 'u' && u.owner === o && u.stone && match(u, c.who) && (!c.zone || S.inZone(MS, c.zone, u.x / T, u.y / T)); }).length >= (c.n || 1); },
    hp: function (g, c) { var e = g.ents.filter(function (x) { return !x.dead && x.tag === c.tag; })[0]; return !!e && num(e.hp / e.maxhp, c); },
    near: function (g, c) {
      var who = alive(g, own(c)).filter(function (u) { return u.kind === 'u' && match(u, c.who); }), of = g.ents.filter(function (e) { return !e.dead && e.tag === c.of; }), r = (c.r || 3) * T;
      return who.some(function (u) { return of.some(function (e) { return g.distTo(u, e) <= r; }); });
    }
  };
  // общие wait/if/say/msg/objective/flag/win/lose — в ядре
  var ACTS = {
    spawn: function (g, a, MS) { spawn(MS, a); },
    group: function (g, a, MS) { setGroup(MS, Object.assign({}, a, { a: undefined })); },
    despawn: function (g, a) { g.ents.forEach(function (e) { if (!e.dead && e.tag === a.tag) g._kill(e, null, true); }); },
    tiles: function (g, a, MS) { var to = TILE[a.to], from = a.from != null ? TILE[a.from] : null;
      var cells = S.zoneCells(MS, a.zone, g.MW, g.MH).filter(function (c) { return from == null || g.terr[c.j * g.MW + c.i] === from; }).map(function (c) { return [c.i, c.j]; });
      g.setTiles(cells, to); },
    reveal: function (g, a, MS) { var rp = S.pointOf(MS, a.at); g.flares.push({ x: rp.x * T, y: rp.y * T, r: a.r || 5, until: g.t + (a.s || 8) }); g._visT = 0; },
    cold: function (g, a, MS) { MS.coldK = { from: g.cold, to: a.to, at0: g.t, at1: g.t + (a.over || 0) }; },
    res: function (g, a) { g.res[a.owner || 0][a.k || 'a'] += a.n; },
    allow: function (g, a) { if (a.build) { g.allowB = g.allowB || {}; a.build.forEach(function (b) { g.allowB[b] = true; }); } if (a.units) { g.allowU = g.allowU || {}; a.units.forEach(function (u) { g.allowU[u] = true; }); } },
    build: function (g, a, MS) { spawn(MS, Object.assign({ owner: 0 }, a, { a: undefined })); },
    site: function (g, a, MS) { var ss = MS.sites[a.id]; if (!ss) throw new Error('нет места работ ' + a.id); if (a.on != null) ss.on = !!a.on; if (a.time) ss.time = a.time; if (a.prog != null) ss.prog = a.prog; },
    rel: function (g, a) { g.setRel(a.side == null ? 2 : a.side, a.with == null ? 0 : a.with, a.to); g.ents.forEach(function (e) { if (e.kind !== 'u' || e.dead) return; var tt = e.tgt && g.get(e.tgt); if (tt && !g.hostile(e.owner, tt.owner)) e.tgt = 0; var ot = e.ord.t === 'attack' && g.get(e.ord.id); if (ot && g.relOf(e.owner, ot.owner) === 'ally') g._order(e, { t: 'idle' }); }); },
    wall: function (g, a) { var wo = Object.assign({}, a); delete wo.a; g.setWall(wo); },
    wallOff: function (g) { g.setWall(null); },
    // кампания Чащи: night { to, over }, wind { x, y } (null — штиль), spore { on, range, wind, cost, cd }, thaw { on, … }, smoke { tag, r } (0 — погасить),
    // fell { zone } — клетки травы/вереска/леса в зоне → вырубка (лес — вереск со пнями)
    quiet: function (g, a) { g.ents.forEach(function (e) { if (!e.dead && e.tag === a.tag) e.quiet = a.on !== false; }); },
    mend: function (g, a) { var b = g.ents.filter(function (e) { return !e.dead && e.kind === 'b' && e.tag === a.of; })[0]; if (!b || b.hp >= b.maxhp) return;   // mend { tag, of } — рабочие с тегом чинят здание с тегом of
      g.ents.forEach(function (u) { if (!u.dead && u.kind === 'u' && u.tag === a.tag && u.ord.t === 'idle' && g.def(u).worker) g.cmd(u.owner, { t: 'repair', ids: [u.id], target: b.id, sys: true }); }); },
    night: function (g, a, MS) { MS.nightK = { from: g.night, to: a.to, at0: g.t, at1: g.t + (a.over || 0) }; },
    wind: function (g, a) { g.wind = a.x == null && a.y == null ? null : norm(a); },
    spore: function (g, a) { if (a.on === false) { g.sporeCfg = null; return; } var o = Object.assign({}, a); delete o.a; delete o.on; g.sporeCfg = Object.assign({}, g.sporeCfg || P.SPORE, o); },
    thaw: function (g, a) { if (a.on === false) { g.thaw = null; return; } var o = Object.assign({}, a); delete o.a; delete o.on; g.thaw = Object.assign({}, g.thaw || {}, o); },
    smoke: function (g, a) { g.ents.forEach(function (b) { if (!b.dead && b.kind === 'b' && b.tag === a.tag) b.smoke = a.r || 0; }); g._mycDirty = true; },
    fell: function (g, a, MS) { var cells = []; S.zoneCells(MS, a.zone, g.MW, g.MH).forEach(function (q) { var k = q.j * g.MW + q.i, t = g.terr[k]; if ((t === TR.GRASS || t === TR.HEATH || t === TR.WOOD) && !g.occ[k]) { g.felled[k] = 1; cells.push([q.i, q.j]); } }); g.setTiles(cells, TR.HEATH); g.terrRev++; },
    // кампания Курганного рода
    sleep: function (g, a) { var tags = [].concat(a.tag); g.ents.forEach(function (b) { if (!b.dead && b.kind === 'b' && tags.indexOf(b.tag) >= 0) { b.asleep = true; b.quiet = true; } }); },
    hurt: function (g, a) { g.ents.forEach(function (e) { if (!e.dead && e.tag === a.tag && e.kind !== 'n') { e.hp -= a.n; e.hitT = g.t; if (e.hp <= 0) g._kill(e, null); } }); },
    tough: function (g, a) { g.ents.forEach(function (e) { if (!e.dead && e.tag === a.tag) e.tough = a.k; }); },
    crush: function (g, a, MS) { var o = a.owner == null ? 1 : a.owner; g.ents.slice().forEach(function (e) { if (e.dead || e.kind !== 'u' || e.owner !== o || !S.inZone(MS, a.zone, e.x / T, e.y / T)) return; g._damage(e, a.dmg || 200, null); }); },
    chill: function (g, a) { g.chill = a.dps ? { at: a.at || 0, dps: a.dps } : null; },
    stoneRest: function (g, a) { g.stoneRest = a.hps ? { hps: a.hps } : null; },
    exit: function (g, a, MS) { g.ents.forEach(function (e) { if (!e.dead && e.kind === 'u' && e.tag === a.tag && S.inZone(MS, a.zone, e.x / T, e.y / T)) { e.tag = null; g._kill(e, null, true); MS.escaped[a.tag] = (MS.escaped[a.tag] || 0) + 1; /* ушёл — не «убит» */ } }); },
    ai: function (g, a) { g.ai = new P.AI(g, a.owner == null ? 1 : a.owner); if (a.first != null) g.ai.nextWave = a.first; },
    camera: function (g, a, MS) { var cp = S.pointOf(MS, a.at); MS.ui.push({ t: a.a, x: cp.x * T, y: cp.y * T }); },
    ping: function (g, a, MS) { var cp = S.pointOf(MS, a.at); MS.ui.push({ t: a.a, x: cp.x * T, y: cp.y * T }); }
  };

  // ---------- События мира ----------
  function onEvent(MS, t, d) {
    if (t === 'death') {
      S.noteKill(MS, d.tag);
      if (d.hero && d.p === 0) { MS.heroDead[d.type] = true; MS.ui.push({ t: 'heroDown', who: d.type }); }
      if (d.p === 0 && !d.silent) MS.lostT[d.type] = (MS.lostT[d.type] || 0) + 1;
      if (d.type === 'span' && d.p === 0 && !d.silent) { MS.spanLost++; MS.ui.push({ t: 'spanLost' }); }
    } else if (t === 'trained' && d.p === 0) MS.trained[d.type] = (MS.trained[d.type] || 0) + 1;
    else if (t === 'deposit' && d.p === 0) { MS.gath[d.type] = (MS.gath[d.type] || 0) + d.amt; MS.gath['*'] = (MS.gath['*'] || 0) + d.amt; }
  }

  // ---------- Сценарный ИИ групп ----------
  // hold — стоят на посту (бойцы сами отвечают в обзоре и возвращаются); patrol — по точкам route; attack — к target, потом на
  // ближайшего врага; prey — охота за юнитами игрока с тегом/типом (например, на лесорубов). Обстреляли — группа поднимается.
  function groupStep(MS, gr) {
    var g = MS.game, mem = g.ents.filter(function (u) { return !u.dead && u.kind === 'u' && u.tag === gr.tag && u.owner === gr.owner; });
    if (!mem.length) return;
    var fighters = mem.filter(function (u) { return !g.def(u).worker && !g.def(u).civil && !g.def(u).passive; }), idle = fighters.filter(function (u) { return u.ord.t === 'idle' && !u.tgt; });
    var ids = function (l) { return l.map(function (u) { return u.id; }); };
    if (gr.mode === 'convoy') return convoyStep(MS, gr, mem);
    if (gr.mode === 'follow') return followStep(MS, gr, mem);
    if (gr.mode === 'goto') { var gp = S.pointOf(MS, gr.target), far = mem.filter(function (u) { return u.ord.t === 'idle' && !u.tgt && Math.hypot(u.x - gp.x * T, u.y - gp.y * T) > (gr.r || 2.5) * T; });   // дойти до target и стоять
      if (far.length) g.cmd(gr.owner, { t: gr.calm ? 'move' : 'amove', ids: ids(far), x: gp.x * T, y: gp.y * T, sys: true }); return; }
    if (!gr.alerted && mem.some(function (u) { return g.t - u.hitT < 2; })) { gr.alerted = true; if (gr.mode === 'hold') MS.ui.push({ t: 'alert', tag: gr.tag, race: g.races[gr.owner] }); } // «встревожена» — только стража на посту
    if (gr.mode === 'hold') {
      if (gr.alerted && idle.length) { var hit = mem.filter(function (u) { return g.t - u.hitT < 3; })[0]; if (hit) g.cmd(gr.owner, { t: 'amove', ids: ids(idle), x: hit.x, y: hit.y, sys: true }); }
    } else if (gr.mode === 'patrol' && gr.route && gr.route.length) {
      if (!fighters.some(function (u) { return u.ord.t !== 'idle' || u.tgt; })) { gr.ri = (gr.ri + 1) % gr.route.length; var pp = S.pointOf(MS, gr.route[gr.ri]); g.cmd(gr.owner, { t: 'amove', ids: ids(fighters), x: pp.x * T, y: pp.y * T, sys: true }); }
    } else if (gr.mode === 'attack') {
      gr.t -= 0.5;
      var foe = function (e) { return !e.dead && g.hostile(gr.owner, e.owner) && (e.kind === 'u' || e.kind === 'b'); };
      var goers = gr.prey ? fighters.filter(function (u) { return !u.tgt; }) : idle;
      if (!goers.length || (gr.prey && gr.t > 0)) return;
      gr.t = 2.5;
      var c0 = goers[0], goal = null;
      if (gr.prey) goal = nearest(g, c0, function (e) { return foe(e) && e.kind === 'u' && (e.tag === gr.prey || e.type === gr.prey); });
      if (!goal && gr.target && !gr.reached) { var tp = S.pointOf(MS, gr.target); if (Math.hypot(c0.x - tp.x * T, c0.y - tp.y * T) > 3 * T) goal = { x: tp.x * T, y: tp.y * T }; else gr.reached = true; }
      if (!goal) goal = nearest(g, c0, foe);
      if (goal) g.cmd(gr.owner, { t: 'amove', ids: ids(goers), x: goal.x, y: goal.y, sys: true });
    }
  }
  // колонна: идёт по точкам route; враг ближе stop клеток к любому — встаёт (ui 'convoyStop'), чисто — идёт дальше; дошла — gr.arrived
  function convoyStep(MS, gr, mem) {
    var g = MS.game, stopR = (gr.stop || 6) * T, route = gr.route || [];
    var danger = mem.some(function (u) { return g.ents.some(function (e) { return !e.dead && e.kind === 'u' && g.hostile(gr.owner, e.owner) && Math.hypot(e.x - u.x, e.y - u.y) <= stopR; }); });
    if (danger) { if (!gr.halted) { gr.halted = true; MS.ui.push({ t: 'convoyStop', tag: gr.tag }); } mem.forEach(function (u) { if (u.ord.t !== 'idle') g._order(u, { t: 'idle' }); }); return; }
    if (gr.halted) { gr.halted = false; MS.ui.push({ t: 'convoyGo', tag: gr.tag }); }
    if (gr.ri >= route.length) { gr.arrived = true; return; }
    var pt = S.pointOf(MS, route[gr.ri]), px = pt.x * T, py = pt.y * T;
    var far = function (u) { return Math.hypot(u.x - px, u.y - py) > (gr.arrive || 3) * T; };
    if (!mem.some(far)) { gr.ri++; gr.issued = -1; return; }
    if (gr.issued !== gr.ri || mem.some(function (u) { return u.ord.t === 'idle' && far(u); })) { gr.issued = gr.ri; g.cmd(gr.owner, { t: 'move', ids: mem.filter(far).map(function (u) { return u.id; }), x: px, y: py, sys: true }); }
  }
  // сопровождение: держаться рядом с ведущим (lead — тип или тег юнита стороны leadOwner)
  function followStep(MS, gr, mem) {
    var g = MS.game, lo = gr.leadOwner == null ? 0 : gr.leadOwner;
    var L = g.ents.filter(function (e) { return !e.dead && e.kind === 'u' && e.owner === lo && match(e, gr.lead); })[0]; if (!L) return;
    mem.forEach(function (u) { var d = Math.hypot(u.x - L.x, u.y - L.y); if (d > (gr.r || 2) * T && (u.ord.t === 'idle' || d > 4 * T)) g.cmd(gr.owner, { t: 'move', ids: [u.id], x: L.x - L.fx * 1.4 * T, y: L.y - L.fy * 1.4 * T, sys: true }); });
  }
  function nearest(g, u, pred) { var best = null, bd = 1e9; g.ents.forEach(function (e) { if (!pred(e)) return; var d = Math.hypot(e.x - u.x, e.y - u.y); if (d < bd) { bd = d; best = e; } }); return best; }

  // ---------- Итог ----------
  function result(MS, win) {
    var g = MS.game, st = g.stats[0], heroes = S.heroesOf(MS);
    return { id: MS.def.id, n: MS.def.n, camp: campOf(MS.def), win: !!win, reason: MS.reason, time: g.t, stars: S.stars(MS, MS.H, win), flags: Object.assign({}, MS.flags),
      heroes: heroes, lostU: st.lost - st.lostB, lostB: st.lostB, kills: st.kills, wood: st.wood };
  }

  // ---------- Прогресс ----------
  function load(store, camp) { return S.load(store, keyOf(camp)); }
  function save(store, camp, data) { return S.save(store, keyOf(camp), data); }
  function reset(store, camp) { return S.reset(store, keyOf(camp)); }
  function applyResult(data, res) { return S.applyResult(data, res); }
  // открыта ли миссия: играбельна и (номер ≤ открытых) — издание решает отдельно (Edition.playable, если есть)
  function nodeState(def, data) { if (!playable(def)) return 'later'; return S.nodeState(def, data); }

  P.campaign = { KEY: KEY, CAMPS: CAMPS, keyOf: keyOf, campOf: campOf, list: list, byId: byId, playable: playable, parseMap: parseMap, build: build,
    spawn: spawn, cond: function (g, c) { return S.cond(g.mission, g.mission.H, c); }, act: function (g, a) { S.act(g.mission, g.mission.H, a); },
    result: result, load: load, save: save, reset: reset, xcarried: xcarried,
    zoneCellsOf: function (MS, z, g) { var zz = (MS.def.zones || {})[z]; if (!zz) return []; return S.zoneCells(MS, z, g.MW, g.MH).map(function (q) { return q.j * g.MW + q.i; }); }, applyResult: applyResult, nodeState: nodeState, txt: S.txt, pointOf: S.pointOf, inZone: S.inZone, zoneCenter: S.zoneCenter, zoneRadius: S.zoneRadius };
})(typeof window !== 'undefined' ? window : globalThis);
