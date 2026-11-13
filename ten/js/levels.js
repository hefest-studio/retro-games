/* ТЕНЬ · levels.js — генератор сцен (детерминированно, свой сид на сцену) и арены боссов.
   TEN.levels.build(act, scene) → карта; scene 1..3 — сцены акта, scene 4 — арена босса.
   Сцена собирается слева направо из сегментов: разбег, ямы, ступени, «колодец» для прыжков от стены
   (висячая стена + обрыв), пропасть с кольцами для крюка-троса, лестница мостков, низкий лаз (подкат),
   столбы, крыша со стражем и прожектором, шипы. Высота опоры gy держится в [11, 25]. */
(function (global) {
  'use strict';
  var TEN = global.TEN = global.TEN || {};
  var T = 16, H = 30, C = { E: 0, S: 1, P: 2, X: 3 };
  var ACTS = 6, SCENES = 3;
  var BOSSES = ['foreman', 'boiler', 'crane', 'harpoon', 'pendulum', 'chancellor'];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  function Builder(act, scene, w) {
    var rng = mulberry32(act * 1013 + scene * 97 + 7);
    var B = {
      act: act, scene: scene, rng: rng, w: w, h: H, t: new Uint8Array(w * H), c: 0, gy: 22,
      rings: [], enemies: [], lamps: [], lights: [], deco: [], n: {},
      ri: function (a, b) { return a + Math.floor(rng() * (b - a + 1)); },
      pick: function (arr) { return arr[Math.floor(rng() * arr.length)]; }
    };
    return B;
  }
  function set(B, c, r, v) { if (c >= 0 && c < B.w && r >= 0 && r < B.h) B.t[r * B.w + c] = v; }
  function fill(B, c0, c1, r0, r1, v) { for (var c = c0; c < c1; c++) for (var r = r0; r < r1; r++) set(B, c, r, v); }
  function ground(B, n) { fill(B, B.c, B.c + n, B.gy, B.h, C.S); B.c += n; }
  function count(B, k) { B.n[k] = (B.n[k] || 0) + 1; }

  // ---------- враги и предметы ----------
  var ENEMY_POOL = [
    ['walker', 'jumper', 'walker', 'drone'],
    ['walker', 'jumper', 'shooter', 'drone'],
    ['jumper', 'shooter', 'drone', 'walker'],
    ['drone', 'shooter', 'jumper', 'drone'],
    ['shooter', 'jumper', 'drone', 'walker'],
    ['shooter', 'drone', 'jumper', 'shooter']
  ];
  function enemy(B, k, c0, c1) {
    var x = (c0 + c1) / 2 * T, y = B.gy * T;
    if (k === 'drone') y = (B.gy - 6) * T;
    B.enemies.push({ id: 'e' + B.enemies.length, k: k, x: x, y: y, x0: c0 * T + 8, x1: c1 * T - 8 });
  }
  function maybeEnemy(B, c0, c1, p) {
    if (c1 - c0 < 5 || B.rng() > p) return;
    var pool = ENEMY_POOL[B.act - 1], k = B.pick(pool);
    if (B.act === 1 && B.scene === 1 && (k === 'drone')) k = 'walker';
    if (B.act === 1 && B.scene < 3 && k === 'shooter') k = 'jumper';
    enemy(B, k, c0 + 1, c1 - 1);
  }
  function lamp(B, c, item) {
    var items = ['c5', 'c5', 'c5', 'c10', 'hp', 'pts', 'sp'];
    var it = item || B.pick(items);
    if (it === 'sp') it = 'sp:' + B.pick(['star', 'smoke', 'whirl', 'fire']);
    B.lamps.push({ id: 'l' + B.lamps.length, x: c * T + 8, y: B.gy * T - 28, item: it });
  }

  // ---------- сегменты ----------
  var SEG = {
    flat: function (B, n) {
      n = n || B.ri(6, 11); var c0 = B.c; ground(B, n);
      maybeEnemy(B, c0, B.c, 0.25 + 0.08 * B.act + 0.05 * B.scene);
      if (B.rng() < 0.4) lamp(B, c0 + B.ri(1, n - 2));
    },
    pit: function (B) {
      var w = B.ri(2, B.act >= 3 ? 4 : 3); ground(B, 2); B.c += w; ground(B, 3); count(B, 'pit');
    },
    step: function (B) {
      var d = B.pick([-3, -2, -2, 2, 3, 3]);
      if (B.gy + d < 11 || B.gy + d > 25) d = -d;
      ground(B, 2); B.gy += d; ground(B, B.ri(4, 6)); count(B, 'step');
    },
    drop: function (B) {
      var d = B.ri(3, 5); if (B.gy + d > 25) d = 25 - B.gy; if (d < 2) return SEG.step(B);
      ground(B, 3); B.gy += d; ground(B, 5); count(B, 'drop');
    },
    // «колодец»: висячая стена слева (под ней проход 3 клетки) + обрыв справа выше на h; между ними — зазор g.
    // Взобраться — цепочкой прыжков от стены к стене и подтянуться на край. deadly: дно колодца — пропасть.
    chimney: function (B, deadly) {
      var h = B.ri(5, Math.min(10, 5 + B.act)), g = B.ri(3, 5);
      if (B.gy - h < 11) { var need = 11 + h - B.gy; B.gy = Math.min(25, B.gy + need); if (B.gy - h < 11) h = B.gy - 11; }
      ground(B, 3);
      fill(B, B.c, B.c + 2, B.gy - h - 3, B.gy - 3, C.S); B.deco.push({ k: 'tower', c: B.c, r0: B.gy - h - 3, r1: B.gy - 3 });
      ground(B, 2);
      if (deadly) B.c += g; else ground(B, g);
      B.gy -= h; ground(B, 4); count(B, deadly ? 'chasm' : 'chimney');
      if (!deadly && B.rng() < 0.5) lamp(B, B.c - 2);
    },
    // пропасть с кольцами: без крюка не перепрыгнуть
    rings: function (B) {
      var w = B.ri(8, B.act >= 3 ? 12 : 10), n = w >= 11 ? 2 : 1;
      ground(B, 3); var c0 = B.c; B.c += w;
      for (var i = 0; i < n; i++) {
        var cx = c0 + w * (i + 1) / (n + 1);
        B.rings.push({ id: 'r' + B.rings.length, x: Math.round(cx * T), y: (B.gy - 7) * T + 8 });
      }
      ground(B, 4); count(B, 'rings');
      if (B.act >= 3 && B.rng() < 0.5) B.enemies.push({ id: 'e' + B.enemies.length, k: 'drone', x: (c0 + w + 2) * T, y: (B.gy - 7) * T, x0: c0 * T, x1: (c0 + w + 4) * T });
    },
    // лестница мостков к обрыву на 9 выше
    ledges: function (B) {
      if (B.gy - 9 < 11) { B.gy = Math.min(25, B.gy + 4); if (B.gy - 9 < 11) return SEG.step(B); }
      var c0 = B.c; ground(B, 9);
      fill(B, c0 + 1, c0 + 4, B.gy - 3, B.gy - 2, C.P); fill(B, c0 + 5, c0 + 8, B.gy - 6, B.gy - 5, C.P);
      B.gy -= 9; ground(B, 4); count(B, 'ledges');
    },
    // низкий лаз: потолок на высоте клетки — подкат или ползком (или поверху, подтянувшись)
    duct: function (B) {
      var n = B.ri(4, 7), c0 = B.c; ground(B, 2); var c1 = B.c; ground(B, n);
      fill(B, c1, c1 + n, B.gy - 6, B.gy - 1, C.S); ground(B, 2); count(B, 'duct');
      if (B.act >= 2 && B.rng() < 0.6) enemy(B, 'shooter', B.c, B.c + 4), ground(B, 5);
    },
    pillars: function (B) {
      var k = B.ri(2, 4); ground(B, 2);
      for (var i = 0; i < k; i++) {
        B.c += B.ri(2, 3); var d = B.ri(-1, 1); if (B.gy + d >= 11 && B.gy + d <= 25) B.gy += d;
        ground(B, B.ri(2, 3));
      }
      B.c += 2; ground(B, 3); count(B, 'pillars');
    },
    // крыша со стражем и прожектором
    guard: function (B) {
      var n = B.ri(12, 16), c0 = B.c; ground(B, n);
      enemy(B, 'guard', c0 + 2, c0 + n - 2);
      B.lights.push({ id: 'p' + B.lights.length, x: (c0 + n - 1) * T + 8, y: (B.gy - 5) * T, base: Math.PI * 0.82, amp: 0.38, len: 190, sp: 0.7 + 0.08 * B.act, ph: B.rng() * 6 });
      count(B, 'guard');
    },
    spikes: function (B) {
      var k = B.ri(2, 3), c0 = B.c; ground(B, 3 + k + 3);
      fill(B, c0 + 3, c0 + 3 + k, B.gy - 1, B.gy, C.X); count(B, 'spikes');
    }
  };

  function recipe(B) {
    var a = B.act, s = B.scene, list = [];
    var add = function (k, n) { for (var i = 0; i < n; i++) list.push(k); };
    add('chimney', 1 + (s >= 2 ? 1 : 0) + (a >= 4 ? 1 : 0));
    add('rings', 1 + (a >= 2 && s >= 2 ? 1 : 0) + (a >= 4 ? 1 : 0));
    add('pit', 2 + (a >= 3 ? 1 : 0)); add('step', 2); add('drop', 1);
    if (a > 1 || s > 1) add('guard', 1 + (a >= 5 ? 1 : 0));
    if (a >= 2 || s >= 2) add('duct', 1);
    if (a >= 2) add('pillars', 1);
    if (a >= 3) add('chasm', 1 + (a >= 5 ? 1 : 0));
    if (a >= 4 || s === 3) add('ledges', 1);
    if (a >= 5 || (a >= 3 && s === 3)) add('spikes', 1 + (a >= 6 ? 1 : 0));
    // перемешать детерминированно, не ставя два «тяжёлых» подряд
    for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(B.rng() * (i + 1)), tmp = list[i]; list[i] = list[j]; list[j] = tmp; }
    return list;
  }

  function build(act, scene) {
    if (scene === 4) return arena(act);
    var B = Builder(act, scene, 800);
    // старт: стена слева, площадка разбега
    ground(B, 10);
    var list = recipe(B);
    if (act === 1 && scene === 1) {   // обучение: колодец и кольцо — пораньше
      list = list.filter(function (k) { return k !== 'chimney' && k !== 'rings'; });
      list.unshift('flat', 'chimney', 'flat', 'rings');
    }
    for (var i = 0; i < list.length; i++) {
      var k = list[i];
      if (k === 'chasm') SEG.chimney(B, true); else SEG[k](B);
      SEG.flat(B);
    }
    ground(B, 14);
    var w = B.c + 1;
    fill(B, 0, 1, 0, H, C.S);                     // левая граница
    var out = finish(B, w);
    out.start = { x: 3 * T, y: firstFloor(out, 3) };
    out.exit = { x: (w - 5) * T, y: firstFloor(out, w - 5) };
    fillCol(out, w - 1);
    out.time = Math.round((w * T / 34 + 70) / 10) * 10;
    return out;
  }
  function finish(B, w) {
    var t = new Uint8Array(w * H);
    for (var r = 0; r < H; r++) for (var c = 0; c < w; c++) t[r * w + c] = B.t[r * B.w + c];
    return { act: B.act, scene: B.scene, w: w, h: H, t: t, rings: B.rings, enemies: B.enemies, lamps: B.lamps, lights: B.lights, deco: B.deco, counts: B.n, arena: null };
  }
  function fillCol(L, c) { for (var r = 0; r < L.h; r++) L.t[r * L.w + c] = C.S; }
  function firstFloor(L, c) { for (var r = 0; r < L.h; r++) if (L.t[r * L.w + c] === C.S) return r * T; return L.h * T; }

  // ---------- арены боссов ----------
  // 40×24 клетки: стены по бокам (за них можно цепляться), потолок, пол на ряду 20; кольца под потолком.
  function arena(act) {
    var w = 40, h = 24, t = new Uint8Array(w * h);
    var put = function (c0, c1, r0, r1, v) { for (var c = c0; c < c1; c++) for (var r = r0; r < r1; r++) t[r * w + c] = v; };
    put(0, w, 20, h, C.S); put(0, 2, 0, h, C.S); put(w - 2, w, 0, h, C.S); put(0, w, 0, 4, C.S);
    var rings = [];
    if (act === 3 || act === 4 || act === 6) [10, 20, 30].forEach(function (c, i) { rings.push({ id: 'r' + i, x: c * T, y: 9 * T + 8 }); });
    if (act === 2 || act === 5) { put(7, 12, 15, 16, C.P); put(28, 33, 15, 16, C.P); }
    return { act: act, scene: 4, w: w, h: h, t: t, rings: rings, enemies: [], lamps: [{ id: 'l0', x: 6 * T, y: 16 * T, item: 'c10' }, { id: 'l1', x: 34 * T, y: 16 * T, item: 'hp' }],
      lights: [], deco: [], counts: {}, arena: { x0: 2 * T, x1: 38 * T, floor: 20 * T, boss: BOSSES[act - 1] },
      start: { x: 5 * T, y: 20 * T }, exit: null, time: 150 + 10 * act };
  }

  TEN.levels = { T: T, H: H, C: C, ACTS: ACTS, SCENES: SCENES, BOSSES: BOSSES, build: build, mulberry32: mulberry32 };
})(typeof window !== 'undefined' ? window : globalThis);
