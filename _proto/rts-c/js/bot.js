/* ГАТЬ · бот-игрок (для тестов проходимости и ?bot=1). Принимает решения не чаще, чем раз в 150–250 мс
   (время реакции), и пользуется тем же API, что и ввод игрока: order / hire / upgrade / build / ability. */
(function (root) {
  'use strict';
  var GAT = root.GAT = root.GAT || {};
  function makeBot(S, seed) {
    var L = GAT.logic, r = L.rng(seed || 99), wait = 0, lastGoal = null, reissue = 0, plan = ['shield', 'bow', 'cart', 'bow'], decisions = 0;
    function d2(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }
    function army() { return S.squads.filter(function (s) { return L.alive(s); }); }
    function center() { var h = S.hero; if (!h.dead) return { x: h.x, y: h.y }; var a = army()[0]; return a ? { x: a.ax, y: a.ay } : S.home; }
    function strength() { var have = 0, max = 0; S.squads.forEach(function (s) { if (s.type === 'hero') return; have += s.members.filter(function (u) { return !u.dead; }).length; max += L.SQUADS[s.type].n; }); return max ? have / max : 0; }
    function foesNear(p, R) { return S.units.filter(function (u) { return !u.dead && u.side === 1 && !L.KINDS[u.kind].still && d2(u, p) < R * R; }); }
    function think() {
      decisions++;
      var c = center(), mine = S.points.filter(function (p) { return p.owner === 1; });
      // экономика: найм у ближайшей своей вехи
      if (L.armyCount(S) < L.MAX_SQUADS) {
        var type = plan[L.armyCount(S) % plan.length];
        if (S.supply >= L.SQUADS[type].cost) {
          var at = mine.slice().sort(function (a, b) { return d2(a, c) - d2(b, c); })[0];
          if (at) { var res = L.hire(S, at.id, type); if (res.ok) { L.order(S, [res.squad.id], { k: 'move', x: c.x, y: c.y }); return; } }
        }
      }
      // улучшение отряда, стоящего на своей вехе
      for (var i = 0; i < mine.length; i++) {
        var sqs = L.squadsAt(S, mine[i]);
        for (var j = 0; j < sqs.length; j++) if (sqs[j].level < 3 && S.supply >= L.upCost(sqs[j]) + 60 && L.armyCount(S) >= 3) { if (L.upgrade(S, mine[i].id, sqs[j].id).ok) return; }
      }
      // постройки: вышка дома, дальше костры/амбары
      for (var k = 0; k < mine.length; k++) if (!mine[k].building) {
        var kind = mine[k].home ? 'tower' : (k % 2 ? 'barn' : 'fire');
        if (S.supply >= L.BUILD[kind] + (L.armyCount(S) < 3 ? 120 : 30)) { if (L.build(S, mine[k].id, kind).ok) return; }
      }
      // способности
      var h = S.hero;
      if (!h.dead) {
        var foes = foesNear(h, 260);
        if (h.cdQ <= 0 && foes.length) {
          var tgt = S.boss && !S.boss.dead && d2(S.boss, h) < 280 * 280 ? S.boss : foes.sort(function (a, b) { return foesNear(b, 70).length - foesNear(a, 70).length; })[0];
          if (h.hero.id === 'v' || d2(tgt, h) < 240 * 240) { L.ability(S, 'q', tgt.x, tgt.y); return; }
        }
        if (h.cdE <= 0) {
          var hurt = S.units.filter(function (u) { return u.side === 0 && !u.dead && u.hp < u.maxHp * 0.6 && d2(u, h) < 170 * 170; }).length;
          if ((h.hero.id === 'v' && (hurt >= 3 || h.hp < h.maxHp * 0.5)) || (h.hero.id === 'z' && foes.length >= 3)) { L.ability(S, 'e'); return; }
        }
      }
      // куда вести войско
      var goal = null, attack = null;
      var home = S.home, threat = foesNear(home, home.r + 120);
      var weak = strength() < 0.45 && !S.bossSpawned;
      if (threat.length >= 2 && (home.prog < 0.7 || !S.boss)) goal = home;
      else if (S.boss && !S.boss.dead) attack = S.boss;
      else if (weak) goal = mine.filter(function (p) { return p.building === 'fire'; }).concat(mine).sort(function (a, b) { return d2(a, c) - d2(b, c); })[0];
      else {
        var todo = S.points.filter(function (p) { return p.owner !== 1; }).sort(function (a, b) { return d2(a, c) - d2(b, c); });
        var lost = mine.filter(function (p) { return p.foes > 0 && !p.home; })[0];
        var p = lost || todo[0];
        if (p) { if (p.nest && !p.nest.dead) attack = p.nest; else goal = p; }
        else goal = home;
      }
      var key = attack ? 'a' + attack.id : (goal ? goal.id : '');
      reissue -= 1;
      var ids = army().map(function (s) { return s.id; });
      if (key !== lastGoal || reissue <= 0) {
        lastGoal = key; reissue = 14;
        if (attack) L.order(S, ids, { k: 'attack', tid: attack.id });
        else if (goal) L.order(S, ids, { k: 'move', x: goal.x, y: goal.y });
      }
    }
    return {
      get decisions() { return decisions; },
      update: function (dt) { wait -= dt; if (wait > 0) return; wait = 0.15 + r() * 0.1; think(); },
    };
  }
  GAT.makeBot = makeBot;
})(typeof window !== 'undefined' ? window : globalThis);
