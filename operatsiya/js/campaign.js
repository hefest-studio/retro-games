/* ОПЕРАЦИЯ · кампания: бригада из 6 механиков, опыт и уровни между миссиями, снаряжение (вес → ОД), сохранение.
   OPERATSIYA.Camp. Ключи localStorage: arcade.operatsiya.save (кампания), arcade.operatsiya.battle (бой на начале хода),
   arcade.operatsiya.diff (сложность). Рекорд — arcade.best.operatsiya (движок). */
(function (global) {
  'use strict';
  var O = global.OPERATSIYA = global.OPERATSIYA || {};
  var KEY = 'arcade.operatsiya.save', BKEY = 'arcade.operatsiya.battle';
  // Базовые статы: меткость, ОД, выносливость (переносимый вес, остывание, стойкость к перегреву), прочность.
  var ROSTER = [
    { id: 'tim', ni: 0, acc: 56, ap: 26, stam: 50, hp: 10, load: { weapon: 'rivet', gear: 2, kit: 0, clips: 1 } },
    { id: 'var', ni: 1, acc: 66, ap: 24, stam: 40, hp: 9, load: { weapon: 'rivet', gear: 0, kit: 1, clips: 1 } },
    { id: 'gor', ni: 2, acc: 48, ap: 22, stam: 70, hp: 13, load: { weapon: 'cutter', gear: 1, kit: 0, clips: 1 } },
    { id: 'uly', ni: 3, acc: 54, ap: 28, stam: 45, hp: 9, load: { weapon: 'spark', gear: 2, kit: 0, clips: 1 } },
    { id: 'sav', ni: 4, acc: 52, ap: 26, stam: 60, hp: 11, load: { weapon: 'rivet', gear: 1, kit: 1, clips: 1 } },
    { id: 'zoy', ni: 5, acc: 60, ap: 25, stam: 55, hp: 10, load: { weapon: 'pistol', gear: 2, kit: 2, clips: 1 } }
  ];
  var LV_XP = [0, 6, 14, 25, 40, 60];
  var LIM = { gear: 4, kit: 3, clips: 3 };
  function lvlOf(xp) { var l = 0; for (var i = 0; i < LV_XP.length; i++) if (xp >= LV_XP[i]) l = i; return l; }
  function base(id) { return ROSTER.filter(function (r) { return r.id === id; })[0]; }

  var Camp = {
    KEY: KEY, BKEY: BKEY, ROSTER: ROSTER, LV_XP: LV_XP, LIM: LIM, lvlOf: lvlOf,
    newCampaign: function (diff) {
      return { v: 1, mi: 0, diff: diff || 'normal', score: 0, wins: 0, fails: 0, done: false,
        roster: ROSTER.map(function (r, i) { return { id: r.id, xp: 0, lvl: 0, missions: 0, kills: 0, sel: true, load: Object.assign({}, r.load) }; }) };
    },
    spec: function (c) { return O.MISSIONS[Math.min(c.mi, O.MISSIONS.length - 1)]; },
    // Боец для O.Game: база + уровень + снаряжение
    statsOf: function (r) {
      var b = base(r.id), l = r.lvl | 0;
      return { id: r.id, ni: b.ni, lvl: l, acc: b.acc + 3 * l, ap: b.ap + l, stam: b.stam + 4 * l, hp: b.hp + l,
        weapon: r.load.weapon, gear: r.load.gear | 0, kit: r.load.kit | 0, clips: r.load.clips | 0 };
    },
    apOf: function (r) { var s = Camp.statsOf(r), L = O.logic; return L.apFor({ apBase: s.ap, stam: s.stam, weapon: s.weapon, gear: s.gear, kit: s.kit, clips: s.clips }); },
    weightOf: function (r) { var s = Camp.statsOf(r); return O.logic.weightOf(s); },
    limitOf: function (r) { return O.logic.limitOf(Camp.statsOf(r)); },
    selected: function (c) { var n = Camp.spec(c).squad; return c.roster.filter(function (r) { return r.sel; }).slice(0, n); },
    // Отметить/снять бойца; в отряде не больше spec.squad
    toggle: function (c, id) {
      var r = c.roster.filter(function (q) { return q.id === id; })[0]; if (!r) return false;
      if (r.sel) { if (c.roster.filter(function (q) { return q.sel; }).length <= 1) return false; r.sel = false; return true; }
      if (c.roster.filter(function (q) { return q.sel; }).length >= Camp.spec(c).squad) return false;
      r.sel = true; return true;
    },
    fitSquad: function (c) {   // при смене миссии: добрать отметки до размера отряда
      var n = Camp.spec(c).squad, sel = c.roster.filter(function (q) { return q.sel; });
      while (sel.length > n) { sel.pop().sel = false; }
      c.roster.forEach(function (q) { if (!q.sel && c.roster.filter(function (z) { return z.sel; }).length < n) q.sel = true; });
    },
    cycleWeapon: function (r, d) { var L = O.logic.WEAPON_LIST, i = L.indexOf(r.load.weapon); r.load.weapon = L[(i + (d || 1) + L.length) % L.length]; },
    cycleItem: function (r, k, d) { var n = LIM[k] + 1; r.load[k] = ((r.load[k] | 0) + (d || 1) + n) % n; },
    squadDefs: function (c) { return Camp.selected(c).map(Camp.statsOf); },
    // Итог миссии → отчёт; опыт: +3 уцелевшему, +1 за попадание, +2 за разбор автоматона
    apply: function (c, res) {
      var rep = { won: res.won, xp: {}, promos: [], score: res.score };
      (res.units || []).forEach(function (u) {
        var r = c.roster.filter(function (q) { return q.id === u.rkey; })[0]; if (!r) return;
        var gain = (u.alive ? 3 : 0) + (u.hits | 0) + 2 * (u.kills | 0);
        var l0 = r.lvl; r.xp += gain; r.lvl = lvlOf(r.xp); r.missions++; r.kills += u.kills | 0;
        rep.xp[r.id] = gain; if (r.lvl > l0) rep.promos.push(r.id);
      });
      c.score += res.score | 0;
      if (res.won) { c.wins++; c.mi++; if (c.mi >= O.MISSIONS.length) { c.done = true; c.mi = O.MISSIONS.length - 1; } else Camp.fitSquad(c); }
      else c.fails++;
      return rep;
    },
    save: function (Store, c) { Store.set(KEY, JSON.stringify(c)); },
    load: function (Store) {
      try {
        var c = JSON.parse(Store.get(KEY, 'null'));
        if (!c || c.v !== 1 || c.done || !Array.isArray(c.roster) || c.roster.length !== ROSTER.length || !(c.mi >= 0 && c.mi < O.MISSIONS.length)) return null;
        c.roster.forEach(function (r) { if (!base(r.id) || !r.load || !O.logic.WEAPONS[r.load.weapon]) throw new Error('bad'); r.lvl = lvlOf(r.xp | 0); });
        return c;
      } catch (e) { return null; }
    },
    clear: function (Store) { Store.set(KEY, ''); Store.set(BKEY, ''); },
    saveBattle: function (Store, c, game) { Store.set(BKEY, JSON.stringify({ mi: c.mi, wins: c.wins, fails: c.fails, s: game.serialize() })); },
    loadBattle: function (Store, c) {
      try { var b = JSON.parse(Store.get(BKEY, 'null')); if (!b || !c || b.mi !== c.mi || b.wins !== c.wins || b.fails !== c.fails) return null; return b.s; } catch (e) { return null; }
    },
    clearBattle: function (Store) { Store.set(BKEY, ''); }
  };
  O.Camp = Camp;
})(typeof window !== 'undefined' ? window : globalThis);
