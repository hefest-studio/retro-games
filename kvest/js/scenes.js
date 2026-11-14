/* МАЯЧНИЦА · scenes.js — данные сцен в формате контракта «КВЕСТ» (обычные объекты, без функций).
   Расширения пилота (движок их читает, тема игнорирует):
   - objects[].show — условия видимости ['flag', '!flag', 'inv:item'];  objects[].bind — {поле state: 'flag' | '!flag'};
   - hotspots[].need — когда зона активна; .at — x точки, куда подходит героиня; .look — пиктограммы осмотра;
     .to / .toX / .toNeed — переход в сцену (если условия выполнены и нет подходящего правила);
   - scene.icon — пиктограмма сцены (для подсказок и прохождения); scene.darkUnless — темно, пока флаг не поднят;
   - scene.walkIf — другая полоса ходьбы при условиях (мост опущен). */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  var W = 960, H = 540, FY = 452;
  function scene(o) { o.w = W; o.h = H; return o; }
  function row(n, f) { var a = []; for (var i = 0; i < n; i++) a.push(f(i)); return a; }

  K.SCENES = [
    // 1. Мастерская фонарщика: печь остыла, мастер простужен; полка, верстак с четырьмя связанными тумблерами, чертёж-код.
    scene({ id: 'workshop', mood: 'indoor', icon: 'hammer',
      layers: [
        { depth: 0, items: [{ kind: 'wall', x: 0, y: 0, w: 960, h: 452, seed: 1 }, { kind: 'window', x: 610, y: 56, w: 130, h: 104, seed: 2 }] },
        { depth: 1, items: [{ kind: 'shelf', x: 480, y: 200, w: 170, h: 14 }, { kind: 'lamp', x: 290, y: 0, w: 34, h: 96, state: { hang: true, lit: true } }] },
        { depth: 2, items: [{ kind: 'floor', x: 0, y: 452, w: 960, h: 88 }] },
        { depth: 3, items: [] }
      ],
      objects: [
        { id: 'stove', kind: 'machine', x: 40, y: 236, w: 130, h: 216, state: { variant: 'stove' }, bind: { wood: 'logsIn', fire: 'stoveLit' } },
        { id: 'master', kind: 'npc', x: 196, y: 318, w: 82, h: 134, state: { type: 'master' }, bind: { warm: 'stoveLit' } },
        { id: 'chart', kind: 'sign', x: 330, y: 108, w: 132, h: 88, state: { icons: ['fish', 'star', 'bell'] } },
        { id: 'hook', kind: 'item', item: 'hook', x: 436, y: 250, w: 34, h: 38, show: ['!got_hook'] },
        { id: 'oilcan', kind: 'item', item: 'oilcan', x: 545, y: 164, w: 38, h: 36, show: ['!got_oilcan'] },
        { id: 'stool', kind: 'box', x: 350, y: 406, w: 56, h: 46, state: { variant: 'stool' }, show: ['!stoolMoved'] },
        { id: 'stool2', kind: 'box', x: 536, y: 406, w: 56, h: 46, state: { variant: 'stool' }, show: ['stoolMoved'] },
        { id: 'bench', kind: 'box', x: 660, y: 342, w: 190, h: 110, state: { variant: 'bench' }, bind: { open: 'drawerOpen', empty: 'got_drawer' } }
      ].concat(row(4, function (i) { return { id: 'lt' + (i + 1), kind: 'lamp', x: 680 + i * 44, y: 236, w: 22, h: 30, state: { small: true } }; }))
        .concat(row(4, function (i) { return { id: 'sw' + (i + 1), kind: 'lever', x: 680 + i * 44, y: 290, w: 22, h: 48, state: {} }; }))
        .concat([{ id: 'door', kind: 'door', x: 880, y: 272, w: 70, h: 180, state: { open: false } }]),
      hotspots: [
        { id: 'stove', rect: [40, 236, 130, 216], cursor: 'use', at: 186 },
        { id: 'master', rect: [196, 318, 82, 134], cursor: 'look', at: 300 },
        { id: 'chart', rect: [330, 108, 132, 88], cursor: 'look', at: 396, look: ['fish', 'star', 'bell'] },
        { id: 'hook', rect: [430, 244, 46, 50], cursor: 'take', at: 452, need: ['!got_hook'] },
        { id: 'stool', rect: [350, 406, 56, 46], cursor: 'use', at: 330, need: ['!stoolMoved'] },
        { id: 'shelf', rect: [480, 140, 170, 76], cursor: 'take', at: 564, need: ['!got_oilcan'] }
      ].concat(row(4, function (i) { return { id: 'sw' + (i + 1), rect: [674 + i * 44, 284, 34, 58], cursor: 'use', at: 756, look: ['lamp'] }; }))
        .concat([
          { id: 'drawer', rect: [660, 392, 190, 50], cursor: 'take', at: 756, need: ['drawerOpen', '!got_drawer'] },
          { id: 'door', rect: [880, 272, 70, 180], cursor: 'go', at: 915, to: 'square', toX: 70 }
        ]),
      walk: [[60, FY], [932, FY]], hero: { x: 300, y: FY } }),

    // 2. Площадь посёлка: пекарня (пекарша без воды), колодец без ведра, коза на поленнице, птицы на столбиках забора — мелодия.
    scene({ id: 'square', mood: 'day', icon: 'well',
      layers: [
        { depth: 0, items: [{ kind: 'sky' }, { kind: 'cloud', x: 120, y: 46, w: 150, h: 44, seed: 1 }, { kind: 'cloud', x: 640, y: 80, w: 110, h: 34, seed: 2 },
          { kind: 'hill', x: 0, y: 230, w: 960, h: 230, seed: 4 }, { kind: 'tower', x: 840, y: 120, w: 46, h: 140, seed: 1 }] },
        { depth: 1, items: [{ kind: 'house', x: 120, y: 190, w: 236, h: 262, seed: 3, state: { windowLit: false } }, { kind: 'tree', x: 470, y: 170, w: 90, h: 180, seed: 2 },
          { kind: 'lamp', x: 396, y: 300, w: 16, h: 152, state: { lit: false } }] },
        { depth: 2, items: [{ kind: 'ground', x: 0, y: 452, w: 960, h: 88 }, { kind: 'fence', x: 706, y: 372, w: 200, h: 80 }] },
        { depth: 3, items: [{ kind: 'plant', x: 6, y: 410, w: 50, h: 70, seed: 1 }] }
      ],
      objects: [
        { id: 'baker', kind: 'npc', x: 198, y: 250, w: 70, h: 68, state: { type: 'baker' } },
        { id: 'well', kind: 'machine', x: 436, y: 330, w: 96, h: 122, state: { variant: 'well' } },
        { id: 'woodpile', kind: 'box', x: 568, y: 368, w: 112, h: 84, state: { variant: 'logs' }, bind: { empty: 'got_logs' } },
        { id: 'goat', kind: 'npc', x: 580, y: 370, w: 96, h: 82, state: { type: 'goat' }, show: ['!goatAway'] },
        { id: 'goat2', kind: 'npc', x: 252, y: 384, w: 84, h: 68, state: { type: 'goat', pose: 'happy' }, show: ['goatAway'] }
      ].concat([2, 4, 1, 3, 0].map(function (n, i) { var y = 338 - n * 18; return { id: 'bird' + (i + 1), kind: 'npc', x: 712 + i * 40, y: y, w: 28, h: 452 - y, state: { type: 'bird', post: true, note: n } }; })),
      hotspots: [
        { id: 'toWorkshop', rect: [0, 270, 44, 182], cursor: 'go', at: 24, to: 'workshop', toX: 860 },
        { id: 'baker', rect: [190, 242, 86, 84], cursor: 'look', at: 236 },
        { id: 'toCliff', rect: [362, 292, 66, 160], cursor: 'go', at: 396, to: 'cliff', toX: 70 },
        { id: 'well', rect: [436, 330, 96, 122], cursor: 'use', at: 484 },
        { id: 'woodpile', rect: [568, 340, 112, 112], cursor: 'take', at: 604, need: ['!got_logs'] },
        { id: 'goat', rect: [580, 370, 96, 82], cursor: 'look', at: 604, need: ['!goatAway'] },
        { id: 'goat2', rect: [252, 384, 84, 68], cursor: 'look', at: 300, need: ['goatAway'], look: ['heart'] },
        { id: 'birds', rect: [706, 250, 204, 202], cursor: 'look', at: 800 },
        { id: 'toPier', rect: [916, 270, 44, 182], cursor: 'go', at: 940, to: 'pier', toX: 70 }
      ],
      walk: [[24, FY], [940, FY]], hero: { x: 80, y: FY } }),

    // 3. Причал: запертый лодочный сарай, кошка, верёвка, кран с ведром (три рычага по порядку), сеть в воде, лестница в грот.
    scene({ id: 'pier', mood: 'dusk', icon: 'boat',
      layers: [
        { depth: 0, items: [{ kind: 'sky' }, { kind: 'cloud', x: 420, y: 60, w: 160, h: 40, seed: 3 }, { kind: 'hill', x: 300, y: 250, w: 660, h: 90, seed: 9 },
          { kind: 'water', x: 0, y: 300, w: 960, h: 240, seed: 2 }] },
        { depth: 1, items: [{ kind: 'house', x: 56, y: 178, w: 256, h: 274, seed: 5, state: { door: false } }] },
        { depth: 2, items: [{ kind: 'bridge', x: 0, y: 452, w: 960, h: 28, state: { pier: true } }, { kind: 'fence', x: 900, y: 360, w: 40, h: 118, state: { ladder: true } }] },
        { depth: 3, items: [] }
      ],
      objects: [
        { id: 'bdoor', kind: 'door', x: 190, y: 334, w: 64, h: 118, state: {}, bind: { open: 'boatDoorOpen', lock: '!boatDoorOpen' } },
        { id: 'catbox', kind: 'box', x: 318, y: 418, w: 80, h: 34, state: {} },
        { id: 'cat', kind: 'npc', x: 330, y: 362, w: 58, h: 58, state: { type: 'cat' }, bind: { fed: 'catFed' } },
        { id: 'rope', kind: 'item', item: 'rope', x: 424, y: 420, w: 42, h: 30, show: ['!got_rope'] },
        { id: 'crane', kind: 'machine', x: 540, y: 160, w: 210, h: 292, state: { variant: 'crane' }, bind: { load: '!got_bucket' } }
      ].concat(row(3, function (i) { return { id: 'cl' + (i + 1), kind: 'lever', x: 560 + i * 34, y: 398, w: 18, h: 46, state: {} }; }))
        .concat([{ id: 'net', kind: 'box', x: 790, y: 380, w: 92, h: 80, state: { variant: 'net' }, bind: { empty: 'got_fish' } }]),
      hotspots: [
        { id: 'toSquare', rect: [0, 270, 40, 182], cursor: 'go', at: 22, to: 'square', toX: 890 },
        { id: 'bdoor', rect: [190, 334, 64, 118], cursor: 'use', at: 222, to: 'boathouse', toX: 110, toNeed: ['boatDoorOpen'] },
        { id: 'cat', rect: [318, 360, 80, 92], cursor: 'look', at: 360 },
        { id: 'rope', rect: [418, 410, 54, 44], cursor: 'take', at: 444, need: ['!got_rope'] }
      ].concat(row(3, function (i) { return { id: 'cl' + (i + 1), rect: [554 + i * 34, 390, 30, 60], cursor: 'use', at: 612, look: ['gear'] }; }))
        .concat([
          { id: 'bucket', rect: [736, 352, 52, 62], cursor: 'take', at: 744, need: ['craneDown', '!got_bucket'] },
          { id: 'net', rect: [790, 370, 92, 90], cursor: 'use', at: 836 },
          { id: 'toCave', rect: [896, 360, 50, 118], cursor: 'go', at: 920, to: 'cave', toX: 96 }
        ]),
      walk: [[22, FY], [930, FY]], hero: { x: 80, y: FY } }),

    // 4. Лодочный сарай: бак с маслом, три вентиля и манометр, щит с трубами (мини-игра), носик, табличка-подсказка, ворот, тряпица.
    scene({ id: 'boathouse', mood: 'indoor', icon: 'barrel',
      layers: [
        { depth: 0, items: [{ kind: 'wall', x: 0, y: 0, w: 960, h: 452, seed: 4 }, { kind: 'window', x: 820, y: 80, w: 90, h: 80, seed: 1 }] },
        { depth: 1, items: [{ kind: 'pipe', x: 270, y: 210, w: 180, h: 14 }, { kind: 'pipe', x: 630, y: 230, w: 50, h: 14 }, { kind: 'lamp', x: 520, y: 0, w: 30, h: 80, state: { hang: true, lit: true } }] },
        { depth: 2, items: [{ kind: 'floor', x: 0, y: 452, w: 960, h: 88 }] },
        { depth: 3, items: [] }
      ],
      objects: [
        { id: 'door', kind: 'door', x: 26, y: 272, w: 70, h: 180, state: { open: true } },
        { id: 'tank', kind: 'machine', x: 120, y: 180, w: 150, h: 272, state: { variant: 'tank' } },
        { id: 'gauge', kind: 'machine', x: 296, y: 246, w: 110, h: 92, state: { variant: 'gauge' } }
      ].concat(row(3, function (i) { return { id: 'v' + (i + 1), kind: 'lever', x: 302 + i * 40, y: 370, w: 20, h: 48, state: {} }; }))
        .concat([
          { id: 'panel', kind: 'box', x: 446, y: 196, w: 180, h: 150, state: { variant: 'panel' }, bind: { ok: 'w:pipes' } },
          { id: 'spout', kind: 'machine', x: 650, y: 230, w: 52, h: 130, state: { variant: 'spout' }, bind: { drip: 'w:pipes' } },
          { id: 'sign', kind: 'sign', x: 720, y: 200, w: 150, h: 76, state: { icons: ['shell', 'moon', 'fish'] } },
          { id: 'crank', kind: 'item', item: 'crank', x: 880, y: 300, w: 44, h: 44, show: ['!got_crank'] },
          { id: 'cloth', kind: 'item', item: 'cloth', x: 760, y: 420, w: 42, h: 30, show: ['!got_cloth'] }
        ]),
      hotspots: [
        { id: 'toPier', rect: [26, 272, 70, 180], cursor: 'go', at: 60, to: 'pier', toX: 222 },
        { id: 'tank', rect: [120, 180, 150, 272], cursor: 'look', at: 200, look: ['oilcan_full'] },
        { id: 'gauge', rect: [296, 246, 110, 92], cursor: 'look', at: 350, look: ['gauge', 'check'] }
      ].concat(row(3, function (i) { return { id: 'v' + (i + 1), rect: [296 + i * 40, 362, 32, 62], cursor: 'use', at: 350, look: ['gauge'] }; }))
        .concat([
          { id: 'panel', rect: [446, 196, 180, 150], cursor: 'use', at: 536 },
          { id: 'spout', rect: [650, 230, 52, 130], cursor: 'use', at: 676 },
          { id: 'sign', rect: [720, 200, 150, 76], cursor: 'look', at: 796, look: ['shell', 'moon', 'fish'] },
          { id: 'cloth', rect: [752, 410, 58, 44], cursor: 'take', at: 780, need: ['!got_cloth'] },
          { id: 'crank', rect: [872, 292, 60, 60], cursor: 'take', at: 900, need: ['!got_crank'] }
        ]),
      walk: [[60, FY], [930, FY]], hero: { x: 110, y: FY } }),

    // 5. Грот под причалом: темно без огня; лужа с ракушкой, три плиты со знаками (порядок — табличка в сарае), ступени, гнездо чайки с линзой.
    scene({ id: 'cave', mood: 'cave', icon: 'cave', darkUnless: 'caveLit',
      layers: [
        { depth: 0, items: [{ kind: 'wall', x: 0, y: 0, w: 960, h: 452, seed: 6, state: { cave: true } }] },
        { depth: 1, items: [{ kind: 'rock', x: 180, y: 120, w: 140, h: 110, seed: 3 }, { kind: 'fence', x: 56, y: 230, w: 44, h: 222, state: { ladder: true } }] },
        { depth: 2, items: [{ kind: 'ground', x: 0, y: 452, w: 960, h: 88 }] },
        { depth: 3, items: [{ kind: 'rock', x: 900, y: 420, w: 70, h: 70, seed: 8 }] }
      ],
      objects: [
        { id: 'pool', kind: 'water', x: 130, y: 440, w: 200, h: 40, seed: 5, state: {}, bind: { shell: '!got_shell' } }
      ].concat(['moon', 'fish', 'shell'].map(function (ic, i) { return { id: 'pl' + (i + 1), kind: 'rock', x: 392 + i * 80, y: 440, w: 64, h: 16, seed: i, state: { icon: ic, plate: true } }; }))
        .concat([
          { id: 'steps', kind: 'rock', x: 640, y: 332, w: 120, h: 120, seed: 4, state: { variant: 'steps' }, bind: { up: 'stepsUp' } },
          { id: 'pillar', kind: 'rock', x: 770, y: 200, w: 130, h: 252, seed: 7, state: { variant: 'pillar' } },
          { id: 'gull', kind: 'npc', x: 790, y: 120, w: 92, h: 80, state: { type: 'gull' }, bind: { traded: 'gullTrade' } },
          { id: 'lensNest', kind: 'item', item: 'lens_dirty', x: 846, y: 170, w: 30, h: 30, show: ['!gullTrade'] }
        ]),
      hotspots: [
        { id: 'toPier', rect: [50, 230, 60, 222], cursor: 'go', at: 80, to: 'pier', toX: 900 },
        { id: 'pool', rect: [130, 420, 200, 60], cursor: 'use', at: 232, need: ['caveLit'] }
      ].concat(row(3, function (i) { return { id: 'pl' + (i + 1), rect: [386 + i * 80, 418, 76, 44], cursor: 'use', at: 424 + i * 80, need: ['caveLit'], look: ['eye'] }; }))
        .concat([
          { id: 'steps', rect: [640, 332, 120, 120], cursor: 'look', at: 700, need: ['caveLit'], look: ['up'] },
          { id: 'gull', rect: [776, 110, 126, 110], cursor: 'use', at: 760, need: ['caveLit'] }
        ]),
      walk: [[80, FY], [900, FY]], hero: { x: 96, y: FY } }),

    // 6. Тропа на мыс: ущелье, подъёмный мост, лебёдка без рукояти и стопор.
    scene({ id: 'cliff', mood: 'dusk', icon: 'bridge',
      layers: [
        { depth: 0, items: [{ kind: 'sky' }, { kind: 'cloud', x: 200, y: 70, w: 140, h: 40, seed: 5 }, { kind: 'hill', x: 0, y: 220, w: 960, h: 120, seed: 2 },
          { kind: 'tower', x: 850, y: 40, w: 70, h: 270, seed: 2 }, { kind: 'water', x: 500, y: 470, w: 320, h: 70, seed: 4 }] },
        { depth: 1, items: [{ kind: 'rock', x: -20, y: 452, w: 530, h: 100, seed: 1 }, { kind: 'rock', x: 812, y: 452, w: 170, h: 100, seed: 2 }] },
        { depth: 2, items: [{ kind: 'tree', x: 150, y: 250, w: 80, h: 200, seed: 4 }] },
        { depth: 3, items: [{ kind: 'plant', x: 0, y: 420, w: 60, h: 60, seed: 3 }] }
      ],
      objects: [
        { id: 'pawl', kind: 'lever', x: 334, y: 398, w: 18, h: 54, state: {} },
        { id: 'winch', kind: 'machine', x: 380, y: 332, w: 92, h: 120, state: { variant: 'winch' }, bind: { crank: 'crankOn' } },
        { id: 'bridge', kind: 'bridge', x: 494, y: 448, w: 326, h: 18, state: {}, bind: { down: 'bridgeDown' } }
      ],
      hotspots: [
        { id: 'toSquare', rect: [0, 270, 40, 182], cursor: 'go', at: 22, to: 'square', toX: 396 },
        { id: 'pawl', rect: [326, 390, 34, 64], cursor: 'use', at: 344 },
        { id: 'winch', rect: [380, 332, 92, 120], cursor: 'use', at: 430 },
        { id: 'bridge', rect: [500, 280, 300, 170], cursor: 'look', at: 480, need: ['!bridgeDown'], look: ['crank', 'bridge'] },
        { id: 'toTower', rect: [900, 270, 60, 182], cursor: 'go', at: 936, to: 'tower', toX: 80, need: ['bridgeDown'] }
      ],
      walk: [[22, FY], [488, FY]], walkIf: [{ need: ['bridgeDown'], walk: [[22, FY], [940, FY]] }], hero: { x: 70, y: FY } }),

    // 7. Подножие маяка: дверь с кодовым замком из трёх дисков (код — на чертеже в мастерской).
    scene({ id: 'tower', mood: 'night', icon: 'tower',
      layers: [
        { depth: 0, items: [{ kind: 'sky' }, { kind: 'moon', x: 120, y: 60, w: 50, h: 50 }, { kind: 'cloud', x: 650, y: 90, w: 150, h: 40, seed: 6 },
          { kind: 'water', x: 0, y: 330, w: 960, h: 210, seed: 7 }] },
        { depth: 1, items: [{ kind: 'rock', x: -10, y: 400, w: 980, h: 140, seed: 5 }] },
        { depth: 2, items: [{ kind: 'ground', x: 0, y: 452, w: 960, h: 88 }] },
        { depth: 3, items: [{ kind: 'plant', x: 900, y: 420, w: 60, h: 70, seed: 2 }] }
      ],
      objects: [
        { id: 'lighthouse', kind: 'tower', x: 380, y: 10, w: 220, h: 442, seed: 3, state: {}, bind: { lit: 'lampLit' } },
        { id: 'door', kind: 'door', x: 450, y: 322, w: 80, h: 130, state: {}, bind: { open: 'towerOpen' } }
      ].concat(row(3, function (i) { return { id: 'd' + (i + 1), kind: 'box', x: 560 + i * 46, y: 340, w: 40, h: 40, state: { icon: 'moon' } }; })),
      hotspots: [
        { id: 'toCliff', rect: [0, 270, 40, 182], cursor: 'go', at: 22, to: 'cliff', toX: 900 },
        { id: 'door', rect: [450, 322, 80, 130], cursor: 'use', at: 490, to: 'stairs', toX: 120, toNeed: ['towerOpen'] }
      ].concat(row(3, function (i) { return { id: 'd' + (i + 1), rect: [556 + i * 46, 334, 46, 52], cursor: 'use', at: 606, look: ['eye'] }; })),
      walk: [[22, FY], [930, FY]], hero: { x: 80, y: FY } }),

    // 8. Лестница маяка: решётка наверх открывается мелодией на пяти колокольчиках (мелодия — птицы на площади).
    scene({ id: 'stairs', mood: 'indoor', icon: 'stairs',
      layers: [
        { depth: 0, items: [{ kind: 'wall', x: 0, y: 0, w: 960, h: 452, seed: 9 }, { kind: 'window', x: 160, y: 90, w: 50, h: 110, seed: 3 }] },
        { depth: 1, items: [{ kind: 'fence', x: 620, y: 200, w: 300, h: 252, state: { stairs: true } }, { kind: 'lamp', x: 470, y: 0, w: 30, h: 70, state: { hang: true, lit: true } }] },
        { depth: 2, items: [{ kind: 'floor', x: 0, y: 452, w: 960, h: 88 }] },
        { depth: 3, items: [] }
      ],
      objects: [
        { id: 'downdoor', kind: 'door', x: 40, y: 302, w: 70, h: 150, state: { open: true } }
      ].concat(row(5, function (i) { return { id: 'c' + (i + 1), kind: 'chime', x: 340 + i * 52, y: 96, w: 30, h: 150, state: { note: i, n: 5 } }; }))
        .concat([{ id: 'gate', kind: 'gate', x: 700, y: 196, w: 150, h: 256, state: {}, bind: { open: 'w:melody' } }]),
      hotspots: [
        { id: 'toTower', rect: [40, 302, 70, 150], cursor: 'go', at: 72, to: 'tower', toX: 490 },
        { id: 'chimes', rect: [330, 90, 270, 220], cursor: 'use', at: 470 },
        { id: 'gate', rect: [700, 196, 150, 256], cursor: 'use', at: 770, to: 'lantern', toX: 160, toNeed: ['w:melody'] }
      ],
      walk: [[72, FY], [900, FY]], hero: { x: 120, y: FY } }),

    // 9. Фонарная комната: большой фонарь (линза, фитиль, масло, огонь), каретка-оправа (сдвижная мини-игра), лодки в море.
    scene({ id: 'lantern', mood: 'night', icon: 'lamp',
      layers: [
        { depth: 0, items: [{ kind: 'sky' }, { kind: 'moon', x: 780, y: 50, w: 44, h: 44 }, { kind: 'water', x: 0, y: 300, w: 960, h: 240, seed: 9 },
          { kind: 'cloud', x: 120, y: 80, w: 160, h: 46, seed: 7 }] },
        { depth: 1, items: [{ kind: 'window', x: 30, y: 40, w: 300, h: 300, seed: 5, state: { frameOnly: true } }, { kind: 'window', x: 630, y: 40, w: 300, h: 300, seed: 6, state: { frameOnly: true } }] },
        { depth: 2, items: [{ kind: 'floor', x: 0, y: 452, w: 960, h: 88 }] },
        { depth: 3, items: [] }
      ],
      objects: [
        { id: 'boat1', kind: 'item', item: 'boat', x: 110, y: 318, w: 56, h: 34, show: ['boats1'] },
        { id: 'boat2', kind: 'item', item: 'boat', x: 780, y: 330, w: 64, h: 38, show: ['boats2'] },
        { id: 'boat3', kind: 'item', item: 'boat', x: 250, y: 360, w: 70, h: 42, show: ['boats2'] },
        { id: 'hatch', kind: 'door', x: 40, y: 402, w: 84, h: 50, state: { hatch: true, open: true } },
        { id: 'lamp', kind: 'lamp', x: 400, y: 150, w: 180, h: 232, state: { big: true }, bind: { lens: 'lensIn', wick: 'wickIn', oil: 'oilIn', lit: 'lampLit' } },
        { id: 'carriage', kind: 'machine', x: 360, y: 382, w: 260, h: 70, state: { variant: 'carriage' }, bind: { ok: 'w:frame' } }
      ],
      hotspots: [
        { id: 'toStairs', rect: [40, 392, 84, 60], cursor: 'go', at: 82, to: 'stairs', toX: 760 },
        { id: 'carriage', rect: [360, 382, 260, 70], cursor: 'use', at: 490 },
        { id: 'lamp', rect: [400, 150, 180, 232], cursor: 'use', at: 490 }
      ],
      walk: [[82, FY], [900, FY]], hero: { x: 160, y: FY } })
  ];
})(typeof window !== 'undefined' ? window : globalThis);
