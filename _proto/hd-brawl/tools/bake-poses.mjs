// МЕДНАЯ СЛОБОДА · запекание ключевых поз в ЦЕЛЫЕ МАТРИЦЫ (js/poses.js).
// Черновик позы снимается со скелета (js/sprites.js → renderPose), затем применяются ручные правки FIX (пиксели «рукой»),
// результат обрезается по рамке и пишется строками-матрицами. В игре позы читаются только из js/poses.js.
// Запуск: node _proto/hd-brawl/tools/bake-poses.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.HB = { POSES: { hero: {}, foe: {} } };          // без старых поз: черновик идёт только со скелета
const S = require('../js/sprites.js');
const G = S.GROUND - 4;

// Цепочки (prev/prev2) задают отставание вторичных деталей: полог — на 1 кадр, хвосты повязки — на 2.
const KEYP = {
  jab_a:   { hip: [39, 49], lean: -0.05, face: 'a', aF: [46, 41], aN: [43, 43], lN: [35, G], lF: [47, G], prev: 'idle0', prev2: 'idle1' },
  jab:     { hip: [42, 49], lean: 0.2, face: 'a', aF: [61, 39], ebF: [0, 1], aN: [45, 42], lN: [35, G], lF: [51, G], prev: 'jab_a', prev2: 'idle0' },
  jab_r:   { hip: [41, 49], lean: 0.1, face: 'a', aF: [54, 40], aN: [44, 42], lN: [35, G], lF: [49, G], prev: 'jab', prev2: 'jab_a' },
  cross_a: { hip: [38, 49], lean: -0.15, face: 'a', aN: [35, 42], ebN: [0, 1], aF: [50, 40], lN: [33, G], lF: [47, G], prev: 'jab_r', prev2: 'jab' },
  cross:   { hip: [43, 49], lean: 0.35, face: 'a', aN: [65, 39], ebN: [0, 1], aF: [48, 44], lN: [36, G], lF: [53, G], prev: 'cross_a', prev2: 'jab_r' },
  cross_r: { hip: [42, 49], lean: 0.2, face: 'a', aN: [56, 41], aF: [49, 42], lN: [35, G], lF: [50, G], prev: 'cross', prev2: 'cross_a' },
  kick_a:  { hip: [39, 48], lean: -0.1, face: 'a', lN: [47, 56], kbN: [0.6, -1], lF: [38, G], aN: [45, 41], aF: [50, 39], prev: 'cross_r', prev2: 'cross' },
  kick:    { hip: [37, 48], lean: -0.3, face: 'a', lN: [62, 46], bootN: 3, lF: [37, G], aN: [29, 43], aF: [47, 40], prev: 'kick_a', prev2: 'cross_r' },
  kick_r:  { hip: [38, 48], lean: -0.15, face: 'a', lN: [49, 58], kbN: [0.6, -1], lF: [38, G], aN: [43, 42], aF: [49, 40], prev: 'kick', prev2: 'kick_a' },
  hurt:    { hip: [37, 49], lean: -0.35, face: 'h', head: [-1, 0], aN: [30, 45], ebN: [1, 1], aF: [45, 48], lN: [36, G], lF: [46, G], prev: 'jab', prev2: 'jab' },
  fall0:   { air: true, hip: [44, 52], lean: -0.8, face: 'h', aN: [30, 27], ebN: [-1, 0], aF: [38, 25], ebF: [-1, 0], armBehind: true, lN: [58, 58], kbN: [0, -1], lF: [54, 63], kbF: [0, -1], prev: 'hurt', prev2: 'hurt' },
  fall1:   { air: true, hip: [52, 52], rot: 3, head: [0, -6], face: 'h', aN: [44, 34], ebN: [-1, 0], aF: [50, 36], ebF: [-1, 0], lN: [69, 44], kbN: [0, -1], lF: [66, 48], kbF: [0, -1], bootN: 3, bootF: 3, noTails: true, prev: 'fall0', prev2: 'fall0' },
  down:    { hip: [52, 62], rot: 3, head: [0, -6], face: 'h', aN: [52, 67], ebN: [0, 1], aF: [44, 55], ebF: [-1, 0], lN: [70, G], kbN: [0, -1], lF: [66, G], kbF: [0, -1], noTails: true, prev: 'fall1', prev2: 'fall1' },
  getup0:  { hip: [40, 64], lean: -0.35, face: 'n', lN: [57, G], kbN: [0, -1], lF: [54, G], kbF: [0, -1], aN: [31, 64], ebN: [-1, 0], aF: [36, 62], prev: 'down', prev2: 'down' },
  getup1:  { hip: [40, 57], lean: 0.25, face: 'n', lN: [48, G], lF: [31, G], kbF: [0.4, 1], aN: [47, 52], aF: [52, 50], prev: 'getup0', prev2: 'down' },
  jump:    { air: true, hip: [40, 46], lean: 0.05, face: 'n', lN: [47, 58], kbN: [1, -0.3], lF: [38, 60], kbF: [1, -0.3], aN: [46, 38], aF: [52, 36], prev: 'idle0', prev2: 'idle0' },
  airkick: { air: true, hip: [40, 46], lean: -0.2, face: 'a', lN: [63, 58], lF: [40, 57], kbF: [1, -0.5], aN: [31, 41], aF: [50, 38], prev: 'jump', prev2: 'jump' }
};
// Ручные правки после черновика: [персонаж, поза, ряд, столбец, строка символов] ('_' — не трогать).
const FIX = [];

function bake(ch) {
  const specs = Object.assign({}, S.RUN, KEYP);
  const { frames } = S.bakeSet(specs, ch);
  const out = {};
  for (const k of Object.keys(KEYP)) {
    let rows = S.toRows(frames[k]);
    rows = S.patch(rows, FIX.filter(f => f[0] === ch && f[1] === k).map(f => f.slice(2)));
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] !== '.') { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } });
    out[k] = { ox: x0, oy: y0, rows: rows.slice(y0, y1 + 1).map(r => r.slice(x0, x1 + 1)) };
  }
  return out;
}
const data = { hero: bake('hero'), foe: bake('foe') };
let js = '/* МЕДНАЯ СЛОБОДА · КЛЮЧЕВЫЕ ПОЗЫ — целые матрицы кадров (символ = индекс палитры, см. KEY в sprites.js).\n' +
  '   Черновик снят со скелета tools/bake-poses.mjs и поправлен; ox/oy — место матрицы в каноническом кадре 80×72 (подошва — ряд 70). */\n' +
  '(function (g) {\n  var POSES = {\n';
for (const ch of Object.keys(data)) {
  js += '    ' + ch + ': {\n';
  const ks = Object.keys(data[ch]);
  ks.forEach((k, i) => { const m = data[ch][k];
    js += '      ' + k + ': { ox: ' + m.ox + ', oy: ' + m.oy + ', rows: [\n' + m.rows.map(r => "        '" + r + "'").join(',\n') + '\n      ] }' + (i < ks.length - 1 ? ',' : '') + '\n'; });
  js += '    }' + (ch === 'hero' ? ',' : '') + '\n';
}
js += '  };\n  g.HB = g.HB || {}; g.HB.POSES = POSES;\n  if (typeof module !== \'undefined\' && module.exports) module.exports = POSES;\n})(typeof window !== \'undefined\' ? window : globalThis);\n';
writeFileSync(path.join(here, '../js/poses.js'), js);
console.log('позы запечены:', Object.keys(KEYP).length, '× 2 персонажа →', js.length, 'байт');
