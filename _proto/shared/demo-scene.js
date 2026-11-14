/*
 * Демо-сцены для прототипов оформления «КВЕСТ» (формат — kvest-contract).
 * Одинаковая композиция для «бумаги» и «туши», чтобы сравнивать стили честно.
 * Только данные, без функций (сериализуемо).
 *
 * Необязательные поля, которые понимают обе темы прототипов:
 *   tone: 0|1        — дальний/ближний вариант (холмы);
 *   variant: 'hang'  — подвесная лампа;
 *   npc: 'keeper'|'cat' — какой персонаж у объекта kind:'npc';
 *   thought: [...]   — пиктограммы, о которых «думает» NPC (для прототипа).
 * Новый kind: 'shelf' (полка с банками/книгами) — добавить в kvest/js/theme-api.js.
 */
(function () {
  var yard = {
    id: 'yard',
    w: 960, h: 540,
    mood: 'dawn',
    layers: [
      { depth: 0, items: [
        { kind: 'sky' },
        { kind: 'moon', x: 772, y: 46, w: 46, h: 46, seed: 2 },
        { kind: 'cloud', x: 96, y: 74, w: 210, h: 62, seed: 2 },
        { kind: 'cloud', x: 520, y: 128, w: 150, h: 44, seed: 5 },
        { kind: 'hill', x: -20, y: 238, w: 1000, h: 302, seed: 3, tone: 0 },
        { kind: 'hill', x: -40, y: 318, w: 1040, h: 222, seed: 8, tone: 1 }
      ] },
      { depth: 1, items: [
        { kind: 'tree', x: 732, y: 140, w: 220, h: 305, seed: 4 },
        { kind: 'house', x: 64, y: 168, w: 300, h: 276, seed: 7, state: { windowLit: true } }
      ] },
      { depth: 2, items: [
        { kind: 'ground', x: 0, y: 430, w: 960, h: 110, seed: 1 },
        { kind: 'fence', x: 418, y: 352, w: 172, h: 92, seed: 2 },
        { kind: 'fence', x: 710, y: 352, w: 132, h: 92, seed: 9 },
        { kind: 'lamp', x: 380, y: 222, w: 32, h: 224, seed: 1, state: { lit: true } }
      ] },
      { depth: 3, items: [
        { kind: 'plant', x: -6, y: 394, w: 96, h: 146, seed: 1 },
        { kind: 'rock', x: 624, y: 492, w: 76, h: 40, seed: 3 },
        { kind: 'plant', x: 892, y: 428, w: 76, h: 112, seed: 6 }
      ] }
    ],
    objects: [
      { id: 'gate', kind: 'gate', x: 590, y: 318, w: 120, h: 128, state: { open: false } },
      { id: 'gear', kind: 'item', item: 'gear', x: 468, y: 476, w: 30, h: 24, state: { taken: false } },
      { id: 'keeper', kind: 'npc', npc: 'keeper', x: 812, y: 360, w: 70, h: 128, state: {}, thought: ['gear', 'arrow', 'gate'] }
    ],
    hotspots: [
      { id: 'houseDoor', rect: [244, 344, 64, 100], cursor: 'go', to: 'workshop' },
      { id: 'gate', rect: [590, 318, 120, 128], cursor: 'use' },
      { id: 'gear', rect: [458, 466, 50, 40], cursor: 'take' },
      { id: 'keeper', rect: [806, 356, 82, 136], cursor: 'look' }
    ],
    walk: [[40, 492], [500, 494], [920, 490]],
    hero: { x: 190, y: 492 }
  };

  var workshop = {
    id: 'workshop',
    w: 960, h: 540,
    mood: 'indoor',
    layers: [
      { depth: 0, items: [
        { kind: 'wall', x: 0, y: 0, w: 960, h: 440, seed: 2 },
        { kind: 'window', x: 650, y: 84, w: 168, h: 150, seed: 1 },
        { kind: 'floor', x: 0, y: 430, w: 960, h: 110, seed: 4 }
      ] },
      { depth: 1, items: [
        { kind: 'shelf', x: 214, y: 112, w: 230, h: 150, seed: 3 },
        { kind: 'pipe', x: 486, y: -10, w: 36, h: 262, seed: 2 },
        { kind: 'box', x: 836, y: 372, w: 96, h: 72, seed: 2 },
        { kind: 'box', x: 862, y: 318, w: 62, h: 56, seed: 5 },
        { kind: 'lamp', x: 300, y: -4, w: 64, h: 178, seed: 2, variant: 'hang', state: { lit: true } }
      ] },
      { depth: 3, items: [
        { kind: 'plant', x: 900, y: 450, w: 70, h: 90, seed: 11 }
      ] }
    ],
    objects: [
      { id: 'door', kind: 'door', x: 48, y: 192, w: 132, h: 252, state: { open: false } },
      { id: 'machine', kind: 'machine', x: 404, y: 236, w: 236, h: 208, state: { on: false } },
      { id: 'lever', kind: 'lever', x: 664, y: 330, w: 52, h: 114, state: { down: false } },
      { id: 'cup', kind: 'item', item: 'cup', x: 762, y: 476, w: 30, h: 26, state: { taken: false } },
      { id: 'cat', kind: 'npc', npc: 'cat', x: 856, y: 266, w: 72, h: 52, dir: -1, state: {}, thought: ['fish', 'cup', 'heart'] }
    ],
    hotspots: [
      { id: 'door', rect: [48, 192, 132, 252], cursor: 'go', to: 'yard' },
      { id: 'machine', rect: [404, 236, 236, 208], cursor: 'use' },
      { id: 'lever', rect: [656, 322, 68, 124], cursor: 'use' },
      { id: 'cup', rect: [752, 466, 50, 42], cursor: 'take' },
      { id: 'cat', rect: [846, 250, 92, 70], cursor: 'look' }
    ],
    walk: [[150, 496], [920, 496]],
    hero: { x: 260, y: 496 }
  };

  window.KvestDemoScenes = [yard, workshop];
})();
