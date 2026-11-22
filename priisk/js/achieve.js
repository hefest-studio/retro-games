/* ПРИИСК · js/achieve.js — достижения: условия и вызов хука издания PRIISK.Edition.achieve(id).
   На сайте (демо и полная веб-сборка) хука нет — вызовы ничего не делают (no-op), игра про них не знает. Хук даёт издание
   Steam (приватный arcade-full/steam/priisk/js/edition.js): мост обёртки → steamworks.js (activate), без Steam — запись в журнал.
   Полный список (id для Steamworks, названия RU/EN, описания, скрытые) — arcade-full/docs/steam/priisk/achievements.md.
   Здесь — только id и правила:
     кампании (после итога миссии, по сохранению кампании): первая миссия «Медной лихорадки», финал каждой кампании (миссия с
       def.finale), эпилог (camp 'both'), все звёзды кампании (все миссии кампании в сборке на все звёзды, финал есть и пройден);
       свои достижения миссий — в самих миссиях: def.achieve = [{ id, flags: { флаг: значение | [значения] } } | { id, star: № }]
       (номер звезды как в итоге: 0 — победа, 1… — def.stars);
     скирмиш (после победы): сторона, против ИИ-Сизых на их механике, на «Трудном», за 10 минут, без потерь зданий, победа на
       каждой карте (карты — в сохранении arcade.priisk.skirmish: { maps: { gen: 1, … } }).
   Повторные вызовы в одном запуске не уходят в мост (Steam сам помнит открытые). P.achieve.log — что вызвано (для тестов). */
(function (global) {
  'use strict';
  var P = global.PRIISK = global.PRIISK || {};
  var IDS = ['ACH_M1', 'ACH_COPPER_DONE', 'ACH_SIZYE_DONE', 'ACH_EPILOGUE', 'ACH_COPPER_STARS', 'ACH_SIZYE_STARS', 'ACH_M2_SNEAK', 'ACH_M7_HELP', 'ACH_S8_ROPE',
    'ACH_SK_COPPER', 'ACH_SK_SIZYE', 'ACH_SK_VS_WIND', 'ACH_SK_HARD', 'ACH_SK_FAST', 'ACH_SK_NOLOSS', 'ACH_SK_ALL_MAPS'];
  var CAMP = { copper: { first: 'ACH_M1', done: 'ACH_COPPER_DONE', stars: 'ACH_COPPER_STARS' }, sizye: { done: 'ACH_SIZYE_DONE', stars: 'ACH_SIZYE_STARS' }, both: { done: 'ACH_EPILOGUE' } };
  var SK_KEY = 'arcade.priisk.skirmish', FAST = 600;
  var got = Object.create(null), log = [];
  function fire(id) {
    if (IDS.indexOf(id) < 0 || got[id]) return false;
    got[id] = 1; log.push(id);
    var E = P.Edition; if (E && typeof E.achieve === 'function') { try { E.achieve(id); } catch (e) { /* мост не должен ломать игру */ } }
    return true;
  }
  function campOf(def) { return def && (def.camp === 'sizye' || def.camp === 'both') ? def.camp : 'copper'; }
  function flagOk(flags, want) {
    flags = flags || {};
    return Object.keys(want || {}).every(function (k) { var v = want[k]; return Array.isArray(v) ? v.indexOf(flags[k]) >= 0 : flags[k] === v; });
  }
  // итог миссии: res — результат (C.result), def — миссия, data — сохранение её кампании ПОСЛЕ applyResult, list — миссии кампании
  function mission(res, def, data, list) {
    var out = []; if (!res || !res.win || !def) return out;
    var c = CAMP[campOf(def)];
    if (c.first && def.n === 1) out.push(c.first);
    if (c.done && def.finale) out.push(c.done);
    if (c.stars && list && list.length && list.some(function (m) { return m.finale; }) && list.every(function (m) {
      var rec = data && data.missions && data.missions[m.id], need = 1 + (m.stars || []).length;
      if (!rec || !rec.stars || rec.stars.length < need) return false;
      for (var q = 0; q < need; q++) if (!rec.stars[q]) return false;
      return true;
    })) out.push(c.stars);
    (def.achieve || []).forEach(function (a) {
      if (!a || !a.id) return;
      if (a.star != null ? !!(res.stars && res.stars[a.star]) : flagOk(res.flags, a.flags)) out.push(a.id);
    });
    return out.filter(fire);
  }
  function readRec(store) { var r = null; try { r = JSON.parse(store && store.getItem(SK_KEY) || 'null'); } catch (e) { r = null; } return r && typeof r === 'object' && r.maps ? r : { maps: {} }; }
  // итог скирмиша: o = { map, level, store, maps (все карты) }
  function skirmish(W, o) {
    o = o || {}; var out = [], L = P.logic; if (!W || W.mission || W.winner !== 0 || !L) return out;
    var me = L.facOf(W, 0), foe = L.facOf(W, 1);
    out.push(me === 'sizye' ? 'ACH_SK_SIZYE' : 'ACH_SK_COPPER');
    if (me !== 'sizye' && foe === 'sizye') out.push('ACH_SK_VS_WIND');
    if (o.level === 'hard') out.push('ACH_SK_HARD');
    if (W.time <= FAST) out.push('ACH_SK_FAST');
    if (!W.players[0].lostB) out.push('ACH_SK_NOLOSS');
    var maps = o.maps || L.SK_MAPS || [], rec = readRec(o.store), map = String(o.map || 'gen').split(':')[0];
    if (maps.indexOf(map) >= 0) { rec.maps[map] = 1; try { if (o.store) o.store.setItem(SK_KEY, JSON.stringify(rec)); } catch (e) { /* без хранилища — без учёта карт */ } }
    if (maps.length && maps.every(function (m) { return rec.maps[m]; })) out.push('ACH_SK_ALL_MAPS');
    return out.filter(fire);
  }
  P.achieve = { IDS: IDS, SK_KEY: SK_KEY, FAST: FAST, fire: fire, mission: mission, skirmish: skirmish, log: log, reset: function () { got = Object.create(null); log.length = 0; } };
})(typeof window !== 'undefined' ? window : globalThis);
