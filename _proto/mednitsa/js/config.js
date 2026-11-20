/* МЕДНИЦА · баланс в одном месте (MEDNITSA.CFG). Все экспоненты стоимости и дохода, этапы, чертежи, заказы,
   переплавка, офлайн и реклама — здесь. Часть значений переопределяется флагами площадки (g.flags, без модерации):
   см. FLAG_KEYS внизу и econ.applyFlags. Изменил числа — прогони симулятор: node _proto/mednitsa/tests/sim.mjs */
(function (global) {
  'use strict';
  var M = global.MEDNITSA = global.MEDNITSA || {};

  // Цеха: c0 — цена первого уровня, inc — доход уровня в секунду (медь/с), g — рост цены за уровень (цена n-го = c0·g^n).
  // Окупаемость первого уровня (c0/inc) растёт от цеха к цеху: 20 с → ~20 мин, — так каждый новый цех «дальше», но выгоднее.
  // wk — мастерская: 0 — Медная мастерская (горн), 1 — Речная верфь (пар и вода; открывается после wharf.unlock переплавок,
  // её первый цех — после «Сердца Горна» в текущем забеге). Индексы 0–9 — горн, 10–19 — верфь (сохранение — один массив уровней).
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
    { id: 'heart',    c0: 2.0e12,  inc: 8.0e7,   g: 1.168 },
    // Речная верфь: цена ×300 от цеха к цеху (горн — ×18), доход ×30 — окупаемость растёт ×10, и каждый следующий цех верфи
    // требует новых переплавок: цеха верфи открываются на 7–27-й день (симулятор: tests/sim.mjs)
    { id: 'pump',    c0: 1.00e14, inc: 2.00e08, g: 1.170, wk: 1 },
    { id: 'wheel',   c0: 3.00e16, inc: 6.00e09, g: 1.172, wk: 1 },
    { id: 'sluice',  c0: 9.00e18, inc: 1.80e11, g: 1.174, wk: 1 },
    { id: 'crane',   c0: 2.70e21, inc: 5.40e12, g: 1.176, wk: 1 },
    { id: 'dredge',  c0: 8.10e23, inc: 1.62e14, g: 1.178, wk: 1 },
    { id: 'tug',     c0: 2.43e26, inc: 4.86e15, g: 1.180, wk: 1 },
    { id: 'dock',    c0: 7.29e28, inc: 1.46e17, g: 1.182, wk: 1 },
    { id: 'paddle',  c0: 2.19e31, inc: 4.37e18, g: 1.184, wk: 1 },
    { id: 'turbine', c0: 6.56e33, inc: 1.31e20, g: 1.186, wk: 1 },
    { id: 'tide',    c0: 1.97e36, inc: 3.94e21, g: 1.188, wk: 1 }
  ];
  WS.forEach(function (w) { if (!w.wk) w.wk = 0; });
  // Этапы цеха: на этих уровнях доход цеха ×2 (каждый этап)
  var MILESTONES = [10, 25, 50, 100, 150, 200, 300, 400, 500];

  // Чертежи (разовые улучшения). kind: ws — множитель цеха, tap — множитель удара, tapPct — доля дохода/с в ударе,
  // cap — предел офлайна (часы), rate — доля офлайн-дохода, boost — длительность форсажа (мин), all — множитель всего.
  var UPS = [];
  WS.forEach(function (w, i) {   // горн: трубы/клапаны/рубашка; верфь: сальники/лопасти/обшивка
    var n = w.wk ? ['seals', 'blades', 'hull'] : ['pipes', 'valves', 'jacket'];
    UPS.push({ id: n[0] + i, kind: 'ws', ws: i, x: 2, cost: w.c0 * 40, need: { ws: i, lv: 5 } });
    UPS.push({ id: n[1] + i, kind: 'ws', ws: i, x: 3, cost: w.c0 * 3000, need: { ws: i, lv: 25 } });
    UPS.push({ id: n[2] + i, kind: 'ws', ws: i, x: 4, cost: w.c0 * 4e5, need: { ws: i, lv: 75 } });
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
    { id: 'charter',  kind: 'all', x: 3, cost: 2e12, need: { ws: 9, lv: 1 } },
    // чертежи Речной верфи
    { id: 'bell',     kind: 'tapPct', x: 0.05, cost: 2e15, need: { ws: 10, lv: 10 } },
    { id: 'moor',     kind: 'cap', x: 12, cost: 1e18, need: { ws: 11, lv: 5 } },
    { id: 'keeper',   kind: 'rate', x: 0.8, cost: 1e23, need: { ws: 13, lv: 5 } },
    { id: 'ferry',    kind: 'all', x: 3, cost: 5e24, need: { ws: 14, lv: 1 } },
    { id: 'regatta',  kind: 'all', x: 4, cost: 1e32, need: { ws: 17, lv: 1 } },
    { id: 'tidal',    kind: 'all', x: 5, cost: 1e37, need: { ws: 19, lv: 1 } }
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

  // Заказы Речной верфи (видны в заказах, когда смотришь на верфь; по 3 сразу). Порядок — по времени выполнения в симуляторе
  // (≈ 1–2 новых заказа в день на 7–40-й день). ws — индекс цеха (10–19); all — все открытые цеха верфи; после списка — бесконечные.
  var GOALS2 = [
    { id: 'r1', type: 'lv', ws: 10, n: 1, rw: 120 }, { id: 'r2', type: 'lv', ws: 10, n: 10, rw: 120 }, { id: 'r3', type: 'lv', ws: 11, n: 1, rw: 130 },
    { id: 'r4', type: 'lv', ws: 10, n: 25, rw: 130 }, { id: 'r5', type: 'lv', ws: 12, n: 1, rw: 140 }, { id: 'r6', type: 'lv', ws: 11, n: 25, rw: 140 },
    { id: 'r7', type: 'prestige', n: 11, rw: 150 }, { id: 'r8', type: 'lv', ws: 12, n: 10, rw: 150 }, { id: 'r9', type: 'prestige', n: 12, rw: 160 },
    { id: 'r10', type: 'lv', ws: 11, n: 50, rw: 160 }, { id: 'r11', type: 'lv', ws: 13, n: 1, rw: 170 }, { id: 'r12', type: 'prestige', n: 13, rw: 170 },
    { id: 'r13', type: 'chest', n: 150, rw: 180 }, { id: 'r14', type: 'lv', ws: 13, n: 10, rw: 180 }, { id: 'r15', type: 'prestige', n: 14, rw: 180 },
    { id: 'r16', type: 'lv', ws: 12, n: 50, rw: 190 }, { id: 'r17', type: 'lv', ws: 14, n: 1, rw: 190 }, { id: 'r18', type: 'prestige', n: 15, rw: 200 },
    { id: 'r19', type: 'prestige', n: 16, rw: 200 }, { id: 'r20', type: 'lv', ws: 10, n: 100, rw: 210 }, { id: 'r21', type: 'lv', ws: 14, n: 25, rw: 210 },
    { id: 'r22', type: 'prestige', n: 17, rw: 220 }, { id: 'r23', type: 'lv', ws: 15, n: 1, rw: 220 }, { id: 'r24', type: 'prestige', n: 18, rw: 230 },
    { id: 'r25', type: 'lv', ws: 11, n: 100, rw: 230 }, { id: 'r26', type: 'lv', ws: 15, n: 10, rw: 240 }, { id: 'r27', type: 'prestige', n: 19, rw: 240 },
    { id: 'r28', type: 'lv', ws: 16, n: 1, rw: 240 }, { id: 'r29', type: 'lv', ws: 15, n: 25, rw: 250 }, { id: 'r30', type: 'prestige', n: 20, rw: 250 },
    { id: 'r31', type: 'lv', ws: 12, n: 100, rw: 260 }, { id: 'r41', type: 'lv', ws: 16, n: 10, rw: 260 }, { id: 'r32', type: 'prestige', n: 21, rw: 260 }, { id: 'r33', type: 'lv', ws: 17, n: 1, rw: 270 },
    { id: 'r34', type: 'prestige', n: 22, rw: 270 }, { id: 'r35', type: 'lv', ws: 16, n: 25, rw: 280 }, { id: 'r36', type: 'prestige', n: 23, rw: 280 },
    { id: 'r37', type: 'lv', ws: 18, n: 1, rw: 290 }, { id: 'r38', type: 'prestige', n: 24, rw: 290 }, { id: 'r39', type: 'lv', ws: 19, n: 1, rw: 300 },
    { id: 'r40', type: 'all', wk: 1, n: 50, rw: 300 }
  ];
  GOALS2.forEach(function (g) { g.wk = 1; });

  M.CFG = {
    version: 2,
    WS: WS, MILESTONES: MILESTONES, UPS: UPS, GOALS: GOALS, GOALS2: GOALS2,
    wharf: { unlock: 10 },                    // Речная верфь открывается после 10-й переплавки (навсегда)
    // «Ярмарка выходного дня» (LiveOps без модерации — флаги площадки): mode 'weekend' — каждые сб–вс (UTC+3), 'on' — сейчас,
    // 'off' — выключено; mult — множитель дохода; особый заказ — заработать orderMin минут дохода, награда — клейма
    // (marksPct от клейм за всё время, не меньше marksMin; не уменьшают будущую переплавку)
    event: { mode: 'weekend', mult: 2, orderMin: 60, marksPct: 0.03, marksMin: 3, id: '' },
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
    prestige_div: ['prestige', 'div'], cost_scale: null, income_scale: null,
    wharf_unlock: ['wharf', 'unlock'],
    event_mode: ['event', 'mode', 'str'], event_id: ['event', 'id', 'str'], event_mult: ['event', 'mult'],
    event_order_min: ['event', 'orderMin'], event_marks: ['event', 'marksPct']
  };
})(typeof window !== 'undefined' ? window : globalThis);
