/* ВЗВОД · кампания (без DOM): список болванчиков мастерской, опыт и ранги, ремонтный фонд, пополнение, сохранение.
   Правила:
   - сломанный в миссии болванчик уезжает на ремонт: пропускает следующую миссию, затем возвращается, если в ремонтном
     фонде есть REPAIR_COST (иначе ждёт, пока фонд пополнится); фонд: +3 и +1 за улей при успехе, +1 при неудаче;
   - после каждой миссии мастерская собирает новобранцев (успех +2, неудача +1, пока в мастерской < ROSTER_MAX);
   - перед миссией в строю всегда ≥ MIN_SQUAD: если не хватает — «срочная сборка» новобранцев, а при полной мастерской —
     бесплатный срочный ремонт (дедлока «отряд кончился» нет, мастерская не раздувается);
   - опыт: +2 за миссию без поломки, +1 за каждый уничтоженный механизм; ранг по порогам logic.RANK_XP.
   Сохранение — localStorage 'arcade.vzvod.save' (JSON, версия 1, с проверкой полей). VZVOD.Camp */
(function (global) {
  'use strict';
  var V = global.VZVOD = global.VZVOD || {};
  var KEY = 'arcade.vzvod.save', VER = 1;
  var REPAIR_COST = 2, ROSTER_MAX = 12, MIN_SQUAD = 2, NAMES_N = 24;

  function L() { return V.logic; }
  function recruit(c) {
    var id = c.nextId++;
    var b = { id: id, ni: (id - 1) % NAMES_N, gen: Math.floor((id - 1) / NAMES_N) + 1, xp: 0, rank: 0, state: 'ready', wait: 0, missions: 0, kills: 0 };
    c.roster.push(b); return b;
  }
  function newCampaign() {
    var c = { v: VER, op: 0, mi: 0, roster: [], nextId: 1, fund: 4, score: 0, missions: 0, wins: 0, fails: 0, done: false };
    for (var i = 0; i < 4; i++) recruit(c);
    return c;
  }
  function ready(c) { return c.roster.filter(function (b) { return b.state === 'ready'; }); }
  function inWorkshop(c) { return c.roster.length; }
  function spec(c) { return L().mission(c.op, c.mi); }
  // Перед брифингом: ремонт (если фонд позволяет) и срочная сборка до MIN_SQUAD
  function prepare(c) {
    var rep = { repaired: [], emergency: [], waiting: [] };
    var queue = c.roster.filter(function (b) { return b.state === 'repair' && b.wait <= 0; }).sort(function (a, b) { return b.xp - a.xp || a.id - b.id; });
    queue.forEach(function (b) {
      if (c.fund >= REPAIR_COST) { c.fund -= REPAIR_COST; b.state = 'ready'; rep.repaired.push(b.id); }
      else rep.waiting.push(b.id);
    });
    // срочная сборка: новобранец, а если мастерская полна — бесплатный срочный ремонт самого «скорого» из очереди
    while (ready(c).length < MIN_SQUAD) {
      var wait = c.roster.filter(function (b) { return b.state === 'repair'; }).sort(function (a, b) { return a.wait - b.wait || b.xp - a.xp || a.id - b.id; });
      if (c.roster.length >= ROSTER_MAX && wait.length) { wait[0].state = 'ready'; wait[0].wait = 0; rep.emergency.push(wait[0].id); }
      else rep.emergency.push(recruit(c).id);
    }
    return rep;
  }
  function squadFor(c) {
    var cap = spec(c) ? spec(c).squad : 4;
    return ready(c).sort(function (a, b) { return b.xp - a.xp || a.id - b.id; }).slice(0, cap);
  }
  // Итог миссии → опыт, ранги, ремонт, фонд, пополнение, переход к следующей миссии
  function apply(c, res, squadIds) {
    var rep = { won: !!res.won, promos: [], broken: [], recruits: [], fund: 0, xp: {} };
    var byId = {}; (res.units || []).forEach(function (u) { byId[u.id] = u; });
    c.roster.forEach(function (b) {
      if (squadIds.indexOf(b.id) >= 0) {
        var u = byId[b.id] || { alive: true, kills: 0 }, gain = (u.kills | 0) + (u.alive ? 2 : 0);
        b.xp += gain; b.kills += u.kills | 0; b.missions++; rep.xp[b.id] = gain;
        var nr = L().rankOf(b.xp); if (nr > b.rank) { b.rank = nr; rep.promos.push(b.id); }
        if (!u.alive) { b.state = 'repair'; b.wait = 1; rep.broken.push(b.id); }
      } else if (b.state === 'repair') b.wait = Math.max(0, b.wait - 1);
    });
    rep.fund = res.won ? 3 + (res.hives | 0) : 1; c.fund += rep.fund;
    c.score += res.score | 0; c.missions++;
    if (res.won) {
      c.wins++; c.mi++;
      if (c.mi >= L().OPS[c.op].missions.length) { c.op++; c.mi = 0; rep.opDone = true; }
      if (c.op >= L().OPS.length) { c.done = true; c.op = L().OPS.length - 1; c.mi = L().OPS[c.op].missions.length - 1; }
    } else c.fails++;
    var n = res.won ? 2 : 1;
    while (n-- > 0 && inWorkshop(c) < ROSTER_MAX) rep.recruits.push(recruit(c).id);
    return rep;
  }
  function valid(c) {
    if (!c || c.v !== VER || !Array.isArray(c.roster)) return false;
    var O = L().OPS; if (!(c.op >= 0 && c.op < O.length && c.mi >= 0 && c.mi < O[c.op].missions.length)) return false;
    if (!(c.nextId > 0) || !(c.fund >= 0) || !(c.score >= 0)) return false;
    return c.roster.every(function (b) { return b && b.id > 0 && b.ni >= 0 && b.ni < NAMES_N && b.xp >= 0 && b.rank >= 0 && b.rank <= 5 && (b.state === 'ready' || b.state === 'repair'); });
  }
  function save(Store, c) { Store.set(KEY, JSON.stringify(c)); }
  function load(Store) { try { var c = JSON.parse(Store.get(KEY, 'null')); return valid(c) && !c.done ? c : null; } catch (e) { return null; } }
  function clear(Store) { try { if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY); } catch (e) {} Store.set(KEY, 'null'); }

  V.Camp = { KEY: KEY, VER: VER, REPAIR_COST: REPAIR_COST, ROSTER_MAX: ROSTER_MAX, MIN_SQUAD: MIN_SQUAD, NAMES_N: NAMES_N,
    newCampaign: newCampaign, recruit: recruit, prepare: prepare, squadFor: squadFor, apply: apply, ready: ready, spec: spec,
    valid: valid, save: save, load: load, clear: clear };
})(typeof window !== 'undefined' ? window : globalThis);
