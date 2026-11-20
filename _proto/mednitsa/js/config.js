/* МЕДНИЦА · баланс в одном месте (MEDNITSA.CFG). Все экспоненты стоимости и дохода, этапы, чертежи, заказы,
   переплавка, офлайн и реклама — здесь. Часть значений переопределяется флагами площадки (g.flags, без модерации):
   см. FLAG_KEYS внизу и econ.applyFlags. Изменил числа — прогони симулятор: node _proto/mednitsa/tests/sim.mjs */
(function (global) {
  'use strict';
  var M = global.MEDNITSA = global.MEDNITSA || {};

  // Цеха: c0 — цена первого уровня, inc — доход уровня в секунду (медь/с), g — рост цены за уровень (цена n-го = c0·g^n).
  // Окупаемость первого уровня (c0/inc) растёт от цеха к цеху: 20 с → ~20 мин, — так каждый новый цех «дальше», но выгоднее.
  var WS = [
    { id: 'kettle',   c0: 12,      inc: 0.6,     g: 1.150 },
    { id: 'hammer',   c0: 180,     inc: 4.5,     g: 1.152 },
    { id: 'rivet',    c0: 3.2e3,   inc: 34,      g: 1.154 },
    { id: 'foundry',  c0: 5.5e4,   inc: 260,     g: 1.156 },
    { id: 'gears',    c0: 1.0e6,   inc: 2.1e3,   g: 1.158 },
    { id: 'clock',    c0: 1.8e7,   inc: 1.7e4,   g: 1.160 },
    { id: 'loco',     c0: 3.3e8,   inc: 1.4e5,   g: 1.162 },
    { id: 'airship',  c0: 6.0e9,   inc: 1.15e6,  g: 1.164 },
    { id: 'scope',    c0: 1.1e11,  inc: 9.5e6,   g: 1.166 },
    { id: 'heart',    c0: 2.0e12,  inc: 8.0e7,   g: 1.168 }
  ];
  // Этапы цеха: на этих уровнях доход цеха ×2 (каждый этап)
  var MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500];

  // Чертежи (разовые улучшения). kind: ws — множитель цеха, tap — множитель удара, tapPct — доля дохода/с в ударе,
  // cap — предел офлайна (часы), rate — доля офлайн-дохода, boost — длительность форсажа (мин), all — множитель всего.
  var UPS = [];
  WS.forEach(function (w, i) {
    UPS.push({ id: 'pipes' + i, kind: 'ws', ws: i, x: 2, cost: w.c0 * 40, need: { ws: i, lv: 5 } });
    UPS.push({ id: 'valves' + i, kind: 'ws', ws: i, x: 3, cost: w.c0 * 3000, need: { ws: i, lv: 25 } });
    UPS.push({ id: 'jacket' + i, kind: 'ws', ws: i, x: 4, cost: w.c0 * 4e5, need: { ws: i, lv: 75 } });
  });
  UPS.push(
    { id: 'bellows',  kind: 'tap', x: 2, cost: 250, need: { ws: 0, lv: 3 } },
    { id: 'anvil',    kind: 'tapPct', x: 0.03, cost: 4e3, need: { ws: 1, lv: 5 } },
    { id: 'sledge',   kind: 'tap', x: 3, cost: 6e4, need: { ws: 2, lv: 10 } },
    { id: 'piston',   kind: 'tapPct', x: 0.05, cost: 2e6, need: { ws: 4, lv: 1 } },
    { id: 'spare',    kind: 'cap', x: 4, cost: 5e5, need: { ws: 3, lv: 1 } },
    { id: 'night',    kind: 'cap', x: 8, cost: 3e8, need: { ws: 5, lv: 10 } },
    { id: 'watch',    kind: 'rate', x: 0.7, cost: 5e7, need: { ws: 5, lv: 1 } },
    { id: 'gauge',    kind: 'boost', x: 8, cost: 2e7, need: { ws: 4, lv: 10 } },
    { id: 'guild',    kind: 'all', x: 2, cost: 5e9, need: { ws: 7, lv: 1 } },
    { id: 'charter',  kind: 'all', x: 3, cost: 2e12, need: { ws: 9, lv: 1 } }
  );
  UPS.sort(function (a, b) { return a.cost - b.cost; });

  // Заказы (цели): по порядку, видно 3 первых невыполненных. rw — награда в секундах текущего дохода (в самом начале — rw/4 ударов).
  // type: lv (цех ws до уровня n), taps, earn (заработано за забег), ups (число чертежей), chest, prestige, all (все открытые цеха ≥ n), boost
  var GOALS = [
    { id: 'g1',  type: 'lv', ws: 0, n: 5,  rw: 30 },
    { id: 'g2',  type: 'taps', n: 60,      rw: 30 },
    { id: 'g3',  type: 'lv', ws: 1, n: 1,  rw: 40 },
    { id: 'g4',  type: 'lv', ws: 0, n: 10, rw: 45 },
    { id: 'g5',  type: 'ups', n: 1,        rw: 45 },
    { id: 'g6',  type: 'lv', ws: 2, n: 1,  rw: 60 },
    { id: 'g7',  type: 'chest', n: 1,      rw: 60 },
    { id: 'g8',  type: 'lv', ws: 1, n: 10, rw: 60 },
    { id: 'g9',  type: 'earn', n: 5e4,     rw: 60 },
    { id: 'g10', type: 'lv', ws: 3, n: 1,  rw: 75 },
    { id: 'g11', type: 'lv', ws: 0, n: 25, rw: 75 },
    { id: 'g12', type: 'ups', n: 5,        rw: 75 },
    { id: 'g13', type: 'lv', ws: 4, n: 1,  rw: 90 },
    { id: 'g14', type: 'lv', ws: 2, n: 25, rw: 90 },
    { id: 'g15', type: 'earn', n: 5e6,     rw: 90 },
    { id: 'g16', type: 'lv', ws: 5, n: 1,  rw: 100 },
    { id: 'g17', type: 'taps', n: 1500,    rw: 100 },
    { id: 'g18', type: 'lv', ws: 3, n: 25, rw: 100 },
    { id: 'g19', type: 'lv', ws: 6, n: 1,  rw: 120 },
    { id: 'g20', type: 'prestige', n: 1,   rw: 120 },
    { id: 'g21', type: 'ups', n: 12,       rw: 120 },
    { id: 'g22', type: 'lv', ws: 4, n: 50, rw: 120 },
    { id: 'g23', type: 'lv', ws: 7, n: 1,  rw: 150 },
    { id: 'g24', type: 'earn', n: 1e11,    rw: 150 },
    { id: 'g25', type: 'lv', ws: 5, n: 50, rw: 150 },
    { id: 'g26', type: 'lv', ws: 8, n: 1,  rw: 180 },
    { id: 'g27', type: 'lv', ws: 0, n: 100, rw: 180 },
    { id: 'g28', type: 'prestige', n: 3,   rw: 180 },
    { id: 'g29', type: 'lv', ws: 9, n: 1,  rw: 240 },
    { id: 'g30', type: 'all', n: 50,       rw: 240 }
  ];
  // после списка — бесконечные «все цеха ≥ n» (шаг 25) с растущей наградой

  M.CFG = {
    version: 1,
    WS: WS, MILESTONES: MILESTONES, UPS: UPS, GOALS: GOALS,
    tap: { base: 1, pct: 0.0 },               // удар по котлу: base·множители + pct·доход/с
    prestige: {
      div: 4e9,        // клейма за забег = floor(k·∛(заработано_всего/div)) − уже полученные
      k: 10,
      bonus: 0.05,     // +5% дохода за клеймо
      minGain: 5       // переплавка доступна, если даст ≥ minGain клейм
    },
    offline: { capH: 2, rate: 0.5, minSec: 60, showSec: 60 },  // офлайн-доход: предел (ч), доля, с какого времени считаем и показываем окно
    boost: { mult: 2, min: 5, maxMin: 60 },  // форсаж за рекламу: ×2 на 5 мин, копится до 60 мин
    chest: { every: 150, life: 25, freeSec: 45, adMult: 8, first: 70 },   // посылка-дирижабль: раз в 150 с, видна 25 с; бесплатно — 45 с дохода, за рекламу ×8
    daily: [5, 10, 15, 20, 30, 45, 60],      // ежедневный подарок: минуты дохода (день 1..7 подряд), на 7-й ещё +1 клеймо
    dailyMin: 50,                            // минимум подарка (медь) — в самом начале доход мал
    ads: { firstSec: 300, gapSec: 240 },      // межстраничная: не раньше 5 мин сессии и не чаще раза в 4 мин, только в паузах по действию игрока
    starter: { mult: 2, copperSec: 1800 }     // «Набор мастера» (покупка): ×2 навсегда + 30 мин дохода сразу
  };

  // Флаги площадки (строки) → поля конфига. Значение по умолчанию = из конфига.
  M.FLAG_KEYS = {
    ad_idle_first: ['ads', 'firstSec'], ad_idle_gap: ['ads', 'gapSec'],
    offline_cap_h: ['offline', 'capH'], offline_rate: ['offline', 'rate'],
    boost_min: ['boost', 'min'], chest_every: ['chest', 'every'], chest_ad_mult: ['chest', 'adMult'],
    prestige_div: ['prestige', 'div'], cost_scale: null, income_scale: null
  };
})(typeof window !== 'undefined' ? window : globalThis);
