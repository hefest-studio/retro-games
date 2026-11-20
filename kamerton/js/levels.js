/* КАМЕРТОН · levels.js — шесть зон заброшенного города часовщиков (данные, без логики).
   Координаты мира: x вправо, y вниз; высота мира = высота кадра (540), земля обычно y=440.
   solids  — [x, y, w, h] неподвижная твердь;  ladders — лестницы (только для подмастерья; верх — ступень);
   dolls   — заводные куклы { id, kind: porter|dancer|giant|soldier, x, y? (ступни) };
   crates  — ящик (crate: толкает любой, кроме плясуньи) / чугунная болванка (heavy: только тяжеловес);
   plates  — плита { x, w, y?, min: вес, link };  levers — рычаг { x, y?, mode: toggle|hold, link } (hold — держать, пока кукла на нём);
   doors   — заслонка { x, y, w, h, link (строка или массив = «все сразу»), dist };  bridges — мостки, твёрдые при сигнале;
   lifts   — подъёмник { x, y, w, h, y2, link, speed };  movers — карусельная люлька { x, y, w, h, x2, period, phase };
   lamps   — фонарь-смотритель: { x, y, ang (0 — вниз, + к x), half, range, sweep?{amp,period,phase}, patrol?{x1,x2,speed}, off? link };
   crushers— молот { x, y (верх поднятого), w, h, drop, period, phase, stop? link };  drums — катящийся барабан шкатулки { trig, x, y, r, speed, end };
   cps     — отметки-фонарики { x, y? (ступни) };  exit — x выхода (exitY — ступни не ниже);  final — последняя зона. */
