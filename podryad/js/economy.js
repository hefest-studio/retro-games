/* ПОДРЯД · экономика кампании: казна, покупка/продажа в ангаре, ремонт, потеря при гибели, сохранение.
   Чистые функции над объектом кампании c (без DOM). Правила:
   - покупка только если хватает денег — казна никогда не уходит в минус;
   - продажа — за полцены (ступень орудия продаётся за половину её цены; орудие ступени 1 — за половину цены орудия);
   - Клепальник выдаётся даром; продать последнее основное орудие нельзя;
   - гибель: теряется ПОСЛЕДНЕЕ купленное снаряжение (орудие/ступень/боковой модуль/ступень щит-генератора);
     расходники (мега-бомбы, ячейки щита) не теряются; броня чинится мастерской даром, заработок задания пропадает;
   - сохранение — localStorage 'arcade.podryad.save' (JSON, версия 1, с проверкой полей).
   PODRYAD.Eco = { create, price, sellPrice, canBuy, canSell, buy, sell, repairCost, loseLast, serialize, deserialize, ... }. */
(function (global) {
  'use strict';
  var P = global.PODRYAD = global.PODRYAD || {};
  var D = P.DATA;
  var SAVE_KEY = 'arcade.podryad.save';

  function create(diff) {
    return { v: 1, diff: D.DIFFS.indexOf(diff) >= 0 ? diff : 'normal', money: D.START_MONEY, mi: 0,
      guns: { rivet: 1 }, gun: 'rivet', mods: [null, null], mega: 0, cells: 0, gen: 0, armor: D.ARMOR_MAX,
      hist: [], earned: 0, deaths: 0, done: false };
  }
  function gunCount(c) { return Object.keys(c.guns).length; }
  function row(id) { for (var i = 0; i < D.SHOP.length; i++) if (D.SHOP[i].id === id) return D.SHOP[i]; return null; }

  // цена следующей покупки по строке; null — купить нельзя (максимум / нет гнезда / полная броня)
  function price(c, id) {
    var r = row(id); if (!r) return null;
    switch (r.kind) {
      case 'gun': { var G = D.GUNS[r.key], lv = c.guns[r.key] || 0; if (!lv) return G.price; return lv >= 5 ? null : G.up[lv - 1]; }
      case 'mod': return c.mods[0] && c.mods[1] ? null : D.MODS[r.key].price;
      case 'mega': return c.mega >= D.SPECIAL.mega.max ? null : D.SPECIAL.mega.price;
      case 'cell': return c.cells >= D.SPECIAL.cell.max ? null : D.SPECIAL.cell.price;
      case 'gen': return c.gen >= D.SPECIAL.gen.max ? null : D.SPECIAL.gen.up[c.gen];
      case 'repair': return c.armor >= D.ARMOR_MAX ? null : repairCost(c, D.ARMOR_MAX - c.armor);
    }
    return null;
  }
  // выручка за продажу по строке (половина цены того, что снимается); null — продать нечего / нельзя
  function sellPrice(c, id) {
    var r = row(id); if (!r) return null;
    switch (r.kind) {
      case 'gun': {
        var G = D.GUNS[r.key], lv = c.guns[r.key] || 0; if (!lv) return null;
        if (lv > 1) return Math.floor(G.up[lv - 2] / 2);
        if (gunCount(c) <= 1) return null;          // без основного орудия не улететь
        return Math.floor(G.price / 2);
      }
      case 'mod': return (c.mods[0] === r.key || c.mods[1] === r.key) ? Math.floor(D.MODS[r.key].price / 2) : null;
      case 'mega': return c.mega > 0 ? Math.floor(D.SPECIAL.mega.price / 2) : null;
      case 'cell': return c.cells > 0 ? Math.floor(D.SPECIAL.cell.price / 2) : null;
      case 'gen': return c.gen > 0 ? Math.floor(D.SPECIAL.gen.up[c.gen - 1] / 2) : null;
    }
    return null;
  }
  // ремонт: n единиц брони; если денег не хватает на всё — чинится сколько хватает (repair(c, id) в buy)
  function repairCost(c, n) { return Math.max(0, Math.ceil(n)) * D.REPAIR; }
  function canBuy(c, id) { var p = price(c, id); if (p == null) return false; if (id === 'repair') return c.money >= D.REPAIR; return c.money >= p; }
  function canSell(c, id) { return sellPrice(c, id) != null; }

  function popHist(c, id, slot) { for (var i = c.hist.length - 1; i >= 0; i--) if (c.hist[i].id === id && (slot == null || c.hist[i].slot === slot)) { c.hist.splice(i, 1); return true; } return false; }

  // → потраченная сумма или 0 (не куплено)
  function buy(c, id) {
    if (!canBuy(c, id)) return 0;
    var r = row(id), p = price(c, id);
    switch (r.kind) {
      case 'gun':
        c.guns[r.key] = (c.guns[r.key] || 0) + 1;
        if (c.guns[r.key] === 1) c.gun = r.key;    // новое орудие сразу берётся в руки
        c.hist.push({ id: id }); break;
      case 'mod': { var slot = c.mods[0] ? 1 : 0; c.mods[slot] = r.key; c.hist.push({ id: id, slot: slot }); break; }
      case 'mega': c.mega++; break;
      case 'cell': c.cells++; break;
      case 'gen': c.gen++; c.hist.push({ id: id }); break;
      case 'repair': {
        var n = Math.min(D.ARMOR_MAX - c.armor, Math.floor(c.money / D.REPAIR)); p = repairCost(c, n); c.armor += n; break;
      }
    }
    c.money -= p;
    if (c.money < 0) throw new Error('казна ушла в минус');
    return p;
  }
  // → выручка или 0
  function sell(c, id) {
    var v = sellPrice(c, id); if (v == null) return 0;
    var r = row(id);
    switch (r.kind) {
      case 'gun':
        if (c.guns[r.key] > 1) c.guns[r.key]--;
        else { delete c.guns[r.key]; if (c.gun === r.key) c.gun = Object.keys(c.guns)[0]; }
        popHist(c, id); break;
      case 'mod': { var slot = c.mods[1] === r.key ? 1 : 0; c.mods[slot] = null; popHist(c, id, slot); break; }
      case 'mega': c.mega--; break;
      case 'cell': c.cells--; break;
      case 'gen': c.gen--; popHist(c, id); break;
    }
    c.money += v;
    return v;
  }
  // гибель: снять последнее купленное снаряжение → { id, slot } или null
  function loseLast(c) {
    while (c.hist.length) {
      var h = c.hist.pop(), r = row(h.id); if (!r) continue;
      if (r.kind === 'gun' && c.guns[r.key]) {
        if (c.guns[r.key] > 1) c.guns[r.key]--;
        else { delete c.guns[r.key]; if (!gunCount(c)) c.guns.rivet = 1; if (!c.guns[c.gun]) c.gun = Object.keys(c.guns)[0]; }
        return h;
      }
      if (r.kind === 'mod' && c.mods[h.slot] === r.key) { c.mods[h.slot] = null; return h; }
      if (r.kind === 'gen' && c.gen > 0) { c.gen--; return h; }
    }
    return null;
  }
  // итог задания: ok — заработок зачисляется, номер задания растёт; иначе — потеря снаряжения
  function finishMission(c, res) {
    c.armor = Math.max(0, Math.min(D.ARMOR_MAX, Math.round(res.armor)));
    c.mega = res.mega; c.cells = res.cells;
    if (res.ok) {
      c.money += res.money; c.earned += res.money; c.mi++;
      if (c.mi >= 9) c.done = true;
      return { ok: true, lost: null };
    }
    c.deaths++; c.armor = D.ARMOR_MAX;
    return { ok: false, lost: loseLast(c) };
  }
  // стоимость снаряжения (для статистики/теста: продать всё — получить половину)
  function worth(c) {
    var s = 0;
    for (var k in c.guns) { var G = D.GUNS[k]; if (!G.base) s += G.price; for (var i = 1; i < c.guns[k]; i++) s += G.up[i - 1]; }
    c.mods.forEach(function (m) { if (m) s += D.MODS[m].price; });
    for (var j = 0; j < c.gen; j++) s += D.SPECIAL.gen.up[j];
    return s + c.mega * D.SPECIAL.mega.price + c.cells * D.SPECIAL.cell.price;
  }

  function serialize(c) { return JSON.stringify(c); }
  function num(v, a, b, d) { v = +v; return isFinite(v) ? Math.max(a, Math.min(b, Math.floor(v))) : d; }
  function deserialize(s) {
    var o; try { o = typeof s === 'string' ? JSON.parse(s) : s; } catch (e) { return null; }
    if (!o || o.v !== 1 || typeof o.guns !== 'object' || !o.guns) return null;
    var c = create(o.diff);
    c.money = num(o.money, 0, 1e9, 0); c.mi = num(o.mi, 0, 9, 0); c.earned = num(o.earned, 0, 1e10, 0); c.deaths = num(o.deaths, 0, 1e6, 0);
    c.guns = {};
    D.GUN_IDS.forEach(function (k) { var lv = num(o.guns[k], 0, 5, 0); if (lv) c.guns[k] = lv; });
    if (!gunCount(c)) c.guns.rivet = 1;
    c.gun = c.guns[o.gun] ? o.gun : Object.keys(c.guns)[0];
    c.mods = [0, 1].map(function (i) { var m = o.mods && o.mods[i]; return D.MODS[m] ? m : null; });
    c.mega = num(o.mega, 0, D.SPECIAL.mega.max, 0); c.cells = num(o.cells, 0, D.SPECIAL.cell.max, 0); c.gen = num(o.gen, 0, 3, 0);
    c.armor = num(o.armor, 1, D.ARMOR_MAX, D.ARMOR_MAX);
    c.hist = Array.isArray(o.hist) ? o.hist.filter(function (h) { return h && row(h.id); }).map(function (h) { return h.slot == null ? { id: h.id } : { id: h.id, slot: h.slot ? 1 : 0 }; }) : [];
    c.done = c.mi >= 9;
    return c;
  }
  function save(store, c) { try { store.set(SAVE_KEY, serialize(c)); return true; } catch (e) { return false; } }
  function load(store) { try { var s = store.get(SAVE_KEY, null); return s ? deserialize(s) : null; } catch (e) { return null; } }
  function clear(store) { try { store.set(SAVE_KEY, ''); } catch (e) {} }

  P.Eco = { SAVE_KEY: SAVE_KEY, create: create, row: row, price: price, sellPrice: sellPrice, canBuy: canBuy, canSell: canSell, buy: buy, sell: sell,
    repairCost: repairCost, loseLast: loseLast, finishMission: finishMission, worth: worth, serialize: serialize, deserialize: deserialize,
    save: save, load: load, clear: clear };
})(typeof window !== 'undefined' ? window : globalThis);
