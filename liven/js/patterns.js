/* ЛИВЕНЬ · узоры пуль: LIVEN.PAT — огонь врагов этапов, LIVEN.BOSSES — мид-боссы и Звонари с именными перезвонами.
   Узор — функция (G, o, dt): G — API логики (fire/ring/fan/aim, N(n) — плотность по сложности, R(iv) — темп,
   every(o,'ключ',iv,dt) — таймер, sp0() → SP — параметры следующих пуль), o — враг или босс (свои таймеры k0..k3, углы a0..a3).
   Параметры SP: k — вид (0 окалина, 1 капля, 2 заклёпка, 3 гвоздь, 4 шестерёнка), c — цвет (0 расплав, 1 добела, 2 алый, 3 золото,
   4 грозовой, 5 сирень, 6 мята, 7 роза), w — угловая скорость, ac/st — ускорение до скорости st, rt — через rt с:
   f&1 — довернуть на челнок (+ra), иначе повернуть на ra; f&2 — лопнуть кольцом из bn пуль; rs — новая скорость.
   Все узоры проверены тестом «нет непроходимых стен»: в каждый момент есть путь шириной ≥ хитбокса. */
(function (global) {
  'use strict';
  var LV = global.LIVEN = global.LIVEN || {};
  var TAU = Math.PI * 2, DOWN = Math.PI / 2;

  function flower(G, x, y, n, a0, petals, s0, s1) {
    var d = TAU / n;
    for (var i = 0; i < n; i++) { var a = a0 + i * d, m = Math.abs(Math.sin(petals * (a - a0) / 2)); G.fire(x, y, a, s0 + (s1 - s0) * m); }
  }
  function star(G, x, y, pts, m, a0, s) {
    for (var p = 0; p < pts; p++) {
      var ao = a0 + p * TAU / pts, ai = ao + Math.PI / pts, an = ao + TAU / pts;
      var ox = Math.cos(ao), oy = Math.sin(ao), ix = Math.cos(ai) * 0.45, iy = Math.sin(ai) * 0.45, nx = Math.cos(an), ny = Math.sin(an);
      for (var j = 0; j < m; j++) {
        var u = j / m, vx = ox + (ix - ox) * u, vy = oy + (iy - oy) * u; G.fire(x, y, Math.atan2(vy, vx), s * Math.sqrt(vx * vx + vy * vy));
        vx = ix + (nx - ix) * u; vy = iy + (ny - iy) * u; G.fire(x, y, Math.atan2(vy, vx), s * Math.sqrt(vx * vx + vy * vy));
      }
    }
  }
  LV.flower = flower; LV.star = star;

  // ---------- враги этапов ----------
  LV.PAT = {
    aim1: function (G, e, dt) { if (G.every(e, 'fk', G.R(1.6), dt)) { var s = G.sp0(); s.k = 1; s.c = 0; G.fire(e.x, e.y, G.aim(e.x, e.y), 150); } },
    aim3: function (G, e, dt) { if (G.every(e, 'fk', G.R(1.8), dt)) { var s = G.sp0(); s.k = 1; s.c = 3; G.fan(e.x, e.y, 3, G.aim(e.x, e.y), 0.5, 140); } },
    aim5: function (G, e, dt) { if (G.every(e, 'fk', G.R(2.0), dt)) { var s = G.sp0(); s.k = 0; s.c = 1; G.fan(e.x, e.y, Math.max(3, G.N(6)), G.aim(e.x, e.y), 0.9, 130); } },
    ring: function (G, e, dt) { if (G.every(e, 'fk', G.R(2.2), dt)) { var s = G.sp0(); s.k = 0; s.c = 4; e.fa += 0.21; G.ring(e.x, e.y, G.N(16), e.fa, 100); } },
    spiral: function (G, e, dt) { if (G.every(e, 'fk', G.R(0.11), dt)) { var s = G.sp0(); s.k = 1; s.c = 3; e.fa += 0.31; G.ring(e.x, e.y, 2, e.fa, 105); } },
    flower: function (G, e, dt) { if (G.every(e, 'fk', G.R(2.4), dt)) { var s = G.sp0(); s.k = 0; s.c = 7; e.fa += 0.4; flower(G, e.x, e.y, G.N(36), e.fa, 4, 70, 130); } },
    rain: function (G, e, dt) { if (G.every(e, 'fk', G.R(0.35), dt)) { var s = G.sp0(); s.k = 1; s.c = 4; G.fire(e.x, e.y, DOWN + (G.rnd() - 0.5) * 0.3, 150); } },
    orbs: function (G, e, dt) { if (G.every(e, 'fk', G.R(2.0), dt)) { var s = G.sp0(); s.k = 2; s.c = 2; e.fa += 0.3; G.ring(e.x, e.y, Math.max(4, G.N(9)), e.fa, 70); } },
    needle: function (G, e, dt) { if (G.every(e, 'fk', G.R(1.5), dt)) { var s = G.sp0(); s.k = 3; s.c = 1; var a = G.aim(e.x, e.y); for (var i = 0; i < 4; i++) G.fire(e.x, e.y, a, 150 + i * 30); } },
    burst: function (G, e, dt) { if (G.every(e, 'fk', G.R(2.3), dt)) { var s = G.sp0(); s.k = 2; s.c = 3; s.ac = -170; s.st = 0; s.rt = 0.95; s.f = 2; s.bn = Math.max(6, G.N(12)); s.rs = 105; G.fire(e.x, e.y, G.aim(e.x, e.y) + (G.rnd() - 0.5) * 0.6, 160); } }
  };

  // ---------- перезвоны (фазы боссов; в коде — card) ----------
  // hp — прочность перезвона, time — лимит (по истечении он сгорает без бонуса), bonus — база бонуса за перезвон без потерь и разряда,
  // mv — движение: c — у центра, s — качание, d — перелёты.
  function C(ru, en, hp, time, bonus, mv, f) { return { n: { ru: ru, en: en }, hp: hp, time: time, bonus: bonus, mv: mv, f: f }; }

  LV.BOSSES = {
    // ===== Этап 1 =====
    m1: { n: { ru: 'Бубенец-дозорный', en: 'Sentry Jingle' }, look: 'bell', home: 120, cards: [
      C('Первые заклёпки', 'First Rivets', 260, 24, 20000, 's', function (G, b, dt) {
        var s;
        if (G.every(b, 'k0', G.R(1.0), dt)) { s = G.sp0(); s.k = 1; s.c = 0; G.fan(b.x, b.y, Math.max(3, G.N(7)), G.aim(b.x, b.y), 0.7, 150); }
        if (G.every(b, 'k1', G.R(0.3), dt)) { s = G.sp0(); s.k = 1; s.c = 4; G.fire(b.x + (G.rnd() - 0.5) * 120, b.y, DOWN + (G.rnd() - 0.5) * 0.4, 120 + G.rnd() * 50); }
      })
    ] },
    b1: { n: { ru: 'Звонарь Медный Зев', en: 'The Brass-Mouth Ringer' }, look: 'brass', home: 125, cards: [
      C('Медная морось', 'Brass Drizzle', 520, 32, 40000, 's', function (G, b, dt) {
        var s;
        if (G.every(b, 'k0', G.R(0.07), dt)) { s = G.sp0(); s.k = 1; s.c = G.rnd() < 0.5 ? 0 : 3; G.fire(G.rnd() * G.K.FW, -4, DOWN + (G.rnd() - 0.5) * 0.3, 105 + G.rnd() * 70); }
        if (G.every(b, 'k1', G.R(1.6), dt)) { s = G.sp0(); s.k = 0; s.c = 1; G.fan(b.x, b.y, Math.max(3, G.N(9)), G.aim(b.x, b.y), 0.7, 170); }
      }),
      C('Спираль окалины', 'Scale Spiral', 600, 36, 50000, 'c', function (G, b, dt) {
        var s;
        b.a1 += dt; var dir = Math.floor(b.a1 / 4) % 2 ? -1 : 1;
        if (G.every(b, 'k0', G.R(0.075), dt)) { s = G.sp0(); s.k = 1; s.c = 0; b.a0 += 0.2 * dir; G.ring(b.x, b.y, Math.max(2, G.N(5)), b.a0, 125); }
        if (G.every(b, 'k1', G.R(2.4), dt)) { s = G.sp0(); s.k = 2; s.c = 2; G.ring(b.x, b.y, G.N(20), G.rnd() * TAU, 80); }
      }),
      C('Цветок жара', 'Heat Bloom', 680, 40, 60000, 'c', function (G, b, dt) {
        var s;
        if (G.every(b, 'k0', G.R(1.0), dt)) { s = G.sp0(); s.k = 0; s.c = 3; b.a0 += 0.37; flower(G, b.x, b.y, G.N(64), b.a0, 5, 65, 140); }
        if (G.every(b, 'k1', G.R(0.55), dt)) { s = G.sp0(); s.k = 1; s.c = 2; G.fire(b.x, b.y, G.aim(b.x, b.y), 190); }
      })
    ] },
    // ===== Этап 2 =====
    m2: { n: { ru: 'Колокольчик-сито', en: 'Sieve Chime' }, look: 'bell', home: 120, cards: [
      C('Мелкий град', 'Fine Hail', 320, 24, 25000, 'd', function (G, b, dt) {
        if (G.every(b, 'k0', G.R(1.15), dt)) { var s = G.sp0(); s.k = 0; s.c = 4; s.ac = -230; s.st = 15; s.rt = 0.9; s.f = 1; s.ra = 0; s.rs = 165; b.a0 += 0.25; G.ring(b.x, b.y, G.N(28), b.a0, 175); }
      })
    ] },
    b2: { n: { ru: 'Звонарь Ветродуй', en: 'The Gale Ringer' }, look: 'gale', home: 125, cards: [
      C('Порыв', 'Gust', 560, 32, 50000, 's', function (G, b, dt) {
        var s; b.a1 += dt;
        if (G.every(b, 'k0', G.R(0.11), dt)) { s = G.sp0(); s.k = 1; s.c = 4; var a = DOWN + 0.95 * Math.sin(b.a1 * 0.9); s.w = 0.35 * (Math.cos(b.a1 * 0.9) > 0 ? 1 : -1); G.fan(b.x, b.y, 5, a, 0.32, 165); }
        if (G.every(b, 'k1', G.R(1.9), dt)) { s = G.sp0(); s.k = 2; s.c = 5; G.ring(b.x, b.y, G.N(24), G.rnd() * TAU, 85); }
      }),
      C('Вдох и выдох', 'Breath In, Breath Out', 640, 36, 60000, 'c', function (G, b, dt) {
        var s;
        if (G.every(b, 'k0', G.R(1.3), dt)) { b.n0++; s = G.sp0(); s.k = 0; s.c = 1; s.ac = -300; s.st = 0; s.rt = 1.1; s.ra = (b.n0 % 2 ? 0.45 : -0.45); s.rs = 115; G.ring(b.x, b.y, G.N(44), G.rnd() * TAU, 230); }
        if (G.every(b, 'k1', G.R(0.9), dt)) { s = G.sp0(); s.k = 1; s.c = 0; G.fan(b.x, b.y, 3, G.aim(b.x, b.y), 0.3, 160); }
      }),
      C('Вихревые лепестки', 'Whirling Petals', 720, 40, 70000, 'c', function (G, b, dt) {
        if (G.every(b, 'k0', G.R(0.2), dt)) {
          var s = G.sp0(), n = Math.max(4, G.N(9)); s.k = 1; b.a0 += 0.13; b.a1 -= 0.11;
          s.c = 3; s.w = 0.55; G.ring(b.x, b.y, n, b.a0, 105);
          s.c = 5; s.w = -0.55; G.ring(b.x, b.y, n, b.a1, 105);
        }
      })
    ] },
    // ===== Этап 3 =====
    m3: { n: { ru: 'Громовой фонарь', en: 'Thunder Lantern' }, look: 'chime', home: 115, cards: [
      C('Громовая сетка', 'Thunder Mesh', 300, 22, 30000, 'c', function (G, b, dt) {
        if (G.every(b, 'k0', G.R(0.55), dt)) {
          var s = G.sp0(), m = Math.max(3, G.N(7)); s.k = 3; s.c = 4; b.n0++;
          var off = b.n0 % 2 ? 0.62 : 0.5;
          for (var i = 0; i < m; i++) { G.fire(b.x, b.y, DOWN + off, 110 + i * 26); G.fire(b.x, b.y, DOWN - off, 110 + i * 26); }
        }
      }),
      C('Цепная молния', 'Chain Lightning', 330, 22, 30000, 's', function (G, b, dt) {
        var s;
        if (G.every(b, 'k0', G.R(1.5), dt)) { b.k1 = 0.5; b.a0 = G.aim(b.x, b.y); }
        if (b.k1 > 0) { b.k1 -= dt; if (G.every(b, 'k2', 0.06, dt)) { s = G.sp0(); s.k = 3; s.c = 1; G.fire(b.x, b.y, b.a0, 260); } }
        if (G.every(b, 'k3', G.R(1.1), dt)) { s = G.sp0(); s.k = 0; s.c = 5; G.ring(b.x, b.y, G.N(14), G.rnd() * TAU, 95); }
      })
    ] },
    b3: { n: { ru: 'Звонарь Литник', en: 'The Sprue Ringer' }, look: 'twin', home: 120, cards: [
      C('Косая решётка', 'Slanted Lattice', 620, 34, 60000, 'c', function (G, b, dt) {
        if (G.every(b, 'k0', G.R(0.5), dt)) {
          var s = G.sp0(), n = Math.max(5, G.N(13)), gap = G.K.FW / n; s.k = 0; b.n0++;
          var sl = b.n0 % 2 ? 0.38 : -0.38, ox = (b.n0 * 0.37 % 1) * gap; s.c = b.n0 % 2 ? 0 : 4;
          for (var i = -1; i <= n; i++) G.fire(ox + i * gap, -4, DOWN + sl, 95);
        }
      }),
      C('Колокола-близнецы', 'Twin Bells', 660, 36, 65000, 'c', function (G, b, dt) {
        if (G.every(b, 'k0', G.R(0.085), dt)) {
          var s = G.sp0(); s.k = 1; b.a0 += 0.23;
          s.c = 0; G.ring(b.x - 46, b.y + 6, 3, b.a0, 120);
          s.c = 4; G.ring(b.x + 46, b.y + 6, 3, Math.PI - b.a0, 120);
        }
      }),
      C('Клёпаная звезда', 'Riveted Star', 720, 38, 70000, 'c', function (G, b, dt) {
        var s;
        if (G.every(b, 'k0', G.R(1.3), dt)) { s = G.sp0(); s.k = 4; s.c = 3; b.a0 += 0.5; star(G, b.x, b.y, 5, Math.max(3, G.N(8)), b.a0, 150); }
        if (G.every(b, 'k1', G.R(0.7), dt)) { s = G.sp0(); s.k = 1; s.c = 2; G.fan(b.x, b.y, 3, G.aim(b.x, b.y), 0.25, 180); }
      }),
      C('Монетный звон', 'Coin Chime', 780, 40, 80000, 'd', function (G, b, dt) {
        if (G.every(b, 'k0', G.R(0.7), dt)) { var s = G.sp0(); s.k = 2; s.c = 3; s.ac = -170; s.st = 0; s.rt = 1.05; s.f = 2; s.bn = Math.max(6, G.N(20)); s.rs = 120; G.fire(b.x, b.y, G.aim(b.x, b.y) + (G.rnd() - 0.5) * 1.2, 175); }
      })
    ] },
    // ===== Этап 4 =====
    m4: { n: { ru: 'Градобой', en: 'Hailstriker' }, look: 'rotor', home: 115, cards: [
      C('Ледяные зёрна', 'Ice Grains', 360, 24, 35000, 's', function (G, b, dt) {
        if (G.every(b, 'k0', G.R(0.035), dt)) { var s = G.sp0(); s.k = 0; s.c = 4; G.fire(b.x, b.y, DOWN + (G.rnd() - 0.5) * 2.4, 85 + G.rnd() * 110); }
      }),
      C('Обвал', 'Downfall', 380, 24, 35000, 'c', function (G, b, dt) {
        var s;
        if (G.every(b, 'k0', G.R(0.3), dt)) { s = G.sp0(); s.k = 2; s.c = 4; G.fire(14 + G.rnd() * (G.K.FW - 28), -8, DOWN, 150 + G.rnd() * 40); }
        if (G.every(b, 'k1', G.R(1.3), dt)) { s = G.sp0(); s.k = 1; s.c = 1; G.fan(b.x, b.y, Math.max(3, G.N(6)), G.aim(b.x, b.y), 0.7, 150); }
      })
    ] },
    b4: { n: { ru: 'Звонарь Кипун', en: 'The Boiling Ringer' }, look: 'boil', home: 120, cards: [
      C('Кипение', 'Boiling', 680, 34, 70000, 'c', function (G, b, dt) {
        if (G.every(b, 'k0', G.R(0.42), dt)) { var s = G.sp0(); s.k = 2; s.c = (b.n0++ % 3) === 0 ? 2 : 0; s.ac = -180; s.st = 0; s.rt = 0.85; s.f = 2; s.bn = Math.max(6, G.N(16)); s.rs = 100; G.fire(b.x, b.y, DOWN + (G.rnd() - 0.5) * 2.6, 150 + G.rnd() * 40); }
      }),
      C('Двойная спираль', 'Double Helix', 720, 36, 75000, 'c', function (G, b, dt) {
        if (G.every(b, 'k0', G.R(0.09), dt)) {
          var s = G.sp0(), n = Math.max(2, G.N(4)); s.k = 0; b.a0 += 0.19; b.a1 -= 0.15;
          s.c = 0; G.ring(b.x, b.y, n, b.a0, 130);
          s.c = 5; G.ring(b.x, b.y, n, b.a1, 115);
        }
      }),
      C('Лепестковый вал', 'Petal Rampart', 760, 38, 80000, 'c', function (G, b, dt) {
        if (G.every(b, 'k0', G.R(0.9), dt)) {
          var s = G.sp0(), n = G.N(48), d = TAU / n; s.k = 1; s.c = 7; b.a0 += 0.29; b.n0++;
          for (var i = 0; i < n; i++) { s.w = (b.n0 % 2 ? 0.42 : -0.42) * Math.sin(3 * i * d); G.fire(b.x, b.y, b.a0 + i * d, 95); }
        }
      }),
      C('Ливень', 'Downpour', 820, 40, 90000, 's', function (G, b, dt) {
        var s; b.a1 += dt;
        if (G.every(b, 'k0', G.R(0.04), dt)) { s = G.sp0(); s.k = 1; s.c = G.rnd() < 0.7 ? 4 : 1; G.fire(G.rnd() * G.K.FW, -4, DOWN + 0.14 * Math.sin(b.a1 * 0.7), 140 + G.rnd() * 70); }
        if (G.every(b, 'k1', G.R(1.6), dt)) { s = G.sp0(); s.k = 2; s.c = 2; G.ring(b.x, b.y, Math.max(5, G.N(10)), G.aim(b.x, b.y) + Math.PI / 10, 115); }
      })
    ] },
    // ===== Этап 5 =====
    m5: { n: { ru: 'Страж колокольни', en: 'Belfry Warden' }, look: 'rotor', home: 115, cards: [
      C('Отскок молота', 'Hammer Rebound', 420, 24, 40000, 'c', function (G, b, dt) {
        if (G.every(b, 'k0', G.R(0.7), dt)) { var s = G.sp0(), n = G.N(32); s.k = 1; s.c = 0; b.n0++; G.ring(b.x, b.y, n, (b.n0 % 2) * Math.PI / n, 130); }
      }),
      C('Веер искр', 'Spark Fan', 440, 24, 40000, 's', function (G, b, dt) {
        b.a1 += dt;
        if (G.every(b, 'k0', G.R(0.08), dt)) { var s = G.sp0(); s.k = 4; s.c = 3; var a = DOWN + 1.1 * Math.sin(b.a1 * 1.3); G.fire(b.x, b.y, a, 150); G.fire(b.x, b.y, Math.PI - a, 150); }
      })
    ] },
    b5: { n: { ru: 'Большой Набат', en: 'The Great Tocsin' }, look: 'great', home: 130, cards: [
      C('Удар в набат', 'Tocsin Strike', 800, 36, 90000, 'c', function (G, b, dt) {
        var s;
        if (G.every(b, 'k0', G.R(1.3), dt)) { s = G.sp0(); s.k = 0; var n = G.N(28), a = G.rnd() * TAU; s.c = 0; G.ring(b.x, b.y, n, a, 90); s.c = 3; G.ring(b.x, b.y, n, a + Math.PI / n, 120); s.c = 1; G.ring(b.x, b.y, n, a, 150); }
        if (G.every(b, 'k1', G.R(1.0), dt)) { s = G.sp0(); s.k = 1; s.c = 2; G.fan(b.x, b.y, Math.max(3, G.N(5)), G.aim(b.x, b.y), 0.5, 175); }
      }),
      C('Солнечный цветок', 'Sun Flower', 860, 38, 95000, 'c', function (G, b, dt) {
        b.a1 += dt;
        if (G.every(b, 'k0', G.R(0.08), dt)) { var s = G.sp0(), n = Math.max(3, G.N(8)); s.k = 0; s.c = Math.floor(b.a1 * 2) % 2 ? 3 : 0; b.a0 += 0.09 + 0.05 * Math.sin(b.a1 * 0.8); G.ring(b.x, b.y, n, b.a0, 95 + 40 * Math.abs(Math.sin(b.a1 * 1.7))); }
      }),
      C('Стальные нити', 'Steel Threads', 900, 40, 100000, 'c', function (G, b, dt) {
        b.a1 += dt;
        if (G.every(b, 'k0', G.R(0.1), dt)) {
          var s = G.sp0(); s.k = 3; s.c = 1; var sw = Math.sin(b.a1 * 0.6);
          s.w = 0.32; G.fire(18, 30, 0.35 + 0.35 * sw, 140);
          s.w = -0.32; G.fire(G.K.FW - 18, 30, Math.PI - 0.35 - 0.35 * sw, 140);
        }
        if (G.every(b, 'k1', G.R(1.4), dt)) { var s2 = G.sp0(); s2.k = 2; s2.c = 5; G.fire(b.x, b.y, G.aim(b.x, b.y), 130); }
      }),
      C('Небесный ливень', 'Heavenly Downpour', 900, 40, 105000, 's', function (G, b, dt) {
        var s;
        if (G.every(b, 'k0', G.R(0.08), dt)) { s = G.sp0(); s.k = 1; s.c = 4; s.ac = -120; s.st = 40; s.rt = 1.3; s.f = 1; s.ra = (G.rnd() - 0.5) * 0.5; s.rs = 120; G.fire(G.rnd() * G.K.FW, -4, DOWN, 160); }
        if (G.every(b, 'k1', G.R(2.0), dt)) { s = G.sp0(); s.k = 0; s.c = 7; flower(G, b.x, b.y, G.N(52), G.rnd() * TAU, 6, 70, 125); }
      }),
      C('Последний перезвон: Звезда Гефеста', 'Final Peal: Star of Hefest', 1150, 52, 150000, 'c', function (G, b, dt) {
        var s;
        if (G.every(b, 'k0', G.R(2.1), dt)) { s = G.sp0(); s.k = 4; s.c = 3; b.a0 += 0.33; star(G, b.x, b.y, 6, Math.max(3, G.N(8)), b.a0, 140); }
        if (G.every(b, 'k1', G.R(0.14), dt)) { s = G.sp0(); s.k = 1; s.c = 0; b.a1 += 0.17; G.ring(b.x, b.y, Math.max(2, G.N(4)), b.a1, 100); }
        if (G.every(b, 'k2', G.R(1.7), dt)) { s = G.sp0(); s.k = 2; s.c = 2; G.fire(b.x, b.y, G.aim(b.x, b.y), 150); }
      })
    ] }
  };
})(typeof window !== 'undefined' ? window : globalThis);