(function (global) {
  'use strict';
  var K = global.KAMER = global.KAMER || {};
  function ground(a, b) { return [a, 440, b - a, 140]; }
  function ends(w) { return [[-40, -200, 40, 780], [w, -200, 40, 780]]; }

  K.LEVELS = [
    { // 1. Мастерская: прыжок, лестница, первая кукла-носильщик (плита, ступенька), ящик-тень от фонаря
      w: 3040, look: 0,
      solids: ends(3040).concat([ground(-40, 640), ground(720, 3040), [300, 400, 80, 40], [900, 320, 40, 120], [1500, 36, 30, 264], [1950, 320, 400, 120], [2760, 330, 280, 110]]),
      ladders: [{ x: 872, y: 320, w: 24, h: 120 }],
      dolls: [{ id: 'p1', kind: 'porter', x: 1180 }, { id: 'p2', kind: 'porter', x: 1700 }],
      crates: [{ id: 'c1', kind: 'crate', x: 2440 }],
      plates: [{ x: 1330, w: 44, min: 2, link: 'a' }],
      doors: [{ x: 1500, y: 300, w: 30, h: 140, link: 'a', dist: 150 }],
      lamps: [{ x: 2745, y: 425, ang: -1.57, half: 0.3, range: 320 }],
      cps: [{ x: 80 }, { x: 1060 }, { x: 1620 }, { x: 2150, y: 320 }, { x: 2400 }],
      exit: 2950, exitY: 330
    },
    { // 2. Часовая улица: плясунья — под заслонкой к рычагу, на высокий карниз, держит ворот в свете, гасит смотрителя
      w: 3440, look: 1,
      solids: ends(3440).concat([ground(-40, 1100), ground(1300, 3440), [640, 36, 30, 304], [960, 340, 80, 14], [1600, 300, 380, 14], [1980, 36, 30, 194], [1980, 300, 30, 140], [2010, 300, 200, 14], [2440, 380, 30, 60]]),
      ladders: [{ x: 1574, y: 300, w: 24, h: 140 }],
      dolls: [{ id: 'd1', kind: 'dancer', x: 300 }, { id: 'd2', kind: 'dancer', x: 1480 }, { id: 'd3', kind: 'dancer', x: 2330 }],
      doors: [{ x: 640, y: 340, w: 30, h: 74, link: 'v', dist: 100 }, { x: 1980, y: 230, w: 30, h: 70, link: 'h', dist: 72 }],
      levers: [{ x: 760, mode: 'toggle', link: 'v' }, { x: 1000, y: 340, mode: 'toggle', link: 'b' }, { x: 1800, mode: 'hold', link: 'h' }, { x: 2930, mode: 'toggle', link: 'w' }],
      bridges: [{ x: 1100, y: 440, w: 200, h: 16, link: 'b' }],
      lamps: [{ x: 1800, y: 322, ang: 0, half: 0.5, range: 150 }, { x: 2540, y: 384, ang: 1.15, half: 0.4, range: 230, patrol: { x1: 2540, x2: 2860, speed: 45 }, off: 'w' }],
      cps: [{ x: 80 }, { x: 860 }, { x: 1400 }, { x: 2250 }],
      exit: 3340
    },
    { // 3. Ярмарка: оловянные солдатики строем — плиты на своём расстоянии, люлька карусели, два ворота разом, молоты силомера
      w: 3200, look: 2,
      solids: ends(3200).concat([ground(-40, 1250), ground(1650, 3200), [1000, 36, 30, 264], [2300, 36, 30, 264]]),
      dolls: [{ id: 's1', kind: 'soldier', x: 300 }, { id: 's2', kind: 'soldier', x: 420 }, { id: 's3', kind: 'soldier', x: 1830 }, { id: 's4', kind: 'soldier', x: 1850 }],
      plates: [{ x: 690, w: 36, min: 1, link: 'p' }, { x: 850, w: 36, min: 1, link: 'q' }],
      doors: [{ x: 1000, y: 300, w: 30, h: 140, link: ['p', 'q'], dist: 150 }, { x: 2300, y: 300, w: 30, h: 140, link: ['r', 's'], dist: 150 }],
      movers: [{ x: 1258, y: 400, w: 84, h: 14, x2: 1560, period: 7, phase: 0 }],
      levers: [{ x: 1900, mode: 'hold', link: 'r' }, { x: 2150, mode: 'hold', link: 's' }],
      crushers: [{ x: 2520, y: 300, w: 60, h: 50, drop: 90, period: 2.4, phase: 0 }, { x: 2680, y: 300, w: 60, h: 50, drop: 90, period: 2.4, phase: 0.5 }],
      cps: [{ x: 80 }, { x: 1100 }, { x: 1720 }, { x: 2400 }, { x: 2850 }],
      exit: 3100
    },
    { // 4. Колокольный двор: тяжеловес — тяжёлая плита, болванка в яму, ступень в рост, подъёмник, тень «чехардой»
      w: 3440, look: 3,
      solids: ends(3440).concat([ground(-40, 1200), [1200, 500, 64, 80], ground(1264, 3440), [760, 36, 30, 264], [1300, 300, 400, 140], [2130, 250, 300, 14], [2300, 264, 40, 176], [2910, 300, 530, 140]]),
      dolls: [{ id: 'g1', kind: 'giant', x: 300 }, { id: 'g2', kind: 'giant', x: 990 }, { id: 'g3', kind: 'giant', x: 1820 }, { id: 'g4', kind: 'giant', x: 2520 }],
      crates: [{ id: 'h1', kind: 'heavy', x: 1100 }],
      plates: [{ x: 590, w: 60, min: 3, link: 'g' }, { x: 1880, w: 60, min: 3, link: 'L' }],
      doors: [{ x: 760, y: 300, w: 30, h: 140, link: 'g', dist: 150 }],
      lifts: [{ x: 2050, y: 430, w: 80, h: 14, y2: 250, link: 'L', speed: 80 }],
      lamps: [{ x: 2904, y: 380, ang: -1.45, half: 0.3, range: 360 }],
      cps: [{ x: 80 }, { x: 900 }, { x: 1500, y: 300 }, { x: 1780 }, { x: 2470 }],
      exit: 3300, exitY: 300
    },
    { // 5. Депо: молоты, ворот подъёмника держит носильщик, погоня катящегося барабана, плясунья под молотами
      w: 3800, look: 4,
      solids: ends(3800).concat([ground(-40, 2280), ground(2330, 2500), ground(2580, 3800), [1280, 280, 600, 14], [1500, 294, 30, 146]]),
      dolls: [{ id: 'p', kind: 'porter', x: 1020 }, { id: 'd', kind: 'dancer', x: 2760 }],
      levers: [{ x: 1100, mode: 'hold', link: 'up' }, { x: 3330, mode: 'toggle', link: 'cs' }],
      lifts: [{ x: 1200, y: 430, w: 80, h: 14, y2: 280, link: 'up', speed: 90 }],
      crushers: [{ x: 400, y: 300, w: 60, h: 50, drop: 90, period: 2.0, phase: 0 }, { x: 560, y: 300, w: 60, h: 50, drop: 90, period: 2.0, phase: 0.33 }, { x: 720, y: 300, w: 60, h: 50, drop: 90, period: 2.0, phase: 0.66 },
        { x: 2950, y: 300, w: 100, h: 50, drop: 62, period: 1.2, phase: 0, stop: 'cs' }, { x: 3050, y: 300, w: 100, h: 50, drop: 62, period: 1.2, phase: 0.33, stop: 'cs' }, { x: 3150, y: 300, w: 100, h: 50, drop: 62, period: 1.2, phase: 0.66, stop: 'cs' }],
      drums: [{ trig: 2050, x: 1890, y: 400, r: 40, speed: 125, end: 2540 }],
      cps: [{ x: 80 }, { x: 900 }, { x: 1960 }, { x: 2700 }],
      exit: 3650
    },
    { // 6. Башня часовщика: все куклы вместе — носильщик и плясунья, тяжеловес и подъёмник, солдатики в свете, большой завод
      w: 4000, look: 5, final: true,
      solids: ends(4000).concat([ground(-40, 4000), [650, 36, 30, 304], [1300, 220, 500, 14], [1500, 234, 30, 206], [2000, 300, 560, 14], [2560, 36, 30, 194], [2560, 300, 30, 140], [2590, 300, 300, 14], [3400, 200, 600, 14]]),
      ladders: [{ x: 1974, y: 300, w: 24, h: 140 }],
      dolls: [{ id: 'p', kind: 'porter', x: 300 }, { id: 'd', kind: 'dancer', x: 360 }, { id: 'g', kind: 'giant', x: 1000 }, { id: 's1', kind: 'soldier', x: 1935 }, { id: 's2', kind: 'soldier', x: 1955 }, { id: 'g2', kind: 'giant', x: 3050 }],
      plates: [{ x: 470, w: 44, min: 2, link: 'a' }, { x: 1100, w: 60, min: 3, link: 'h' }, { x: 3150, w: 60, min: 3, link: 't' }],
      levers: [{ x: 740, mode: 'toggle', link: 'b' }, { x: 2120, mode: 'hold', link: 'c1' }, { x: 2380, mode: 'hold', link: 'c2' }],
      doors: [{ x: 650, y: 340, w: 30, h: 74, link: ['a', 'b'], dist: 100 }, { x: 2560, y: 230, w: 30, h: 70, link: ['c1', 'c2'], dist: 72 }],
      lifts: [{ x: 1200, y: 430, w: 100, h: 14, y2: 220, link: 'h', speed: 90 }, { x: 3300, y: 430, w: 100, h: 14, y2: 200, link: 't', speed: 90 }],
      lamps: [{ x: 2120, y: 322, ang: 0, half: 0.5, range: 150 }, { x: 2380, y: 322, ang: 0, half: 0.5, range: 150 }, { x: 1600, y: 244, ang: 0, half: 0.3, range: 200, sweep: { amp: 0.45, period: 5, phase: 0 } }],
      cps: [{ x: 80 }, { x: 860 }, { x: 1880 }, { x: 2950 }],
      exit: 3800, exitY: 200
    }
  ];
})(typeof window !== 'undefined' ? window : globalThis);
