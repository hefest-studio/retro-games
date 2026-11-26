// МЕДНАЯ СЛОБОДА · тест спрайтов-матриц и шрифта: палитра ≤16, все кадры на месте и в размере, ключевые позы —
// целые матрицы из js/poses.js, рост бойца 56–64 px, мимика (3 выражения), отставание вторичных деталей, варианты врага.
// Запуск: node _proto/hd-brawl/tests/sprites.test.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const S = require('../js/sprites.js');
const POSES = require('../js/poses.js');
const F = require('../js/font.js');
let n = 0; const ok = (name, fn) => { fn(); n++; console.log('ok', name); };
const bbox = f => { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let i = 0; i < f.a.length; i++) if (f.a[i]) { const x = i % f.w, y = (i / f.w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, x1, y0, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 }; };

ok('палитра ≤ 16 цветов (кроме прозрачного), без повторов', () => { const c = S.PAL.filter(Boolean); assert.ok(c.length <= 16); assert.equal(new Set(c).size, c.length); });
const RUN = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5'];
const KEYS = ['jab_a', 'jab', 'jab_r', 'cross_a', 'cross', 'cross_r', 'kick_a', 'kick', 'kick_r', 'hurt', 'fall0', 'fall1', 'down', 'getup0', 'getup1', 'getup2', 'held', 'jump', 'airkick'];
const GROUNDED = RUN.concat(['jab_a', 'jab', 'jab_r', 'cross_a', 'cross', 'cross_r', 'kick_a', 'kick', 'kick_r', 'hurt', 'down', 'getup0', 'getup1', 'getup2']);
for (const set of ['hero', 'stokerA', 'stokerB']) ok('кадры ' + set + ': все на месте, 80×72, индексы в палитре, опора', () => {
  for (const k of RUN.concat(KEYS)) { const f = S.SETS[set][k]; assert.ok(f, k); assert.equal(f.w, S.FW); assert.equal(f.h, S.FH); assert.equal(f.a.length, f.w * f.h);
    for (const v of f.a) assert.ok(v < S.PAL.length);
    if (GROUNDED.includes(k)) assert.equal(bbox(f).y1, S.FH - 1, k + ': контур подошвы — нижний ряд кадра'); }
});
ok('ключевые позы — целые матрицы в js/poses.js (оба персонажа, строки из легенды, в рамке кадра)', () => {
  for (const ch of ['hero', 'foe']) for (const k of KEYS) { const m = POSES[ch][k]; assert.ok(m, ch + '.' + k);
    const p = S.parse(m.rows); assert.ok(m.ox >= 0 && m.oy >= 0 && m.ox + p.w <= S.FW && m.oy + p.h <= S.FH, ch + '.' + k + ' в рамке'); }
  // в игре кадр ключевой позы = матрица из файла (не пересборка)
  const m = POSES.hero.cross, f = S.SETS.hero.cross, p = S.parse(m.rows);
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) assert.equal(f.a[(y + m.oy) * S.FW + x + m.ox], p.a[y * p.w + x]);
});
ok('рост бойца в стойке 56–64 px, пропорция чиби (голова ≈ 1/2.5 роста)', () => {
  for (const set of ['hero', 'stokerA']) { const b = bbox(S.SETS[set].idle0); assert.ok(b.h >= 56 && b.h <= 64, set + ' рост ' + b.h); }
  const head = S.PARTS.hero.head.n.h, h = bbox(S.SETS.hero.idle0).h; assert.ok(h / head > 2.2 && h / head < 2.9, 'пропорция ' + (h / head).toFixed(2));
});
ok('мимика: обычное / удар / урон — три разные головы у обоих', () => {
  for (const ch of ['hero', 'foe']) { const H = S.PARTS[ch].head; const d = (a, b) => a.a.reduce((s, v, i) => s + (v !== b.a[i]), 0);
    assert.ok(d(H.n, H.a) >= 6 && d(H.n, H.h) >= 6 && d(H.a, H.h) >= 6, ch); }
});
ok('удары: предвосхищение → удар → возврат — три разных кадра; ходьба 6 кадров с покачиванием', () => {
  for (const a of ['jab', 'cross', 'kick']) { const A = S.SETS.hero[a + '_a'].a, B = S.SETS.hero[a].a, C = S.SETS.hero[a + '_r'].a;
    let ab = 0, bc = 0; for (let i = 0; i < A.length; i++) { ab += A[i] !== B[i]; bc += B[i] !== C[i]; } assert.ok(ab > 80 && bc > 80, a); }
  const tops = RUN.slice(2).map(k => bbox(S.SETS.hero[k]).y0); assert.ok(new Set(tops).size >= 2, 'тело качается: ' + tops);
});
ok('вторичное движение: хвосты повязки и полог фартука отстают (кадр отличается от рендера без отставания)', () => {
  const spec = S.RUN.walk2, a = S.renderPose(spec, 'hero', null, 0).f.a, prev = S.renderPose(S.RUN.walk1, 'hero', null, 0).anchors, prev2 = S.renderPose(S.RUN.walk0, 'hero', null, 0).anchors;
  const b = S.renderPose(spec, 'hero', { belt: prev.belt, knot: prev2.knot }, 0).f.a; let d = 0; for (let i = 0; i < a.length; i++) d += a[i] !== b[i]; assert.ok(d > 0 && d < 200, 'отличие ' + d);
});
ok('контур селективный: есть и чернила, и светлые кромки', () => { const a = S.SETS.hero.idle0.a; assert.ok(a.includes(1)); assert.ok(a.some(v => v === S.LIT[6] || v === S.LIT[5])); });
ok('варианты врага — та же матрица, другие цвета', () => { const A = S.SETS.stokerA.idle0.a, B = S.SETS.stokerB.idle0.a; let diff = 0, shape = 0;
  for (let i = 0; i < A.length; i++) { if (A[i] !== B[i]) diff++; if (!!A[i] !== !!B[i]) shape++; } assert.ok(diff > 50); assert.equal(shape, 0); });
