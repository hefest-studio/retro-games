// МЕДНАЯ СЛОБОДА · тест спрайтов-матриц: палитра ≤16, кадры на месте, индексы в палитре, варианты врага различаются.
// Запуск: node _proto/hd-brawl/tests/sprites.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const S = require('../js/sprites.js');
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok', name); };
ok('палитра ≤ 16 цветов (кроме прозрачного)', () => { const c = S.PAL.filter(Boolean); assert.ok(c.length <= 16); assert.equal(new Set(c).size, c.length); });
const NEED = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'hit1', 'hit2', 'hit3', 'jump', 'hurt', 'fall', 'down'];
for (const set of ['hero', 'stokerA', 'stokerB']) ok('кадры ' + set, () => {
  for (const k of NEED) { const f = S.SETS[set][k]; assert.ok(f, k); assert.equal(f.a.length, f.w * f.h);
    for (const v of f.a) assert.ok(v < S.PAL.length);
    let bottom = -1; for (let i = 0; i < f.a.length; i++) if (f.a[i]) bottom = Math.max(bottom, (i / f.w) | 0);
    if (k !== 'jump') assert.equal(bottom, f.h - 1, k + ': опора — нижний ряд кадра'); }  // прыжок — ноги поджаты, висит на 1 px
  assert.equal(S.SETS[set].idle0.w, 40); assert.equal(S.SETS[set].idle0.h, 48);
});
ok('контур селективный: есть и чернила, и светлые кромки', () => { const a = S.SETS.hero.idle0.a; assert.ok(a.includes(1)); assert.ok(a.some((v, i) => v === S.LIT[6] || v === S.LIT[5])); });
ok('варианты врага — та же матрица, другие цвета', () => { const A = S.SETS.stokerA.idle0.a, B = S.SETS.stokerB.idle0.a; let diff = 0, shape = 0;
  for (let i = 0; i < A.length; i++) { if (A[i] !== B[i]) diff++; if (!!A[i] !== !!B[i]) shape++; } assert.ok(diff > 50); assert.equal(shape, 0); });
ok('строки деталей одинаковой длины и из легенды', () => { for (const k of Object.keys(S.P)) S.parse(S.P[k]); });
console.log(n + ' тестов прошло');
