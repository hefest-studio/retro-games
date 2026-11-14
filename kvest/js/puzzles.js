/* МАЯЧНИЦА · puzzles.js — логика главы данными: правила взаимодействий, комбинации предметов, входы в сцены,
   авто-правила, кат-сцены, механизмы/мини-игры (widgets) и реестр головоломок (для подсчёта, подсказок и прохождения).
   Условия: 'flag' | '!flag' | 'inv:item' | '!inv:item'. Флаги 'w:<id>' — механизм решён, 'p_<id>' — головоломка решена.
   Действия: ['set'|'clear'|'toggle', flag], ['give'|'take', item], ['go', scene, x], ['think', icons], ['npcThink', obj, icons],
   ['npcPose', obj, pose], ['pose', pose], ['sfx', name], ['cut', id], ['mini', widgetId], ['win'].
   Правило выбирается первым подходящим (scene + hs + item + need). Без функций — данные сериализуются. */
(function (global) {
  'use strict';
  var K = global.KVEST = global.KVEST || {};
  function R(scene, list) { list.forEach(function (r) { r.scene = scene; }); return list; }

  var rules = [].concat(
    R('workshop', [
      { hs: 'shelf', need: ['!stoolMoved'], do: [['pose', 'reach'], ['think', ['stool', 'up']]] },
      { hs: 'shelf', need: ['stoolMoved'], do: [['give', 'oilcan'], ['set', 'got_oilcan'], ['sfx', 'take']], puzzle: 'p_shelf' },
      { hs: 'stool', do: [['set', 'stoolMoved'], ['sfx', 'push']] },
      { hs: 'hook', do: [['give', 'hook'], ['set', 'got_hook'], ['sfx', 'take']] },
      { hs: 'drawer', do: [['give', 'wick'], ['give', 'flint'], ['set', 'got_drawer'], ['sfx', 'take']] },
      { hs: 'master', need: ['!stoveLit'], do: [['npcThink', 'master', ['fire', 'cold']]] },
      { hs: 'master', do: [['npcThink', 'master', ['tower', 'lamp']]] },
      { hs: 'stove', item: 'logs', need: ['!logsIn'], do: [['take', 'logs'], ['set', 'logsIn'], ['sfx', 'wood']] },
      { hs: 'stove', item: 'flint', need: ['logsIn'], do: [['take', 'flint'], ['set', 'stoveLit'], ['sfx', 'fire']], puzzle: 'p_stove' },
      { hs: 'stove', item: 'flint', do: [['think', ['logs']]] },
      { hs: 'stove', item: 'lantern', need: ['stoveLit'], do: [['take', 'lantern'], ['give', 'lantern_lit'], ['sfx', 'fire']], puzzle: 'p_lantern' },
      { hs: 'stove', item: 'lantern', do: [['think', ['fire', 'question']]] },
      { hs: 'stove', need: ['!logsIn'], do: [['think', ['logs']]] },
      { hs: 'stove', need: ['!stoveLit'], do: [['think', ['flint']]] },
      { hs: 'stove', do: [['think', ['fire', 'heart']]] }
    ]),
    R('square', [
      { hs: 'well', item: 'bucket', do: [['take', 'bucket'], ['give', 'bucket_water'], ['sfx', 'water']], puzzle: 'p_well' },
      { hs: 'well', do: [['think', ['bucket', 'water']]] },
      { hs: 'baker', item: 'bucket_water', do: [['take', 'bucket_water'], ['give', 'bread'], ['npcThink', 'baker', ['heart']], ['sfx', 'ok']], puzzle: 'p_baker' },
      { hs: 'baker', need: ['!p_baker'], do: [['npcThink', 'baker', ['bucket_water']]] },
      { hs: 'baker', do: [['npcThink', 'baker', ['heart']]] },
      { hs: 'goat', item: 'bread', do: [['take', 'bread'], ['set', 'goatAway'], ['sfx', 'goat']], puzzle: 'p_goat' },
      { hs: 'goat', do: [['npcThink', 'goat', ['bread']], ['sfx', 'goat']] },
      { hs: 'woodpile', need: ['!goatAway'], do: [['think', ['goat', 'cross']]] },
      { hs: 'woodpile', do: [['give', 'logs'], ['set', 'got_logs'], ['sfx', 'wood']] },
      { hs: 'birds', do: [['sfx', 'birds'], ['think', ['bird', 'note']]] }
    ]),
    R('pier', [
      { hs: 'bdoor', item: 'key', need: ['!boatDoorOpen'], do: [['take', 'key'], ['set', 'boatDoorOpen'], ['sfx', 'unlock']], puzzle: 'p_boatdoor' },
      { hs: 'bdoor', need: ['!boatDoorOpen'], do: [['think', ['key', 'lock']]] },
      { hs: 'cat', item: 'fish', do: [['take', 'fish'], ['set', 'catFed'], ['give', 'key'], ['npcThink', 'cat', ['heart']], ['sfx', 'cat']], puzzle: 'p_cat' },
      { hs: 'cat', need: ['!catFed'], do: [['npcThink', 'cat', ['fish']], ['sfx', 'cat']] },
      { hs: 'cat', do: [['npcThink', 'cat', ['heart']]] },
      { hs: 'rope', do: [['give', 'rope'], ['set', 'got_rope'], ['sfx', 'take']] },
      { hs: 'bucket', do: [['give', 'bucket'], ['set', 'got_bucket'], ['sfx', 'take']] },
      { hs: 'net', item: 'grapple', need: ['!got_fish'], do: [['give', 'fish'], ['set', 'got_fish'], ['sfx', 'splash']], puzzle: 'p_net' },
      { hs: 'net', item: 'rope', do: [['think', ['rope', 'hook']]] },
      { hs: 'net', item: 'hook', do: [['think', ['rope', 'hook']]] },
      { hs: 'net', need: ['!got_fish'], do: [['think', ['fish', 'grapple']]] }
    ]),
    R('boathouse', [
      { hs: 'panel', need: ['!w:valves'], do: [['think', ['gauge', 'question']]] },
      { hs: 'panel', need: ['!w:pipes'], do: [['mini', 'pipes']] },
      { hs: 'panel', do: [['think', ['check']]] },
      { hs: 'spout', item: 'oilcan', need: ['w:pipes'], do: [['take', 'oilcan'], ['give', 'oilcan_full'], ['sfx', 'oil']], puzzle: 'p_oil' },
      { hs: 'spout', item: 'oilcan', do: [['think', ['pipe', 'cross']]] },
      { hs: 'spout', need: ['w:pipes'], do: [['think', ['oilcan']]] },
      { hs: 'spout', do: [['think', ['pipe', 'question']]] },
      { hs: 'crank', do: [['give', 'crank'], ['set', 'got_crank'], ['sfx', 'take']] },
      { hs: 'cloth', do: [['give', 'cloth'], ['set', 'got_cloth'], ['sfx', 'take']] }
    ]),
    R('cave', [
      { hs: 'pool', item: 'grapple', need: ['!got_shell'], do: [['give', 'shell'], ['set', 'got_shell'], ['sfx', 'splash']], puzzle: 'p_shell' },
      { hs: 'pool', need: ['!got_shell'], do: [['think', ['shell', 'grapple']]] },
      { hs: 'gull', need: ['!stepsUp'], do: [['pose', 'reach'], ['think', ['up', 'cross']]] },
      { hs: 'gull', item: 'shell', need: ['!stepsUp'], do: [['pose', 'reach'], ['think', ['up', 'cross']]] },
      { hs: 'gull', item: 'shell', need: ['!gullTrade'], do: [['take', 'shell'], ['give', 'lens_dirty'], ['set', 'gullTrade'], ['npcThink', 'gull', ['heart']], ['sfx', 'gull']], puzzle: 'p_gull' },
      { hs: 'gull', need: ['!gullTrade'], do: [['npcThink', 'gull', ['shell']], ['sfx', 'gull']] }
    ]),
    R('cliff', [
      { hs: 'winch', item: 'crank', need: ['!crankOn'], do: [['take', 'crank'], ['set', 'crankOn'], ['sfx', 'clank']] },
      { hs: 'winch', need: ['!crankOn'], do: [['think', ['crank']]] },
      { hs: 'pawl', need: ['!crankOn'], do: [['think', ['crank']]] }
    ]),
    R('tower', [
      { hs: 'door', need: ['!towerOpen'], do: [['think', ['lock', 'question']]] }
    ]),
    R('stairs', [
      { hs: 'chimes', need: ['!w:melody'], do: [['mini', 'melody']] },
      { hs: 'chimes', do: [['sfx', 'melody']] },
      { hs: 'gate', need: ['!w:melody'], do: [['think', ['note', 'question']]] }
    ]),
    R('lantern', [
      { hs: 'carriage', need: ['!w:frame'], do: [['mini', 'frame']] },
      { hs: 'lamp', item: 'lens', need: ['w:frame'], do: [['take', 'lens'], ['set', 'lensIn'], ['sfx', 'glass']] },
      { hs: 'lamp', item: 'lens', do: [['think', ['gear', 'cross']]] },
      { hs: 'lamp', item: 'lens_dirty', do: [['think', ['lens_dirty', 'cloth']]] },
      { hs: 'lamp', item: 'wick', do: [['take', 'wick'], ['set', 'wickIn'], ['sfx', 'take']] },
      { hs: 'lamp', item: 'oilcan_full', do: [['take', 'oilcan_full'], ['set', 'oilIn'], ['sfx', 'oil']] },
      { hs: 'lamp', item: 'oilcan', do: [['think', ['oilcan', 'cross']]] },
      { hs: 'lamp', item: 'lantern_lit', need: ['lensIn', 'wickIn', 'oilIn', '!lampLit'], do: [['set', 'lampLit'], ['sfx', 'fire']], puzzle: 'p_ignite' },
      { hs: 'lamp', item: 'lantern_lit', do: [['think', ['lamp', 'question']]] },
      { hs: 'lamp', need: ['!w:frame'], do: [['think', ['gear', 'question']]] },
      { hs: 'lamp', need: ['!lensIn'], do: [['think', ['lens']]] },
      { hs: 'lamp', need: ['!wickIn'], do: [['think', ['wick']]] },
      { hs: 'lamp', need: ['!oilIn'], do: [['think', ['oilcan_full']]] },
      { hs: 'lamp', need: ['!lampLit'], do: [['think', ['lantern_lit']]] }
    ])
  );

  K.PUZZLES = {
    start: { scene: 'workshop', flags: {}, inv: [] },
    goal: 'won',
    items: ['oilcan', 'oilcan_full', 'wick', 'flint', 'logs', 'lantern', 'lantern_lit', 'bucket', 'bucket_water', 'bread', 'rope', 'hook',
      'grapple', 'fish', 'key', 'crank', 'cloth', 'shell', 'lens_dirty', 'lens'],
    rules: rules,
    combos: [
      { a: 'rope', b: 'hook', do: [['take', 'rope'], ['take', 'hook'], ['give', 'grapple'], ['sfx', 'ok']], puzzle: 'p_grapple' },
      { a: 'lens_dirty', b: 'cloth', do: [['take', 'lens_dirty'], ['take', 'cloth'], ['give', 'lens'], ['sfx', 'glass']], puzzle: 'p_lens' }
    ],
    enter: [
      { scene: 'workshop', need: ['!introSeen'], do: [['cut', 'intro']] },
      { scene: 'cave', need: ['inv:lantern_lit', '!caveLit'], do: [['set', 'caveLit'], ['sfx', 'light']], puzzle: 'p_dark' },
      { scene: 'cave', need: ['!caveLit'], do: [['think', ['lantern', 'question']]] }
    ],
    autos: [
      { need: ['stoveLit', '!got_lantern'], do: [['cut', 'gift']] },
      { need: ['lensIn', 'wickIn', 'oilIn', '!p_lamp'], do: [['sfx', 'ok']], puzzle: 'p_lamp' },
      { need: ['lampLit', '!won'], do: [['cut', 'finale']] }
    ],
    // Кат-сцены движком. Шаги: ['wait', s], ['think', icons, s], ['npcThink', obj, icons, s], ['pose', p, s], ['npcPose', obj, p], ['walk', x] + действия.
    cuts: {
      intro: [['wait', 0.6], ['npcThink', 'master', ['tower', 'lamp_off'], 2.2], ['npcThink', 'master', ['fog', 'boat'], 2.2],
        ['npcThink', 'master', ['cold'], 1.4], ['think', ['lamp', 'check'], 1.6], ['pose', 'happy', 0.8], ['set', 'introSeen']],
      gift: [['wait', 0.5], ['npcPose', 'master', 'happy'], ['npcThink', 'master', ['heart'], 1.3], ['walk', 300],
        ['npcThink', 'master', ['lantern'], 1.3], ['give', 'lantern'], ['set', 'got_lantern'], ['sfx', 'take'], ['think', ['lantern', 'tower'], 1.6]],
      finale: [['wait', 0.6], ['pose', 'happy', 1.0], ['wait', 0.8], ['set', 'boats1'], ['sfx', 'ok'], ['wait', 1.3], ['set', 'boats2'], ['sfx', 'ok'],
        ['think', ['boat', 'heart'], 2.0], ['pose', 'happy', 1.4], ['win']]
    },
    // Механизмы в сцене (кликами по зонам hs) и мини-игры крупным планом (mini: true, открываются действием ['mini', id]).
    widgets: [
      { id: 'switches', type: 'toggles', scene: 'workshop', hs: ['sw1', 'sw2', 'sw3', 'sw4'], objs: ['sw1', 'sw2', 'sw3', 'sw4'], lamps: ['lt1', 'lt2', 'lt3', 'lt4'],
        masks: [[0, 1], [0, 1, 2], [1, 2, 3], [2, 3]], start: [1, 0, 0, 1], goal: [1, 1, 1, 1], onSolve: [['set', 'drawerOpen'], ['sfx', 'open']], puzzle: 'p_switches' },
      { id: 'crane', type: 'sequence', scene: 'pier', hs: ['cl1', 'cl2', 'cl3'], objs: ['cl1', 'cl2', 'cl3'], order: [1, 0, 2], machine: 'crane',
        onSolve: [['set', 'craneDown'], ['sfx', 'open']], puzzle: 'p_crane' },
      { id: 'valves', type: 'gauge', scene: 'boathouse', hs: ['v1', 'v2', 'v3'], objs: ['v1', 'v2', 'v3'], weights: [1, 2, 4], start: [0, 1, 0], target: 5, gauge: 'gauge',
        onSolve: [['sfx', 'ok']], puzzle: 'p_valves' },
      { id: 'plates', type: 'sequence', scene: 'cave', need: ['caveLit'], hs: ['pl1', 'pl2', 'pl3'], objs: ['pl1', 'pl2', 'pl3'], order: [2, 0, 1], press: true,
        onSolve: [['set', 'stepsUp'], ['sfx', 'stone']], puzzle: 'p_plates' },
      { id: 'winch', type: 'sequence', scene: 'cliff', need: ['crankOn'], hs: ['pawl', 'winch'], objs: ['pawl', null], order: [0, 1, 1, 1], machine: 'winch', lift: 'bridge',
        onSolve: [['set', 'bridgeDown'], ['sfx', 'bridge']], puzzle: 'p_winch' },
      { id: 'dials', type: 'dials', scene: 'tower', hs: ['d1', 'd2', 'd3'], objs: ['d1', 'd2', 'd3'], values: ['fish', 'star', 'bell', 'moon', 'shell', 'bird'],
        start: [3, 4, 5], target: [0, 1, 2], onSolve: [['set', 'towerOpen'], ['sfx', 'unlock']], puzzle: 'p_door' },
      // Трубы: shape I|L|T|X, sol — поворот в решении (не используется движком), r — поворот в начале; f — закреплена.
      { id: 'pipes', type: 'pipes', mini: true, mood: 'indoor', cols: 5, rows: 3, src: { c: 0, r: 1 }, dst: { c: 4, r: 1 },
        grid: [
          { s: 'L', r: 2 }, { s: 'L', r: 3 }, { s: 'I', r: 0 }, { s: 'L', r: 0 }, { s: 'I', r: 1 },
          { s: 'I', r: 0 }, { s: 'L', r: 1 }, { s: 'X', r: 0, f: 1 }, { s: 'L', r: 2 }, { s: 'I', r: 0 },
          { s: 'T', r: 1 }, { s: 'I', r: 1 }, { s: 'L', r: 3 }, { s: 'T', r: 0 }, { s: 'L', r: 1 }
        ], onSolve: [['sfx', 'oil']], puzzle: 'p_pipes' },
      { id: 'melody', type: 'melody', mini: true, mood: 'indoor', n: 5, target: [2, 4, 1, 3, 0], onSolve: [['sfx', 'melody']], puzzle: 'p_melody' },
      { id: 'frame', type: 'slider', mini: true, mood: 'night', n: 3, seed: 11, moves: 60, onSolve: [['sfx', 'ok']], puzzle: 'p_frame' },
      { id: 'fireflies', type: 'catch', mini: true, mood: 'night', count: 3, hintGame: true, onSolve: [] }
    ],
    // Реестр головоломок главы (порядок — сюжетный; по нему подсказка ищет текущую цель).
    // type: item (предметная) | mech (механизм в сцене) | mini (мини-игра крупным планом) | observe (подсказка в другой сцене: clue).
    puzzles: [
      { id: 'p_shelf', scene: 'workshop', type: 'mech', hint: ['stool', 'up', 'oilcan'] },
      { id: 'p_switches', scene: 'workshop', type: 'mech', hint: ['lamp', 'lamp', 'lamp', 'lamp'], sketch: ['lever', 'lever', 'lever', 'lever'] },
      { id: 'p_crane', scene: 'pier', type: 'mech', hint: ['gear', 'bucket'], sketch: ['dot2', 'dot1', 'dot3', 'bucket'] },
      { id: 'p_well', scene: 'square', type: 'item', avail: ['craneDown'], hint: ['bucket', 'well'] },
      { id: 'p_baker', scene: 'square', type: 'item', avail: ['inv:bucket_water'], hint: ['bucket_water', 'bread'] },
      { id: 'p_goat', scene: 'square', type: 'item', avail: ['inv:bread'], hint: ['bread', 'goat'] },
      { id: 'p_stove', scene: 'workshop', type: 'item', avail: ['drawerOpen'], hint: ['logs', 'flint', 'fire'] },
      { id: 'p_lantern', scene: 'workshop', type: 'item', avail: ['inv:lantern'], hint: ['lantern', 'fire'] },
      { id: 'p_grapple', scene: null, type: 'item', hint: ['rope', 'hook'], sketch: ['rope', 'hook', 'grapple'] },
      { id: 'p_net', scene: 'pier', type: 'item', avail: ['inv:grapple'], hint: ['grapple', 'fish'] },
      { id: 'p_cat', scene: 'pier', type: 'item', avail: ['inv:fish'], hint: ['fish', 'cat'], sketch: ['fish', 'cat', 'key'] },
      { id: 'p_boatdoor', scene: 'pier', type: 'item', avail: ['inv:key'], hint: ['key', 'door'] },
      { id: 'p_valves', scene: 'boathouse', type: 'mech', avail: ['boatDoorOpen'], hint: ['gauge', 'check'], sketch: ['lever_on', 'lever_off', 'lever_on'] },
      { id: 'p_pipes', scene: 'boathouse', type: 'mini', avail: ['w:valves'], hint: ['pipe', 'oilcan_full'] },
      { id: 'p_oil', scene: 'boathouse', type: 'item', avail: ['w:pipes'], hint: ['oilcan', 'oilcan_full'] },
      { id: 'p_dark', scene: 'cave', type: 'item', avail: ['inv:lantern_lit'], hint: ['lantern_lit', 'cave'] },
      { id: 'p_shell', scene: 'cave', type: 'item', avail: ['caveLit', 'inv:grapple'], hint: ['grapple', 'shell'] },
      { id: 'p_plates', scene: 'cave', type: 'observe', clue: 'boathouse', avail: ['caveLit'], hint: ['eye', 'barrel'], sketch: ['shell', 'moon', 'fish'] },
      { id: 'p_gull', scene: 'cave', type: 'item', avail: ['stepsUp', 'inv:shell'], hint: ['shell', 'gull'], sketch: ['shell', 'gull', 'lens_dirty'] },
      { id: 'p_lens', scene: null, type: 'item', avail: ['inv:lens_dirty'], hint: ['lens_dirty', 'cloth'], sketch: ['lens_dirty', 'cloth', 'lens'] },
      { id: 'p_winch', scene: 'cliff', type: 'mech', avail: ['boatDoorOpen'], hint: ['crank', 'bridge'], sketch: ['crank', 'lever', 'crank', 'crank', 'crank'] },
      { id: 'p_door', scene: 'tower', type: 'observe', clue: 'workshop', avail: ['bridgeDown'], hint: ['eye', 'hammer'], sketch: ['fish', 'star', 'bell'] },
      { id: 'p_melody', scene: 'stairs', type: 'mini', clue: 'square', avail: ['towerOpen'], hint: ['bird', 'note'], sketch: ['n2', 'n4', 'n1', 'n3', 'n0'] },
      { id: 'p_frame', scene: 'lantern', type: 'mini', avail: ['w:melody'], hint: ['gear', 'check'] },
      { id: 'p_lamp', scene: 'lantern', type: 'item', avail: ['w:frame'], hint: ['lens', 'wick', 'oilcan_full'] },
      { id: 'p_ignite', scene: 'lantern', type: 'item', avail: ['p_lamp'], hint: ['lantern_lit', 'lamp'] }
    ]
  };
})(typeof window !== 'undefined' ? window : globalThis);