// ---- v3: литейщик (крупный враг) и ручная доводка поз ----
const BIGK = ['idle0', 'idle1', 'walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5', 'wind', 'grab', 'throw', 'hurt', 'fall0', 'fall1', 'down', 'getup0', 'getup1'];
ok('литейщик: все кадры (и idle/ходьба) — целые матрицы из poses.js, 80×72, наземные стоят на подошве', () => {
  for (const k of BIGK) { const m = POSES.big[k], f = S.SETS.founder[k]; assert.ok(m && f, k); const p = S.parse(m.rows);
    for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) assert.equal(f.a[(y + m.oy) * S.FW + x + m.ox], p.a[y * p.w + x], k);
    for (const v of f.a) assert.ok(v < S.PAL.length);
    if (!['fall0', 'fall1'].includes(k)) assert.equal(bbox(f).y1, S.FH - 1, k + ': подошва'); }
});
ok('литейщик крупнее: выше героя на ≥5 px и шире кочегара; свой облик (другая голова и торс)', () => {
  const B = bbox(S.SETS.founder.idle0), H = bbox(S.SETS.hero.idle0), K = bbox(S.SETS.stokerA.idle0);
  assert.ok(B.h >= H.h + 5 && B.h <= 70, 'рост ' + B.h); assert.ok(B.w > K.w + 4, 'ширина ' + B.w);
  assert.ok(S.PARTS.big.torso.w > S.PARTS.foe.torso.w);
  const d = (a, b) => a.a.reduce((s, v, i) => s + (v !== b.a[i]), 0); const Hd = S.PARTS.big.head;
  assert.ok(d(Hd.n, Hd.a) >= 6 && d(Hd.n, Hd.h) >= 6, 'мимика литейщика');
});
ok('литейщик: захват тянется вперёд, замах — руки вверх, бросок — вперёд-вниз; ходьба качается', () => {
  const F = S.SETS.founder, b = k => bbox(F[k]);
  assert.ok(b('grab').x1 >= b('idle0').x1 + 8, 'захват длиннее стойки'); assert.ok(b('wind').y0 <= b('idle0').y0, 'замах не ниже головы');
  assert.ok(b('throw').x1 > b('idle0').x1, 'бросок вперёд');
  assert.ok(new Set(['walk0', 'walk1', 'walk2', 'walk3', 'walk4', 'walk5'].map(k => b(k).y0)).size >= 2);
});
ok('ручная доводка: правки FIX попали в матрицы (складки), полёт — руки видны и лицо не закрыто', () => {
  const r = S.toRows(S.SETS.hero.jab); assert.equal(r[38][49], 't'); assert.equal(r[39][48], 't');
  assert.equal(S.toRows(S.SETS.hero.kick)[47][46], 'l');
  // fall0: обе кисти-рукавицы правее головы (лицо открыто): в рядах головы справа от лица нет кожи рукавицы поверх глаз
  const f = S.SETS.hero.fall0, glove = new Set([3, 4, 5]); let hands = 0;
  for (let y = 0; y < S.FH; y++) for (let x = 50; x < S.FW; x++) if (glove.has(f.a[y * S.FW + x])) hands++;
  assert.ok(hands > 20, 'кисти в полёте видны: ' + hands);
});
ok('ходьба героя: противоход — кулаки сдвигаются по X между кадрами 0 и 3', () => {
  const xs = k => { const f = S.SETS.hero[k]; let mx = -1; for (let i = 0; i < f.a.length; i++) if (f.a[i] && (i / f.w | 0) < 50 && (i / f.w | 0) > 36) mx = Math.max(mx, i % f.w); return mx; };
  assert.ok(Math.abs(xs('walk0') - xs('walk3')) >= 3, xs('walk0') + ' vs ' + xs('walk3'));
});
ok('строки деталей одинаковой длины и из легенды', () => { for (const k of Object.keys(S.P)) S.parse(S.P[k]); });
ok('шрифт 5×7: все символы текстов RU/EN и движка есть, глифы 7 рядов', () => {
  const txt = 'МЕДНАЯ СЛОБОДА COPPER QUARTER Прототип драки · чиби HD-пиксель Волна ВПЕРЁД Улица чиста! ←→↑↓ ход Пробел/J удар (×3 серия) K/Z прыжок P пауза ' +
    'Стик — ход ● удар ⤒ прыжок Играть Язык: RU Тема: modern Звук: вкл выкл Пауза Продолжить Меню Рекорд Очки Победа Игра окончена ▸ ♥ 0123456789 ' +
    'ЖМИ УДАР! MASH HIT! Brawler prototype chibi HD pixel Wave GO Street clear! move Space hit combo jump pause Play Language Theme Sound on off Resume Best Score';
  for (const ch of txt) if (ch !== ' ') assert.ok(F.glyphs[ch] || F.glyphs[ch.toUpperCase()], 'нет глифа «' + ch + '»');
  for (const k of Object.keys(F.glyphs)) { assert.equal(F.glyphs[k].rows.length, 7, k); for (const r of F.glyphs[k].rows) assert.equal(r.length, F.glyphs[k].w, k); }
  assert.equal(F.measure('AB', 2), (5 + 1 + 5) * 2);
});
console.log(n + ' тестов прошло');
