/* СЕВЕРНАЯ САГА II — js/vikings-retro.js
   Пиксель-арт викингов, перенесён ПИКСЕЛЬ-В-ПИКСЕЛЬ из саги 1 (src/render-retro.js),
   чтобы Снорри/Гуннар/Бьорн (erik/baleog/olaf) выглядели одинаково в обеих играх.
   Рисует персонажа вокруг origin (ноги в 0,0, корпус вверх по −y) в НАТИВНОМ масштабе
   (1 арт-пиксель). Вызывающий (render.js drawVikingR) ставит translate на ноги актора,
   флип по направлению и scale(2,2) — 1 арт-пиксель = 2 мировых px (retro-сетка).
   Owner: retro-artist. Без внешних ассетов, offline. */
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
  function limb(g, x0, y0, x1, y1, w, col) {
    var dx = x1 - x0, dy = y1 - y0;
    var n = Math.max(Math.abs(dx), Math.abs(dy));
    g.fillStyle = col;
    if (n === 0) { g.fillRect(x0 | 0, y0 | 0, w, w); return; }
    for (var i = 0; i <= n; i++) {
      g.fillRect(Math.round(x0 + (dx * i) / n) | 0, Math.round(y0 + (dy * i) / n) | 0, w, w);
    }
  }

  var CHARS = {
    erik: {
      skin: "#f2c496", skinS: "#d8a170", skinD: "#b0784a",
      tunic: "#e2622c", tunicS: "#a83c16", tunicL: "#f58c46",
      metal: "#c8d0dc", metalS: "#8b95a8", metalD: "#565e70", metalL: "#eef3fa",
      hair: "#e8621c", hairS: "#a83c0e", hairL: "#ff9a4a",
      leather: "#7a4a24", leatherL: "#a06a34", gold: "#f2c24a", goldL: "#ffe9a0",
      boot: "#4a3320", bootS: "#2e1f12", bootL: "#6b4a2c",
      cream: "#f0e6d2", creamL: "#fff6e2", eye: "#241a2e", white: "#f4f7ff"
    },
    baleog: {
      skin: "#f0c08c", skinS: "#cf9a66", skinD: "#a07044",
      tunic: "#3f9e4d", tunicS: "#266b34", tunicL: "#63c76e",
      metal: "#c8d0dc", metalS: "#8b95a8", metalD: "#565e70", metalL: "#eef3fa",
      hair: "#7a431e", hairS: "#4e2a0e", hairL: "#9c5c2a",
      leather: "#7a4a24", leatherL: "#a06a34", gold: "#f2c24a", goldL: "#ffe9a0",
      boot: "#3e2c1c", bootS: "#261a10", bootL: "#5c442a",
      bow: "#9a6430", bowL: "#c08a4a", bowS: "#6e4420", string: "#e8e0c8", blade: "#e6eef8", bladeS: "#9aa8bc",
      eye: "#241a2e", white: "#f4f7ff"
    },
    olaf: {
      skin: "#f2c49b", skinS: "#d19f74", skinD: "#a87a50",
      tunic: "#2f6fd0", tunicS: "#1d4890", tunicL: "#4f92f0",
      metal: "#d8c8a0", metalS: "#a89870", metalD: "#706448", metalL: "#f4e8c6",
      hair: "#e8dcc0", hairS: "#b8a888", hairL: "#fbf2dc",
      leather: "#7a4a24", leatherL: "#a06a34", gold: "#f2c24a", goldL: "#ffe9a0",
      boot: "#3a3020", bootS: "#221c12", bootL: "#5a4a30",
      wood: "#96602e", woodL: "#b87c3e", woodS: "#5e3a1a", iron: "#c2cad8", ironS: "#7c8494",
      blush: "#e89072", eye: "#241a2e", white: "#f4f7ff", fur: "#cfd8e4", furS: "#98a8bc"
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

  function drawLeg(g, pal, leg, back) {
    var pants = back ? pal.tunicS : pal.tunic;
    limb(g, leg.hip, -6, leg.knee[0], leg.knee[1], 2, pants);
    limb(g, leg.knee[0], leg.knee[1], leg.foot[0], leg.foot[1], 2, pants);
    if (!back) limb(g, leg.hip, -6, leg.knee[0], leg.knee[1], 1, pal.tunicL);
    rr(g, leg.knee[0], leg.knee[1], 2, 1, back ? pal.tunicS : pal.tunicL);
    var bx = leg.foot[0] - 1, by = leg.foot[1] - 1;
    rr(g, bx, by, 3, 2, back ? pal.bootS : pal.boot);
    rr(g, bx, by, 3, 1, back ? pal.bootS : pal.bootL);
    if (!back) rr(g, bx + 2, by + 1, 1, 1, pal.bootS);
  }

  function drawArm(g, pal, arm, back, up) {
    var sleeve = back ? pal.tunicS : pal.tunic;
    limb(g, arm.sh, -13, arm.el[0], arm.el[1], 2, sleeve);
    limb(g, arm.el[0], arm.el[1], arm.hand[0], arm.hand[1], 2, sleeve);
    if (!back) {
      limb(g, arm.sh, -13, arm.el[0], arm.el[1], 1, pal.tunicL);
      rr(g, arm.el[0] - 1, arm.el[1] + 1, 3, 1, pal.leather);
    }
    var hx2 = arm.hand[0] - 1, hy2 = arm.hand[1] - 1;
    rr(g, hx2, hy2, 2, 2, pal.skin);
    rr(g, hx2, hy2, 2, 1, shade(pal.skin, 1.06));
    if (up) rr(g, hx2, hy2 + 1, 2, 1, pal.skinS);
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

  function drawErik(g, pal, pose, st, f, t) {
    var by = -pose.bob, lean = pose.lean;
    drawLeg(g, pal, pose.legs[0], true);
    drawLeg(g, pal, pose.legs[1], false);
    drawArm(g, pal, pose.arms[0], true);
    rr(g, -3 + lean, -14 + by, 6, 8, pal.tunic);
    rr(g, -3 + lean, -14 + by, 6, 1, pal.tunicL);
    rr(g, -3 + lean, -13 + by, 1, 7, pal.tunicS);
    rr(g, 1 + lean, -12 + by, 2, 1, pal.tunicL);
    rr(g, -3 + lean, -9 + by, 6, 1, pal.leather);
    rr(g, -1 + lean, -9 + by, 2, 1, pal.gold);
    rr(g, -2 + lean, -12 + by, 1, 3, pal.leather);
    if (st === "act") {
      rr(g, -6 + lean, -12 + by, 2, 1, pal.tunicS);
      rr(g, -7 + lean, -10 + by, 2, 1, pal.tunicS);
    }
    drawArm(g, pal, pose.arms[1], false);
    var hX = lean * 2, hy = by;
    rr(g, -4 + hX, -19 + hy, 1, 4, pal.hairS);
    rr(g, -5 + hX, -17 + hy, 1, 2, pal.hair);
    rr(g, -4 + hX, -20 + hy, 2, 2, pal.cream);
    rr(g, -5 + hX, -22 + hy, 2, 2, pal.cream);
    rr(g, -6 + hX, -24 + hy, 1, 2, pal.creamL);
    rr(g, 3 + hX, -20 + hy, 2, 2, pal.cream);
    rr(g, 4 + hX, -22 + hy, 2, 2, pal.cream);
    rr(g, 5 + hX, -24 + hy, 1, 2, pal.creamL);
    rr(g, -2 + hX, -23 + hy, 4, 1, pal.metalL);
    rr(g, -3 + hX, -22 + hy, 6, 2, pal.metal);
    rr(g, -3 + hX, -20 + hy, 6, 1, pal.metalS);
    rr(g, -3 + hX, -19 + hy, 6, 1, pal.metalD);
    rr(g, -2 + hX, -21 + hy, 1, 1, pal.gold);
    rr(g, 2 + hX, -21 + hy, 1, 1, pal.gold);
    rr(g, -2 + hX, -18 + hy, 5, 4, pal.skin);
    rr(g, -2 + hX, -18 + hy, 5, 1, pal.skinS);
    rr(g, 1 + hX, -17 + hy, 1, 1, pal.white);
    rr(g, 2 + hX, -17 + hy, 1, 1, pal.eye);
    rr(g, 1 + hX, -18 + hy, 2, 1, pal.hairS);
    rr(g, 3 + hX, -16 + hy, 1, 2, pal.skinS);
    rr(g, 3 + hX, -15 + hy, 1, 1, pal.skin);
    rr(g, -2 + hX, -15 + hy, 4, 2, pal.hair);
    rr(g, -1 + hX, -13 + hy, 3, 1, pal.hair);
    rr(g, 1 + hX, -15 + hy, 2, 1, pal.hairL);
    rr(g, 1 + hX, -14 + hy, 1, 1, "#6a2c10");
    rr(g, -3 + hX, -18 + hy, 1, 4, pal.hairS);
    if (st === "act") {
      rr(g, -9 + hX, -22 + hy, 2, 1, pal.goldL);
      rr(g, -10 + hX, -20 + hy, 2, 1, pal.gold);
      rr(g, -8 + hX, -24 + hy, 1, 1, pal.white);
    }
  }

  function drawBowOnBack(g, pal) {
    limb(g, -5, -17, -4, -10, 1, pal.bowS);
    limb(g, -4, -10, -5, -6, 1, pal.bowS);
    limb(g, -5, -17, -5, -6, 1, pal.string);
  }
  function drawSword(g, pal, hX, hy) {
    rr(g, hX, hy - 8, 1, 8, pal.blade);
    rr(g, hX, hy - 9, 1, 1, pal.bladeS);
    rr(g, hX + 1, hy - 7, 1, 5, pal.bladeS);
    rr(g, hX - 1, hy - 1, 3, 1, pal.gold);
    rr(g, hX, hy, 1, 1, pal.leather);
    rr(g, hX - 1, hy - 2, 3, 1, pal.goldL);
  }
  function drawBow(g, pal, hX, hy) {
    limb(g, hX + 1, hy - 7, hX + 2, hy - 4, 1, pal.bowL);
    limb(g, hX + 2, hy - 4, hX + 2, hy + 4, 1, pal.bow);
    limb(g, hX + 2, hy + 4, hX + 1, hy + 7, 1, pal.bowL);
    limb(g, hX, hy - 6, hX, hy + 6, 1, pal.string);
    rr(g, hX, hy, 2, 1, pal.blade);
  }

  function drawBaleog(g, pal, pose, st, f, t) {
    var by = -pose.bob, lean = pose.lean;
    drawLeg(g, pal, pose.legs[0], true);
    drawLeg(g, pal, pose.legs[1], false);
    drawArm(g, pal, pose.arms[0], true);
    if (st !== "act") drawBowOnBack(g, pal);
    rr(g, -3, -15 + by, 6, 9, pal.tunic);
    rr(g, -3, -15 + by, 6, 1, pal.tunicL);
    rr(g, -3, -14 + by, 1, 8, pal.tunicS);
    rr(g, 1, -14 + by, 2, 1, pal.tunicL);
    rr(g, -2, -13 + by, 1, 2, pal.leather);
    rr(g, -1, -11 + by, 1, 2, pal.leather);
    rr(g, 0, -9 + by, 1, 2, pal.leather);
    rr(g, -3, -8 + by, 6, 1, pal.leather);
    rr(g, 1, -8 + by, 1, 1, pal.gold);
    rr(g, -4, -15 + by, 2, 2, pal.leather);
    rr(g, 3, -15 + by, 2, 2, pal.leather);
    rr(g, -4, -15 + by, 2, 1, pal.leatherL);
    rr(g, 3, -15 + by, 2, 1, pal.leatherL);
    drawArm(g, pal, pose.arms[1], false);
    if (st !== "act") drawSword(g, pal, pose.arms[1].hand[0] - 1, pose.arms[1].hand[1] + by);
    if (st === "act") drawBow(g, pal, pose.arms[1].hand[0], pose.arms[1].hand[1] + by);
    var hX = lean * 2, hy = by;
    rr(g, -3 + hX, -19 + hy, 1, 2, pal.hairS);
    rr(g, -2 + hX, -23 + hy, 4, 1, pal.metalL);
    rr(g, -3 + hX, -22 + hy, 6, 2, pal.metal);
    rr(g, -3 + hX, -20 + hy, 6, 1, pal.metalS);
    rr(g, -3 + hX, -19 + hy, 6, 1, pal.gold);
    rr(g, -3 + hX, -18 + hy, 6, 1, pal.metalD);
    rr(g, 1 + hX, -19 + hy, 1, 3, pal.metalS);
    rr(g, -2 + hX, -18 + hy, 4, 3, pal.skin);
    rr(g, 1 + hX, -17 + hy, 1, 1, pal.white);
    rr(g, 2 + hX, -17 + hy, 1, 1, pal.eye);
    rr(g, 1 + hX, -18 + hy, 2, 1, pal.hairS);
    rr(g, 2 + hX, -16 + hy, 1, 1, pal.skinS);
    rr(g, -3 + hX, -16 + hy, 6, 2, pal.hair);
    rr(g, -2 + hX, -14 + hy, 5, 2, pal.hair);
    rr(g, -1 + hX, -12 + hy, 3, 1, pal.hair);
    rr(g, -1 + hX, -16 + hy, 3, 1, pal.hairL);
    rr(g, 1 + hX, -15 + hy, 1, 1, "#3a1e08");
    rr(g, 2 + hX, -14 + hy, 1, 2, pal.hairS);
    rr(g, 2 + hX, -12 + hy, 1, 1, pal.gold);
    rr(g, -3 + hX, -16 + hy, 1, 2, pal.hairS);
    if (st === "act") rr(g, 4 + hX, -15 + hy, 2, 1, pal.goldL);
  }

  function drawOlafShieldOverhead(g, pal, by) {
    var y = -30;
    rr(g, -10, y, 20, 1, pal.woodL);
    rr(g, -10, y + 1, 20, 2, pal.wood);
    rr(g, -10, y + 3, 20, 1, pal.woodS);
    rr(g, -10, y, 2, 4, pal.iron);
    rr(g, 8, y, 2, 4, pal.iron);
    rr(g, -10, y, 2, 1, shade(pal.iron, 1.25));
    rr(g, 8, y, 2, 1, shade(pal.iron, 1.25));
    rr(g, -10, y + 3, 2, 1, pal.ironS);
    rr(g, 8, y + 3, 2, 1, pal.ironS);
    rr(g, -6, y + 1, 1, 2, pal.woodS);
    rr(g, -2, y + 1, 1, 2, pal.woodS);
    rr(g, 2, y + 1, 1, 2, pal.woodS);
    rr(g, 6, y + 1, 1, 2, pal.woodS);
    rr(g, -2, y + 1, 4, 2, pal.iron);
    rr(g, -1, y + 1, 2, 1, pal.ironS);
    rr(g, -6, y + 4, 2, 2, pal.leather);
    rr(g, 4, y + 4, 2, 2, pal.leather);
    rr(g, -8, y + 2, 1, 1, pal.gold);
    rr(g, 7, y + 2, 1, 1, pal.gold);
  }
  function drawOlafShield(g, pal) {
    var sx = 4, sy = -10;
    fillCircle(g, sx, sy, 5, pal.ironS);
    fillCircle(g, sx, sy, 4, pal.wood);
    rr(g, sx - 4, sy - 1, 8, 1, pal.woodL);
    rr(g, sx - 4, sy + 1, 8, 1, pal.woodS);
    fillCircle(g, sx, sy, 2, pal.iron);
    rr(g, sx - 1, sy - 1, 2, 1, pal.ironS);
    rr(g, sx - 4, sy - 3, 1, 1, pal.gold);
    rr(g, sx + 3, sy + 2, 1, 1, pal.gold);
  }

  function drawOlaf(g, pal, pose, st, f, t) {
    var by = -pose.bob, lean = pose.lean;
    drawLeg(g, pal, pose.legs[0], true);
    drawLeg(g, pal, pose.legs[1], false);
    drawArm(g, pal, pose.arms[0], true, st === "brace");
    rr(g, -4, -15 + by, 8, 10, pal.tunic);
    rr(g, -4, -15 + by, 8, 1, pal.tunicL);
    rr(g, -4, -14 + by, 1, 9, pal.tunicS);
    rr(g, -3, -11 + by, 6, 2, pal.tunicL);
    rr(g, -3, -10 + by, 6, 1, shade(pal.tunic, 1.12));
    rr(g, -4, -8 + by, 8, 1, pal.leather);
    rr(g, -1, -8 + by, 2, 1, pal.gold);
    rr(g, -4, -15 + by, 8, 1, pal.fur);
    rr(g, -3, -16 + by, 6, 1, pal.furS);
    drawArm(g, pal, pose.arms[1], false, st === "brace");
    var hX = lean * 2, hy = by;
    rr(g, -2 + hX, -23 + hy, 4, 1, pal.metalL);
    rr(g, -4 + hX, -22 + hy, 8, 2, pal.metalS);
    rr(g, -4 + hX, -20 + hy, 8, 1, pal.metal);
    rr(g, -4 + hX, -19 + hy, 8, 1, pal.metalD);
    rr(g, -3 + hX, -22 + hy, 1, 1, pal.gold);
    rr(g, 2 + hX, -22 + hy, 1, 1, pal.gold);
    rr(g, 0 + hX, -19 + hy, 1, 1, pal.metalD);
    rr(g, -3 + hX, -18 + hy, 7, 5, pal.skin);
    rr(g, -3 + hX, -18 + hy, 7, 1, pal.skinS);
    rr(g, -2 + hX, -17 + hy, 1, 1, pal.white);
    rr(g, -2 + hX, -16 + hy, 2, 1, pal.eye);
    rr(g, 2 + hX, -17 + hy, 1, 1, pal.white);
    rr(g, 2 + hX, -16 + hy, 2, 1, pal.eye);
    rr(g, -3 + hX, -17 + hy, 1, 1, pal.hairS);
    rr(g, 3 + hX, -17 + hy, 1, 1, pal.hairS);
    rr(g, 0 + hX, -16 + hy, 2, 2, pal.skinS);
    rr(g, -3 + hX, -14 + hy, 1, 1, pal.blush);
    rr(g, 3 + hX, -14 + hy, 1, 1, pal.blush);
    rr(g, -4 + hX, -14 + hy, 9, 3, pal.hair);
    rr(g, -3 + hX, -11 + hy, 7, 2, pal.hair);
    rr(g, -2 + hX, -9 + hy, 5, 1, pal.hairS);
    rr(g, -1 + hX, -14 + hy, 4, 1, pal.hairL);
    rr(g, -1 + hX, -13 + hy, 2, 1, "#b08a5a");
    if (st === "brace" || st === "act") drawOlafShieldOverhead(g, pal, by);
    else drawOlafShield(g, pal);
  }

  function drawDeadViking(g, pal, id) {
    rr(g, -7, -6, 12, 5, pal.tunicS);
    rr(g, -7, -6, 12, 1, pal.tunic);
    rr(g, -8, -3, 3, 3, pal.boot);
    rr(g, -8, -3, 3, 1, pal.bootL);
    if (id === "erik") {
      rr(g, -1, -9, 7, 4, pal.skin);
      rr(g, 3, -12, 6, 3, pal.metal);
      rr(g, 3, -12, 6, 1, pal.metalL);
      rr(g, 8, -12, 2, 2, pal.cream);
      rr(g, 2, -13, 2, 2, pal.cream);
      rr(g, 4, -10, 5, 1, pal.metalD);
      rr(g, 0, -7, 7, 2, pal.hair);
      rr(g, 3, -5, 1, 1, pal.eye);
      rr(g, 5, -5, 1, 1, pal.eye);
    } else if (id === "baleog") {
      rr(g, -1, -9, 7, 4, pal.skin);
      rr(g, 2, -11, 6, 2, pal.metal);
      rr(g, 2, -10, 6, 1, pal.gold);
      rr(g, 1, -8, 6, 2, pal.hair);
      rr(g, 4, -5, 1, 1, pal.eye);
      rr(g, 6, -5, 1, 1, pal.eye);
      rr(g, -7, -12, 1, 5, pal.bow);
      rr(g, -6, -6, 1, 1, pal.blade);
    } else {
      rr(g, -1, -10, 8, 5, pal.skin);
      rr(g, 1, -12, 7, 3, pal.metalS);
      rr(g, 1, -11, 7, 1, pal.metalD);
      rr(g, 0, -7, 8, 2, pal.hair);
      rr(g, 4, -6, 1, 1, pal.eye);
      rr(g, 6, -6, 1, 1, pal.eye);
      rr(g, -8, -8, 1, 1, pal.skin);
    }
    rr(g, -2, -14, 1, 1, "rgba(220,230,255,0.45)");
    rr(g, -4, -16, 1, 1, "rgba(220,230,255,0.3)");
  }

  function frameFor(st, anim) {
    anim = anim || 0;
    if (st === "run") return Math.floor(anim * 7.5) % 4;
    if (st === "idle") return Math.floor(anim * 2.2) % 2;
    if (st === "jump" || st === "fall") return Math.floor(anim * 4) % 2;
    return Math.floor(anim * 6) % 3;
  }

  function mapState(a) {
    var s = a.state || "idle";
    if (a.id === "olaf" && a.shieldUp) return "brace";
    if (s === "run" || s === "walk") return "run";
    if (s === "shoot" || s === "attack" || s === "act" || s === "push" || s === "pull") return "act";
    if (s === "jump") return "jump";
    if (s === "fall" || s === "climb") return "fall";
    return "idle";
  }

  function normId(id) { return (id === "erik" || id === "baleog" || id === "olaf") ? id : "erik"; }

  function drawChar(g, id, st, anim, t, active) {
    id = normId(id);
    var pal = active ? CHARS[id] : dimPal(id);
    var f = frameFor(st, anim);
    var pose = pickPose(st, f);
    if (id === "olaf") {
      pose.legs[0].hip = -3; pose.legs[1].hip = 3;
      pose.arms[0].sh = -4; pose.arms[1].sh = 4;
      if (st === "idle" || st === "run") {
        pose.arms[0].el[0] = -4; pose.arms[0].hand[0] = -4;
        pose.arms[1].el[0] = 5; pose.arms[1].hand[0] = 5;
      }
    }
    if (id === "erik") drawErik(g, pal, pose, st, f, t);
    else if (id === "baleog") drawBaleog(g, pal, pose, st, f, t);
    else drawOlaf(g, pal, pose, st, f, t);
  }

  function drawDead(g, id, active) {
    id = normId(id);
    drawDeadViking(g, active ? CHARS[id] : dimPal(id), id);
  }

  window.LVVIK = { drawChar: drawChar, drawDead: drawDead, mapState: mapState, CHARS: CHARS };
})();
