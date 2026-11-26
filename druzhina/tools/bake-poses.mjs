// ДРУЖИНА · тема HD v2: запекание КЛЮЧЕВЫХ ПОЗ в целые матрицы (js/hd-poses.js).
// Черновик снимается со скелета (js/hd-sprites.js → renderSet по POSE), затем ручные правки FIX (пиксели «рукой»),
// результат обрезается по рамке и пишется строками-матрицами (RLE: «4.kk» = «....kk»). В игре позы читаются из js/hd-poses.js;
// у кого поз в файле нет (боссы 2-го плана) — собираются при загрузке. Запуск: node druzhina/tools/bake-poses.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
globalThis.DRUZHINA = {};                                   // без старых поз: черновик только со скелета
const S = require('../js/hd-sprites.js');
// Ручные правки: [персонаж, поза, ряд, столбец, строка символов] — координаты канонического кадра ('_' — не трогать, '.' — стереть).
// Пример: ['zhdan', 'over_a', 40, 60, 'gW'] — два пикселя блика. Сейчас правок нет: черновики со скелета прошли проверку листом ×6.
const FIX = [];
const data = {};
let n = 0;
for (const ch of S.STORED) {
  const names = S.keyPoses(ch), set = S.renderSet(ch, names);
  data[ch] = {};
  for (const k of names) {
    const f = set[k], fx = FIX.filter(x => x[0] === ch && x[1] === k).map(x => x.slice(2));
    let rows = S.toRows(f); if (fx.length) { const m = S.parse(rows); S.seg(m, fx); rows = S.toRows(m); }
    const c = S.crop(S.parse(rows));
    data[ch][k] = c; n++;
  }
}
let js = '/* ДРУЖИНА · тема HD v2 — КЛЮЧЕВЫЕ ПОЗЫ целыми матрицами (символ = индекс палитры, см. KEY в js/hd-sprites.js; строки в RLE: «4.kk» = «....kk»).\n' +
  '   Сгенерировано tools/bake-poses.mjs (черновик со скелета + правки FIX); ox/oy — место матрицы в каноническом кадре тела. */\n' +
  '(function (g) {\n  var P = {\n';
const chs = Object.keys(data);
chs.forEach((ch, i) => {
  js += '    ' + ch + ': {\n';
  const ks = Object.keys(data[ch]);
  ks.forEach((k, j) => { const m = data[ch][k];
    js += '      ' + k + ': { ox: ' + m.ox + ', oy: ' + m.oy + ', rows: [\n' + m.rows.map(r => "        '" + S.rle(r) + "'").join(',\n') + '\n      ] }' + (j < ks.length - 1 ? ',' : '') + '\n'; });
  js += '    }' + (i < chs.length - 1 ? ',' : '') + '\n';
});
js += '  };\n  var D = g.DRUZHINA = g.DRUZHINA || {}; D.HD_POSES = P;\n  if (typeof module !== \'undefined\' && module.exports) module.exports = P;\n})(typeof window !== \'undefined\' ? window : globalThis);\n';
writeFileSync(path.join(here, '../js/hd-poses.js'), js);
console.log('позы запечены:', n, 'матриц,', chs.length, 'персонажей →', js.length, 'байт');
