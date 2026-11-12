/* СЕВЕРНАЯ САГА II — js/vikings-retro.js
   Пиксель-арт трёх героев (Таран — snorri, Стрелок — gunnar, Опора — bjorn), общий с сагой 1:
   блок HERO-SPRITES ниже дословно совпадает с блоком в saga/js/game.js (render-retro), поэтому
   герои выглядят одинаково в обеих играх (тест — tests/engine.test.mjs).
   Рисует персонажа вокруг origin (ноги в 0,0, корпус вверх по −y) в НАТИВНОМ масштабе
   (1 арт-пиксель). Вызывающий (render.js drawVikingR) ставит translate на ноги актора,
   флип по направлению и scale(2,2) — 1 арт-пиксель = 2 мировых px (retro-сетка).
   Без внешних ассетов, offline. */
(function () {
  'use strict';

  function hx(hex) {
    var h = hex.charAt(0) === "#" ? hex.slice(1) : hex;
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbHex(r, g, b) {
    r = r < 0 ? 0 : r > 255 ? 255 : Math.round(r);
    g = g < 0 ? 0 : g > 255 ? 255 : Math.round(g);
    b = b < 0 ? 0 : b > 255 ? 255 : Math.round(b);
    var s = ((r << 16) | (g << 8) | b).toString(16);
    while (s.length < 6) s = "0" + s;
    return "#" + s;
  }
  function shade(hex, f) {
    var c = hx(hex);
    if (f >= 1) { var d = (f - 1); return rgbHex(c[0] + (255 - c[0]) * d, c[1] + (255 - c[1]) * d, c[2] + (255 - c[2]) * d); }
    return rgbHex(c[0] * f, c[1] * f, c[2] * f);
  }
  function rr(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function fillCircle(g, cx, cy, r, col) {
    g.fillStyle = col;
    for (var dy = -r; dy <= r; dy++) {
      var w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.4));
      g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
    }
  }

  /* ==== HERO-SPRITES:BEGIN ====
     Общий пиксель-арт трёх героев саги — мастеров северной кузни студии «Гефест»:
       snorri — Таран: кожаный капюшон с хвостом, кузнечный фартук, медный наплечник, краги;
       gunnar — Стрелок: высокая меховая шапка, длинный кафтан с меховой оторочкой, шарф, арбалет;
       bjorn  — Опора: широкие плечи, стёганый жилет, кольчужные рукава, кузнечные очки на лбу,
                короткая борода-косица, большой круглый щит-кузнечный круг с заклёпками.
     Блок между маркерами HERO-SPRITES:BEGIN/END ДОСЛОВНО одинаков в saga/js/game.js и
     saga-2/js/vikings-retro.js (проверяют tests/engine.test.mjs обеих саг) — правьте оба места сразу.
     Позы (pickPose), кадры (heroFrame) и их тайминги — прежние; меняется только облик.
     Нужны из окружения: rr(g,x,y,w,h,col), shade(hex,k), fillCircle(g,cx,cy,r,col).
     Начало координат — ноги (0,0), корпус вверх по −y, лицом в +x, 1 арт-пиксель. */
  var CHARS = {
    snorri: {
      skin: "#e8b48c", skinS: "#c98f66", skinD: "#9c6a48",
      sleeve: "#4c5263", sleeveS: "#343846", sleeveL: "#6b7286",
      fore: "#e8b48c", foreS: "#c08660", hand: "#5a3a26", handL: "#7a5236",
      pants: "#3f322b", pantsS: "#2a201b", pantsL: "#58473c",
      hood: "#57473e", hoodS: "#382d27", hoodL: "#786454",
      apron: "#8c5a34", apronS: "#5e3c22", apronL: "#ad7746",
      copper: "#d27c3e", copperS: "#8e4a20", copperL: "#f5b070",
      ember: "#ffb347", emberL: "#fff2b8",
      leather: "#4e3222", leatherL: "#6e4a32",
      boot: "#2f2621", bootS: "#1c1612", bootL: "#4c3d33",
      hair: "#2e2220", eye: "#1e1a26", white: "#f4f7ff"
    },
    gunnar: {
      skin: "#eebf95", skinS: "#c99870", skinD: "#9c6c4a",
      sleeve: "#2f7a78", sleeveS: "#1f5452", sleeveL: "#4aa29e",
      coat: "#2f7a78", coatS: "#1f5452", coatL: "#4aa29e",
      pants: "#4a4036", pantsS: "#322b24", pantsL: "#625548",
      fur: "#cbbfa8", furS: "#968a74", furL: "#e6dcc8",
      scarf: "#8c3646", scarfS: "#5e2230", scarfL: "#b54c5e",
      wood: "#8a5a2e", woodL: "#b07a40", woodS: "#5a3a1c",
      steel: "#c4ccd8", steelS: "#7e8896", string: "#e8e0c8",
      leather: "#6a4428", leatherL: "#8c5e38",
      boot: "#3a2c22", bootS: "#241a14", bootL: "#56443a",
      hair: "#3a2a20", eye: "#1e1a26", white: "#f4f7ff"
    },
    bjorn: {
      skin: "#d9a47c", skinS: "#b5805a", skinD: "#8a5c3c",
      sleeve: "#9aa3ae", sleeveS: "#6c7480", sleeveL: "#c4ccd6",
      vest: "#3e5878", vestS: "#2a3d56", vestL: "#5a7a9e",
      pants: "#3b3631", pantsS: "#27231f", pantsL: "#524b44",
      beard: "#4a2e1e", beardS: "#2e1c12", beardL: "#6c4630",
      brass: "#d4a03c", brassS: "#8e6a22", brassL: "#f6d680",
      glass: "#6fcfe0", glassL: "#dcfaff",
      steel: "#a6b0be", steelS: "#6a7484", steelD: "#444e5e", steelL: "#e2e8f0",
      leather: "#5a3a26", leatherL: "#7a5236",
      boot: "#332a22", bootS: "#1f1914", bootL: "#4e4136",
      eye: "#1e1a26", white: "#f4f7ff"
    }
  };

  function dimPal(id) {
    var src = CHARS[id];
    if (!src._dim) {
      var d = {};
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k) && k.charAt(0) !== "_" && typeof src[k] === "string") d[k] = shade(src[k], 0.72);
      src._dim = d;
    }
    return src._dim;
  }

  /* сплошная пиксельная конечность: штампует блоки w×w вдоль отрезка (без дыр) */
  function limb(g, x0, y0, x1, y1, w, col) {
    var dx = x1 - x0, dy = y1 - y0;
    var n = Math.max(Math.abs(dx), Math.abs(dy));
    g.fillStyle = col;
    if (n === 0) { g.fillRect(x0 | 0, y0 | 0, w, w); return; }
    for (var i = 0; i <= n; i++) {
      g.fillRect(Math.round(x0 + (dx * i) / n) | 0, Math.round(y0 + (dy * i) / n) | 0, w, w);
    }
  }

  function drawLeg(g, pal, leg, back) {
    var pants = back ? pal.pantsS : pal.pants;
    limb(g, leg.hip, -6, leg.knee[0], leg.knee[1], 2, pants);
    limb(g, leg.knee[0], leg.knee[1], leg.foot[0], leg.foot[1], 2, pants);
    if (!back) limb(g, leg.hip, -6, leg.knee[0], leg.knee[1], 1, pal.pantsL);
    /* голенище сапога */
    rr(g, leg.foot[0] - 1, leg.foot[1] - 2, 2, 1, back ? pal.bootS : pal.bootL);
    /* сапог */
    var bx = leg.foot[0] - 1, by = leg.foot[1] - 1;
    rr(g, bx, by, 3, 2, back ? pal.bootS : pal.boot);
    rr(g, bx, by, 3, 1, back ? pal.bootS : pal.bootL);
    if (!back) rr(g, bx + 2, by + 1, 1, 1, pal.bootS);
  }

  function drawArm(g, pal, arm, back, up) {
    var upper = back ? pal.sleeveS : pal.sleeve;
    var lower = pal.fore ? (back ? pal.foreS : pal.fore) : upper;
    limb(g, arm.sh, -13, arm.el[0], arm.el[1], 2, upper);
    limb(g, arm.el[0], arm.el[1], arm.hand[0], arm.hand[1], 2, lower);
    if (!back) {
      limb(g, arm.sh, -13, arm.el[0], arm.el[1], 1, pal.sleeveL);
      /* закатанный рукав / обшлаг */
      rr(g, arm.el[0] - 1, arm.el[1] + 1, 3, 1, pal.fore ? pal.sleeveL : pal.leather);
    }
    /* кисть: у Тарана — кожаная крага */
    var hx = arm.hand[0] - 1, hy = arm.hand[1] - 1;
    var hc = pal.hand || pal.skin;
    rr(g, hx, hy, 2, 2, hc);
    rr(g, hx, hy, 2, 1, pal.handL || shade(pal.skin, 1.06));
    if (up) rr(g, hx, hy + 1, 2, 1, pal.hand ? pal.leather : pal.skinS);
  }

  function pickPose(st, f) {
    var P = {
      bob: 0, lean: 0,
      legs: [
        { hip: -2, knee: [-2, -4], foot: [-3, -1] },
        { hip: 1, knee: [1, -4], foot: [2, -1] }
      ],
      arms: [
        { sh: -3, el: [-3, -10], hand: [-3, -8] },
        { sh: 3, el: [4, -10], hand: [4, -8] }
      ]
    };
    var R, rf;
    if (st === "run") {
      R = [
        { bob: 0, A: [-3, [-4, -4], [-4, -1]], B: [2, [2, -4], [3, -1]], aA: [-3, [-4, -10], [-4, -11]], aB: [3, [5, -10], [4, -10]] },
        { bob: 1, A: [-2, [-2, -4], [-2, -1]], B: [2, [2, -4], [2, -2]], aA: [-3, [-4, -11], [-4, -12]], aB: [3, [4, -11], [4, -12]] },
        { bob: 0, A: [1, [1, -4], [2, -2]], B: [1, [0, -4], [-3, -1]], aA: [-3, [-4, -11], [-3, -12]], aB: [3, [4, -11], [3, -11]] },
        { bob: 1, A: [-1, [-1, -4], [-1, -1]], B: [2, [2, -4], [1, -2]], aA: [-3, [-4, -10], [-4, -10]], aB: [3, [4, -10], [5, -10]] }
      ];
      rf = R[f % 4];
      P.bob = rf.bob;
      P.legs[0] = { hip: rf.A[0], knee: rf.A[1], foot: rf.A[2] };
      P.legs[1] = { hip: rf.B[0], knee: rf.B[1], foot: rf.B[2] };
      P.arms[0] = { sh: rf.aA[0], el: rf.aA[1], hand: rf.aA[2] };
      P.arms[1] = { sh: rf.aB[0], el: rf.aB[1], hand: rf.aB[2] };
    } else if (st === "jump") {
      P.legs[0] = { hip: -2, knee: [-3, -5], foot: [-2, -4] };
      P.legs[1] = { hip: 1, knee: [2, -5], foot: [2, -5] };
      P.arms[0] = { sh: -3, el: [-4, -14], hand: [-5, -16] };
      P.arms[1] = { sh: 3, el: [4, -14], hand: [5, -16] };
      P.bob = f % 2 ? 1 : 0;
    } else if (st === "fall") {
      P.legs[0] = { hip: -2, knee: [-4, -4], foot: [-5, -2] };
      P.legs[1] = { hip: 1, knee: [3, -4], foot: [4, -2] };
      P.arms[0] = { sh: -3, el: [-5, -12], hand: [-6, -11] };
      P.arms[1] = { sh: 3, el: [5, -12], hand: [6, -11] };
      P.bob = f % 2 ? 1 : 0;
    } else if (st === "act") {
      P.legs[0] = { hip: -2, knee: [-4, -4], foot: [-4, -1] };
      P.legs[1] = { hip: 2, knee: [3, -4], foot: [3, -1] };
      P.arms[0] = { sh: -3, el: [-4, -11], hand: [-3, -13] };
      P.arms[1] = { sh: 3, el: [5, -11], hand: [6, -11] };
      P.lean = 1;
    } else if (st === "brace") {
      P.legs[0] = { hip: -3, knee: [-3, -4], foot: [-3, -1] };
      P.legs[1] = { hip: 3, knee: [3, -4], foot: [3, -1] };
      P.arms[0] = { sh: -3, el: [-5, -18], hand: [-5, -21] };
      P.arms[1] = { sh: 3, el: [5, -18], hand: [5, -21] };
    } else {
      P.bob = f % 2;
      P.arms[0] = { sh: -3, el: [-4, -10], hand: [-4, f % 2 ? -8 : -9] };
      P.arms[1] = { sh: 3, el: [4, -10], hand: [4, f % 2 ? -9 : -8] };
    }
    return P;
  }

  /* ── Таран (snorri): капюшон, фартук, медный наплечник; «действие» — удар плечом ── */
  function drawSnorri(g, pal, pose, st, f, t) {
    var by = -pose.bob, L = pose.lean;
    drawLeg(g, pal, pose.legs[0], true);
    drawLeg(g, pal, pose.legs[1], false);
    drawArm(g, pal, pose.arms[0], true);
    /* рубаха */
    rr(g, -3 + L, -14 + by, 6, 8, pal.sleeve);
    rr(g, -3 + L, -14 + by, 6, 1, pal.sleeveL);
    rr(g, -3 + L, -13 + by, 1, 7, pal.sleeveS);
    /* пояс сзади */
    rr(g, -3 + L, -8 + by, 3, 1, pal.leather);
    /* кузнечный фартук: от груди до колен */
    rr(g, -1 + L, -13 + by, 4, 8, pal.apron);
    rr(g, -2 + L, -7 + by, 5, 3, pal.apron);
    rr(g, -1 + L, -13 + by, 1, 6, pal.apronS);
    rr(g, -2 + L, -7 + by, 1, 3, pal.apronS);
    rr(g, 2 + L, -12 + by, 1, 6, pal.apronL);
    rr(g, 0 + L, -9 + by, 2, 1, pal.apronS);
    rr(g, -2 + L, -4 + by, 5, 1, pal.apronS);
    /* лямка фартука */
    rr(g, 0 + L, -14 + by, 1, 1, pal.leather);
    if (st === "act") {
      /* след рывка позади */
      rr(g, -6 + L, -12 + by, 2, 1, pal.sleeveS);
      rr(g, -7 + L, -10 + by, 2, 1, pal.sleeveS);
      rr(g, -6 + L, -8 + by, 1, 1, pal.sleeveS);
    }
    drawArm(g, pal, pose.arms[1], false);
    /* медный наплечник — ведущее плечо */
    var px = 2 + L + (st === "act" ? 1 : 0);
    rr(g, px, -14 + by, 4, 1, pal.copperL);
    rr(g, px, -13 + by, 4, 1, pal.copper);
    rr(g, px + 1, -12 + by, 3, 1, pal.copperS);
    rr(g, px + 3, -13 + by, 1, 1, pal.emberL);
    /* голова в капюшоне */
    var hX = L * 2, hy = by;
    /* хвост капюшона за спиной */
    rr(g, -5 + hX, -20 + hy, 1, 3, pal.hoodS);
    rr(g, -6 + hX, -18 + hy, 1, 2, pal.hoodS);
    /* капюшон */
    rr(g, -2 + hX, -23 + hy, 4, 1, pal.hoodL);
    rr(g, -3 + hX, -22 + hy, 6, 1, pal.hood);
    rr(g, -4 + hX, -21 + hy, 7, 5, pal.hood);
    rr(g, -4 + hX, -21 + hy, 1, 5, pal.hoodS);
    rr(g, -1 + hX, -22 + hy, 3, 1, pal.hoodL);
    /* ворот-пелерина на плечах */
    rr(g, -4 + hX, -16 + hy, 4, 1, pal.hood);
    rr(g, -4 + hX, -15 + hy, 7, 1, pal.hoodS);
    rr(g, -3 + hX, -15 + hy, 5, 1, pal.hood);
    /* лицо в проёме капюшона */
    rr(g, 0 + hX, -20 + hy, 3, 5, pal.skin);
    rr(g, 0 + hX, -20 + hy, 3, 1, pal.hoodL);
    rr(g, 3 + hX, -19 + hy, 1, 3, pal.skin);
    rr(g, 0 + hX, -19 + hy, 1, 1, pal.hair);
    rr(g, 1 + hX, -18 + hy, 1, 1, pal.white);
    rr(g, 2 + hX, -18 + hy, 1, 1, pal.eye);
    rr(g, 1 + hX, -19 + hy, 2, 1, pal.hair);
    rr(g, 3 + hX, -17 + hy, 1, 1, pal.skinS);
    rr(g, 1 + hX, -16 + hy, 2, 1, pal.skinS);
    /* сажа на щеке */
    rr(g, 0 + hX, -17 + hy, 1, 1, pal.skinD);
    if (st === "act") {
      /* искры удара перед наплечником */
      var s = (f % 3);
      rr(g, 6 + hX, -16 + hy - s, 1, 1, pal.emberL);
      rr(g, 7 + hX, -14 + hy, 1, 1, pal.ember);
      rr(g, 8 + hX, -17 + hy + s, 1, 1, pal.ember);
      rr(g, 7 + hX, -12 + hy - s, 1, 1, pal.copperL);
    }
  }

  /* ── Стрелок (gunnar): меховая шапка, кафтан, шарф; арбалет ── */
  function drawCrossbowOnBack(g, pal, by) {
    limb(g, -5, -17 + by, -2, -8 + by, 1, pal.woodS);
    rr(g, -7, -17 + by, 5, 1, pal.steelS);
    rr(g, -7, -18 + by, 1, 1, pal.steelS);
    rr(g, -3, -18 + by, 1, 1, pal.steelS);
  }

  function drawCrossbow(g, pal, hx, hy) {
    /* ложе */
    rr(g, hx - 2, hy, 8, 1, pal.wood);
    rr(g, hx - 2, hy, 8, 1, pal.woodL);
    rr(g, hx - 2, hy + 1, 3, 1, pal.woodS);
    /* дуга (стальная) */
    rr(g, hx + 5, hy - 3, 1, 7, pal.steel);
    rr(g, hx + 4, hy - 4, 1, 1, pal.steelS);
    rr(g, hx + 4, hy + 4, 1, 1, pal.steelS);
    /* тетива и болт */
    limb(g, hx + 4, hy - 3, hx + 1, hy, 1, pal.string);
    limb(g, hx + 1, hy, hx + 4, hy + 3, 1, pal.string);
    rr(g, hx + 6, hy - 1, 2, 1, pal.steel);
  }

  function drawGunnar(g, pal, pose, st, f, t) {
    var by = -pose.bob, L = pose.lean;
    /* хвост шарфа за спиной */
    var sw = (f % 2);
    rr(g, -5 + L * 2, -16 + by, 2, 1, pal.scarfS);
    rr(g, -6 + L * 2, -15 + by + sw, 2, 1, pal.scarf);
    drawLeg(g, pal, pose.legs[0], true);
    drawLeg(g, pal, pose.legs[1], false);
    drawArm(g, pal, pose.arms[0], true);
    if (st !== "act") drawCrossbowOnBack(g, pal, by);
    /* длинный кафтан */
    rr(g, -3, -15 + by, 6, 9, pal.coat);
    rr(g, -4, -7 + by, 8, 3, pal.coat);
    rr(g, -3, -15 + by, 6, 1, pal.coatL);
    rr(g, -3, -14 + by, 1, 8, pal.coatS);
    rr(g, -4, -7 + by, 1, 3, pal.coatS);
    rr(g, 1, -13 + by, 1, 9, pal.coatS);
    rr(g, 2, -12 + by, 1, 5, pal.coatL);
    /* меховая оторочка подола */
    rr(g, -4, -4 + by, 8, 1, pal.fur);
    rr(g, -4, -4 + by, 2, 1, pal.furS);
    /* пояс и колчан болтов на бедре */
    rr(g, -3, -10 + by, 6, 1, pal.leather);
    rr(g, 1, -10 + by, 1, 1, pal.steel);
    rr(g, -4, -10 + by, 2, 4, pal.leatherL);
    rr(g, -4, -11 + by, 1, 1, pal.steel);
    rr(g, -3, -11 + by, 1, 1, pal.steelS);
    drawArm(g, pal, pose.arms[1], false);
    if (st === "act") drawCrossbow(g, pal, pose.arms[1].hand[0], pose.arms[1].hand[1] + by);
    /* голова */
    var hX = L * 2, hy = by;
    /* лицо */
    rr(g, -2 + hX, -20 + hy, 5, 4, pal.skin);
    rr(g, -2 + hX, -20 + hy, 1, 4, pal.skinS);
    rr(g, 0 + hX, -19 + hy, 2, 1, pal.hair);
    rr(g, 0 + hX, -18 + hy, 1, 1, pal.white);
    rr(g, 1 + hX, -18 + hy, 1, 1, pal.eye);
    rr(g, 3 + hX, -18 + hy, 1, 1, pal.skinS);
    /* шарф, закрывающий подбородок */
    rr(g, -3 + hX, -16 + hy, 6, 2, pal.scarf);
    rr(g, -2 + hX, -16 + hy, 5, 1, pal.scarfL);
    rr(g, -3 + hX, -15 + hy, 2, 1, pal.scarfS);
    /* высокая меховая шапка с ушком */
    rr(g, -2 + hX, -26 + hy, 4, 1, pal.coatL);
    rr(g, -3 + hX, -25 + hy, 6, 1, pal.furL);
    rr(g, -3 + hX, -24 + hy, 6, 2, pal.fur);
    rr(g, -4 + hX, -22 + hy, 8, 2, pal.fur);
    rr(g, -4 + hX, -22 + hy, 8, 1, pal.furL);
    rr(g, -3 + hX, -24 + hy, 1, 2, pal.furS);
    rr(g, 0 + hX, -23 + hy, 1, 1, pal.furS);
    rr(g, 2 + hX, -24 + hy, 1, 1, pal.furS);
    rr(g, -4 + hX, -20 + hy, 2, 3, pal.furS);
    rr(g, -4 + hX, -20 + hy, 1, 3, pal.fur);
    if (st === "act") rr(g, 9 + hX, -15 + hy, 2, 1, pal.steel);
  }

  /* ── Опора (bjorn): кузнечные очки, косица, щит-кузнечный круг ── */
  function drawBjornShieldOverhead(g, pal, by) {
    var y = -30;
    /* круг ребром: линза из стали с латунным ободом */
    rr(g, -1, y - 1, 2, 1, pal.brassL);
    rr(g, -8, y, 16, 1, pal.steelL);
    rr(g, -10, y + 1, 20, 1, pal.steel);
    rr(g, -10, y + 2, 20, 1, pal.steelS);
    rr(g, -8, y + 3, 16, 1, pal.steelD);
    rr(g, -10, y + 1, 1, 2, pal.brass);
    rr(g, 9, y + 1, 1, 2, pal.brass);
    rr(g, -9, y, 1, 1, pal.brassS);
    rr(g, 8, y, 1, 1, pal.brassS);
    /* заклёпки по кругу */
    rr(g, -7, y + 1, 1, 1, pal.brassL);
    rr(g, -4, y + 1, 1, 1, pal.brassL);
    rr(g, 3, y + 1, 1, 1, pal.brassL);
    rr(g, 6, y + 1, 1, 1, pal.brassL);
    rr(g, -2, y + 1, 4, 2, pal.steelD);
    rr(g, -1, y + 1, 2, 1, pal.brass);
    /* ремни */
    rr(g, -6, y + 4, 2, 2, pal.leather);
    rr(g, 4, y + 4, 2, 2, pal.leather);
  }

  function drawBjornShield(g, pal) {
    var sx = 4, sy = -10;
    fillCircle(g, sx, sy, 6, pal.brassS);
    fillCircle(g, sx, sy, 5, pal.steelS);
    fillCircle(g, sx, sy, 4, pal.steel);
    rr(g, sx - 3, sy - 4, 4, 1, pal.steelL);
    rr(g, sx - 4, sy - 3, 2, 2, pal.steelL);
    /* кольцо заклёпок */
    rr(g, sx, sy - 4, 1, 1, pal.brassL);
    rr(g, sx + 3, sy - 2, 1, 1, pal.brassL);
    rr(g, sx + 3, sy + 2, 1, 1, pal.brassL);
    rr(g, sx, sy + 4, 1, 1, pal.brassL);
    rr(g, sx - 3, sy + 2, 1, 1, pal.brassL);
    rr(g, sx - 3, sy - 2, 1, 1, pal.brassL);
    /* умбон-наковаленка */
    rr(g, sx - 1, sy - 1, 3, 3, pal.steelD);
    rr(g, sx - 1, sy - 1, 2, 1, pal.brass);
    rr(g, sx + 1, sy + 1, 1, 1, pal.steelS);
  }

  function drawBjorn(g, pal, pose, st, f, t) {
    var by = -pose.bob, L = pose.lean;
    drawLeg(g, pal, pose.legs[0], true);
    drawLeg(g, pal, pose.legs[1], false);
    drawArm(g, pal, pose.arms[0], true, st === "brace");
    /* торс-трапеция: широкие плечи, узкая талия */
    rr(g, -4, -15 + by, 9, 3, pal.vest);
    rr(g, -3, -12 + by, 7, 3, pal.vest);
    rr(g, -3, -9 + by, 6, 3, pal.vest);
    rr(g, -4, -15 + by, 9, 1, pal.vestL);
    rr(g, -4, -14 + by, 1, 2, pal.vestS);
    rr(g, -3, -12 + by, 1, 6, pal.vestS);
    /* стёжка жилета */
    rr(g, -1, -13 + by, 1, 6, pal.vestS);
    rr(g, 2, -13 + by, 1, 6, pal.vestS);
    rr(g, 3, -12 + by, 1, 3, pal.vestL);
    /* кольчужные наплечья */
    rr(g, -4, -16 + by, 2, 2, pal.sleeve);
    rr(g, 3, -16 + by, 2, 2, pal.sleeve);
    rr(g, 3, -16 + by, 2, 1, pal.sleeveL);
    /* ремень с латунной пряжкой */
    rr(g, -3, -7 + by, 6, 1, pal.leather);
    rr(g, 0, -7 + by, 2, 1, pal.brass);
    drawArm(g, pal, pose.arms[1], false, st === "brace");
    /* голова: бритая, очки на лбу */
    var hX = L * 2, hy = by;
    rr(g, -2 + hX, -23 + hy, 4, 1, pal.skin);
    rr(g, -3 + hX, -22 + hy, 6, 6, pal.skin);
    rr(g, -3 + hX, -22 + hy, 1, 6, pal.skinS);
    rr(g, -2 + hX, -23 + hy, 2, 1, shade(pal.skin, 1.12));
    rr(g, 3 + hX, -19 + hy, 1, 2, pal.skin);
    /* ремешок очков и линза */
    rr(g, -3 + hX, -21 + hy, 6, 1, pal.leather);
    rr(g, 0 + hX, -22 + hy, 3, 2, pal.brass);
    rr(g, 1 + hX, -22 + hy, 1, 1, pal.glassL);
    rr(g, 1 + hX, -21 + hy, 1, 1, pal.glass);
    rr(g, -2 + hX, -22 + hy, 1, 1, pal.brassS);
    /* ухо, бровь, глаз */
    rr(g, -2 + hX, -19 + hy, 1, 2, pal.skinS);
    rr(g, 0 + hX, -20 + hy, 2, 1, pal.beardS);
    rr(g, 0 + hX, -19 + hy, 1, 1, pal.white);
    rr(g, 1 + hX, -19 + hy, 1, 1, pal.eye);
    rr(g, 2 + hX, -18 + hy, 1, 1, pal.skinS);
    /* короткая тёмная борода с косицей и латунным кольцом */
    rr(g, -1 + hX, -17 + hy, 5, 1, pal.beard);
    rr(g, -2 + hX, -16 + hy, 5, 2, pal.beard);
    rr(g, 0 + hX, -17 + hy, 3, 1, pal.beardL);
    rr(g, -2 + hX, -16 + hy, 1, 2, pal.beardS);
    rr(g, 0 + hX, -14 + hy, 2, 2, pal.beard);
    rr(g, 0 + hX, -12 + hy, 2, 1, pal.brass);
    /* щит */
    if (st === "brace" || st === "act") drawBjornShieldOverhead(g, pal, by);
    else drawBjornShield(g, pal);
  }

  function drawDeadViking(g, pal, id) {
    /* лежит на земле, головой в +x */
    if (id === "snorri") {
      rr(g, -7, -6, 12, 5, pal.sleeveS);
      rr(g, -7, -6, 12, 1, pal.sleeve);
      rr(g, -4, -5, 8, 3, pal.apron);
      rr(g, -4, -5, 8, 1, pal.apronL);
      rr(g, -8, -3, 3, 3, pal.boot);
      rr(g, -8, -3, 3, 1, pal.bootL);
      rr(g, 3, -8, 3, 2, pal.copper);
      rr(g, 4, -10, 6, 5, pal.hood);
      rr(g, 4, -10, 6, 1, pal.hoodL);
      rr(g, 10, -8, 2, 1, pal.hoodS);
      rr(g, 6, -8, 3, 2, pal.skin);
      rr(g, 7, -7, 1, 1, pal.eye);
    } else if (id === "gunnar") {
      rr(g, -7, -6, 12, 5, pal.coatS);
      rr(g, -7, -6, 12, 1, pal.coat);
      rr(g, -7, -2, 10, 1, pal.fur);
      rr(g, -8, -3, 3, 3, pal.boot);
      rr(g, -8, -3, 3, 1, pal.bootL);
      rr(g, 3, -6, 4, 2, pal.scarf);
      rr(g, 4, -9, 4, 3, pal.skin);
      rr(g, 6, -8, 1, 1, pal.eye);
      rr(g, 9, -6, 4, 3, pal.fur);
      rr(g, 9, -6, 4, 1, pal.furL);
      rr(g, -6, -9, 6, 1, pal.wood);
      rr(g, -1, -11, 1, 4, pal.steel);
    } else {
      rr(g, -7, -6, 12, 5, pal.vestS);
      rr(g, -7, -6, 12, 1, pal.vest);
      rr(g, -8, -3, 3, 3, pal.boot);
      rr(g, -8, -3, 3, 1, pal.bootL);
      rr(g, 4, -10, 6, 5, pal.skin);
      rr(g, 4, -10, 6, 1, shade(pal.skin, 1.12));
      rr(g, 7, -10, 2, 2, pal.brass);
      rr(g, 3, -6, 5, 2, pal.beard);
      rr(g, 6, -7, 1, 1, pal.eye);
      fillCircle(g, -3, -9, 3, pal.steelS);
      fillCircle(g, -3, -9, 2, pal.steel);
      rr(g, -3, -9, 1, 1, pal.brass);
    }
    rr(g, -2, -14, 1, 1, "rgba(220,230,255,0.45)");
    rr(g, -4, -16, 1, 1, "rgba(220,230,255,0.3)");
  }

  /* номер кадра по состоянию и времени анимации (тайминги прежние) */
  function heroFrame(st, anim) {
    anim = anim || 0;
    if (st === "run") return Math.floor(anim * 7.5) % 4;
    if (st === "idle") return Math.floor(anim * 2.2) % 2;
    if (st === "jump" || st === "fall") return Math.floor(anim * 4) % 2;
    return Math.floor(anim * 6) % 3;
  }

  function heroId(id) { return (id === "snorri" || id === "gunnar" || id === "bjorn") ? id : "snorri"; }

  /* герой целиком: id, состояние (idle/run/jump/fall/act/brace), время анимации, t, активен ли */
  function drawHero(g, id, st, anim, t, active) {
    id = heroId(id);
    var pal = active ? CHARS[id] : dimPal(id);
    var f = heroFrame(st, anim);
    var pose = pickPose(st, f);
    if (id === "bjorn") {
      pose.legs[0].hip = -3; pose.legs[1].hip = 3;
      pose.arms[0].sh = -4; pose.arms[1].sh = 4;
      if (st === "idle" || st === "run") {
        pose.arms[0].el[0] = -4; pose.arms[0].hand[0] = -4;
        pose.arms[1].el[0] = 5; pose.arms[1].hand[0] = 5;
      }
    }
    if (id === "snorri") drawSnorri(g, pal, pose, st, f, t);
    else if (id === "gunnar") drawGunnar(g, pal, pose, st, f, t);
    else drawBjorn(g, pal, pose, st, f, t);
  }

  function drawHeroDead(g, id, active) {
    id = heroId(id);
    drawDeadViking(g, active ? CHARS[id] : dimPal(id), id);
  }
  /* ==== HERO-SPRITES:END ==== */

  /* состояние актора саги 2 → состояние спрайта */
  function mapState(a) {
    var s = a.state || "idle";
    if (a.id === "bjorn" && a.shieldUp) return "brace";
    if (s === "run" || s === "walk") return "run";
    if (s === "shoot" || s === "attack" || s === "act" || s === "push" || s === "pull") return "act";
    if (s === "jump") return "jump";
    if (s === "fall" || s === "climb") return "fall";
    return "idle";
  }

  window.SAGA2VIK = { drawChar: drawHero, drawDead: drawHeroDead, mapState: mapState, CHARS: CHARS };
})();
