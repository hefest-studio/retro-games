/* ============================================================================
 * LOST VIKINGS — MODERN RENDERER  (window.LV_MODERN)
 * "nordic neon": deep gradients, aurora veils, glass tiles, soft bloom.
 * Draws the whole 384x240 world scaled 3x into a 1152x720 canvas.
 * No game logic, no view mutation, no external assets. ES2019, IIFE.
 * ========================================================================== */
(function () {
  "use strict";

  var W = 384, H = 240, TAU = Math.PI * 2;
  var TW = 24, TH = 15, TILE = 16;
  var AUR_W = 768;
  var EMPTY = [];

  /* ------------------------------------------------------------------ math */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function mod(a, b) { return ((a % b) + b) % b; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); }
  function hash2(a, b) { return hash(a * 3.17 + b * 17.71); }

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    var c = hexToRgb(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")";
  }
  function makeCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  /* ---------------------------------------------------------------- palettes */
  var PAL = {
    cave: {
      bgTop: "#03070d", bgMid: "#07131c", bgBot: "#0a2028", glowSoft: "#1e7f7a",
      rock: "#0d1922", rockTop: "#18303a", rockEdge: "#5fe8d2", rockEdgeDim: "#2c7f7a",
      brick: "#2d2a25", brickEdge: "#7e7466",
      platform: "#0e2430", platformEdge: "#86f0dc", spike: "#ff6f9c",
      accent: "#4fe6cf", accent2: "#8a7dff", particle: "#a8f7e8", particle2: "#7f9cff",
      fog: "#123a44", silhouette: "#041018", portal: "#5df0e0", star: "#cfe8ef",
      ambient: "dust", aurora: null
    },
    forge: {
      bgTop: "#0d0506", bgMid: "#1b0908", bgBot: "#2a0f0a", glowSoft: "#c24a1e",
      rock: "#1e1210", rockTop: "#2f1b15", rockEdge: "#ff9a5a", rockEdgeDim: "#8a4a2a",
      brick: "#31221a", brickEdge: "#a06a48",
      platform: "#241410", platformEdge: "#ffb066", spike: "#ff4d3d",
      accent: "#ff8a3d", accent2: "#ffd27a", particle: "#ffb066", particle2: "#ff5a2a",
      fog: "#3a1a12", silhouette: "#160a08", portal: "#ffb066", star: "#ffd9b0",
      ambient: "ember", aurora: { colors: ["#ff6a2a", "#ffb347"], base: 120, alpha: 0.16, strength: 0.55 }
    },
    ice: {
      bgTop: "#02060f", bgMid: "#061426", bgBot: "#0a2036", glowSoft: "#2a7fb0",
      rock: "#0e2133", rockTop: "#16344a", rockEdge: "#a8ecff", rockEdgeDim: "#4d8aa8",
      brick: "#20303f", brickEdge: "#9fc4d8",
      platform: "#0f2a3d", platformEdge: "#d6f6ff", spike: "#8fe4ff",
      accent: "#7fdcff", accent2: "#c9a7ff", particle: "#e8fbff", particle2: "#9fd8ff",
      fog: "#1a4a63", silhouette: "#071522", portal: "#8fe8ff", star: "#eaf7ff",
      ambient: "snow", aurora: { colors: ["#5ff0d0", "#7f9cff", "#c9a7ff"], base: 28, alpha: 0.62, strength: 1 }
    },
    forest: {
      bgTop: "#040b08", bgMid: "#081710", bgBot: "#0c2418", glowSoft: "#1f7a55",
      rock: "#0e1f18", rockTop: "#17352a", rockEdge: "#7bffb0", rockEdgeDim: "#2f7a55",
      brick: "#2a2a22", brickEdge: "#8f8a64",
      platform: "#102a1f", platformEdge: "#9dffb8", spike: "#ff7a9c",
      accent: "#57e6a0", accent2: "#c9a7ff", particle: "#b9ffcf", particle2: "#d9b8ff",
      fog: "#123a2a", silhouette: "#05120c", portal: "#7bffb0", star: "#d8ffe8",
      ambient: "firefly", aurora: { colors: ["#3fe6a0", "#8a7dff"], base: 110, alpha: 0.24, strength: 0.7 }
    },
    castle: {
      bgTop: "#060410", bgMid: "#0d0a1e", bgBot: "#171030", glowSoft: "#4b3a8a",
      rock: "#161528", rockTop: "#241f3a", rockEdge: "#c2b0ff", rockEdgeDim: "#5f5190",
      brick: "#262330", brickEdge: "#9a8fb0",
      platform: "#1a1730", platformEdge: "#cbb6ff", spike: "#ff7a9c",
      accent: "#b58cff", accent2: "#ffd27a", particle: "#d9c9ff", particle2: "#ffd27a",
      fog: "#241b45", silhouette: "#0a0817", portal: "#c2b0ff", star: "#f0e8ff",
      ambient: "ash", aurora: { colors: ["#7a5cff", "#b58cff"], base: 40, alpha: 0.30, strength: 0.8 }
    },
    void: {
      bgTop: "#04020b", bgMid: "#0d0420", bgBot: "#1a0733", glowSoft: "#6a2a9a",
      rock: "#1a0e2a", rockTop: "#2a1440", rockEdge: "#ff7ae0", rockEdgeDim: "#8a3aa8",
      brick: "#2a2028", brickEdge: "#a06a86",
      platform: "#1e0f30", platformEdge: "#d98aff", spike: "#ff3d8a",
      accent: "#ff5ad9", accent2: "#5df0ff", particle: "#f0b8ff", particle2: "#5df0ff",
      fog: "#2a1045", silhouette: "#0a0418", portal: "#ff7ae0", star: "#f4e9ff",
      ambient: "void", aurora: { colors: ["#ff4fd0", "#5df0ff", "#8a5cff"], base: 30, alpha: 0.55, strength: 1 }
    }
  };

  function pal(theme) { return PAL[theme] || PAL.cave; }

  /* ------------------------------------------------------- character colours */
  var CHAR = {
    erik: {
      accent: "#ff8a4d", accent2: "#ffc078", glow: "#ff7a3d", cloth: "#2a1517",
      cloth2: "#7a2a22", cloak: "#8c3527", cloak2: "#d8543a", fur: "#3a2a28",
      metal: "#c8d4e4", metalDark: "#5a6a80", skin: "#e8b48a", beard: "#d86a32",
      eye: "#ffe6b0", rune: 0
    },
    baleog: {
      accent: "#5af0a8", accent2: "#b6ffd0", glow: "#3ff0a0", cloth: "#1d4a36",
      cloth2: "#2a6b4e", cloak: "#16382c", cloak2: "#1f5a42", fur: "#3a3426",
      metal: "#aabccc", metalDark: "#4a5a68", skin: "#d8a878", beard: "#8a5a34",
      eye: "#ccffd8", rune: 1
    },
    olaf: {
      accent: "#6fc0ff", accent2: "#bfe6ff", glow: "#4aa8ff", cloth: "#24405e",
      cloth2: "#2f5a80", cloak: "#1a2c42", cloak2: "#24405e", fur: "#c8d4e0",
      metal: "#b8c8da", metalDark: "#56687c", skin: "#e0b088", beard: "#b8c4d4",
      eye: "#d8ecff", rune: 3
    }
  };
  function charPal(id) { return CHAR[id] || CHAR.erik; }

  var GROUP_COL = { a: "#4fe6cf", b: "#a97cff", c: "#ffb347", d: "#ff6f9c" };
  function groupCol(g) { return GROUP_COL[g] || GROUP_COL.a; }

  /* ------------------------------------------------------------ renderer state */
  var G = {
    canvas: null, ctx: null, sx: 3, sy: 3,
    sky: {}, aurora: {}, fog: {}, glowColor: {},
    terrain: null, world: null, vignette: null, seeds: null,
    title: null, titleKey: 0, titleAurora: null, deadEnemies: {}, portalFrames: null
  };

  /* ------------------------------------------------------------------ glows */
  function glowSprite(color) {
    var s = G.glowColor[color];
    if (s) return s;
    var size = 128, cv = makeCanvas(size, size), x = cv.getContext("2d");
    var g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, rgba(color, 0.9));
    g.addColorStop(0.28, rgba(color, 0.42));
    g.addColorStop(0.62, rgba(color, 0.1));
    g.addColorStop(1, rgba(color, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    G.glowColor[color] = cv;
    return cv;
  }
  /* additive soft dot; caller keeps composite mode */
  function glow(x, cx, cy, r, color, alpha) {
    x.globalAlpha = alpha;
    x.drawImage(glowSprite(color), cx - r, cy - r, r * 2, r * 2);
  }

  /* ------------------------------------------------------------------ runes */
  var RUNES = [
    [[0.5, 0.04, 0.5, 0.96], [0.5, 0.18, 0.16, 0.44], [0.5, 0.18, 0.84, 0.44]],
    [[0.5, 0.04, 0.5, 0.96], [0.5, 0.26, 0.16, 0.56], [0.5, 0.26, 0.84, 0.56]],
    [[0.32, 0.04, 0.32, 0.96], [0.32, 0.2, 0.8, 0.38], [0.32, 0.42, 0.76, 0.6]],
    [[0.5, 0.06, 0.18, 0.42], [0.18, 0.42, 0.5, 0.78], [0.5, 0.78, 0.82, 0.42],
     [0.82, 0.42, 0.5, 0.06], [0.34, 0.62, 0.5, 0.96], [0.66, 0.62, 0.5, 0.96]],
    [[0.5, 0.06, 0.5, 0.94]],
    [[0.72, 0.06, 0.3, 0.44], [0.3, 0.44, 0.7, 0.56], [0.7, 0.56, 0.28, 0.94]]
  ];
  function strokeRune(x, type, cx, cy, s, rot) {
    var segs = RUNES[mod(type | 0, RUNES.length)];
    if (!segs) return;
    x.save();
    x.translate(cx, cy);
    if (rot) x.rotate(rot);
    x.beginPath();
    for (var i = 0; i < segs.length; i++) {
      var q = segs[i];
      x.moveTo((q[0] - 0.5) * s, (q[1] - 0.5) * s);
      x.lineTo((q[2] - 0.5) * s, (q[3] - 0.5) * s);
    }
    x.stroke();
    x.restore();
  }

  /* ------------------------------------------------------------- tiny helpers */
  function blob(x, cx, cy, r, color, alpha) {
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(0.5, rgba(color, alpha * 0.45));
    g.addColorStop(1, rgba(color, 0));
    x.fillStyle = g;
    x.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  function ridge(x, pts, color, alpha) {
    x.globalAlpha = alpha;
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
    x.closePath();
    x.fill();
    x.globalAlpha = 1;
  }
  function stars(x, count, maxY, color, seed) {
    for (var i = 0; i < count; i++) {
      var sx = hash2(i + seed, 3.3) * W;
      var sy = hash2(i + seed, 7.7) * maxY;
      var r = 0.22 + hash2(i + seed, 11.1) * 0.8;
      x.globalAlpha = 0.2 + hash2(i + seed, 13.7) * 0.72;
      x.fillStyle = color;
      x.beginPath();
      x.arc(sx, sy, r, 0, TAU);
      x.fill();
      if (r > 0.8) {
        x.globalAlpha *= 0.4;
        x.fillRect(sx - r * 3.2, sy - 0.22, r * 6.4, 0.44);
        x.fillRect(sx - 0.22, sy - r * 3.2, 0.44, r * 6.4);
      }
    }
    x.globalAlpha = 1;
  }
  function pine(x, cx, baseY, h, color, alpha) {
    var w = h * 0.5, top = baseY - h;
    x.globalAlpha = alpha;
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(cx, top);
    x.lineTo(cx + w * 0.3, baseY - h * 0.64);
    x.lineTo(cx + w * 0.12, baseY - h * 0.64);
    x.lineTo(cx + w * 0.46, baseY - h * 0.3);
    x.lineTo(cx + w * 0.18, baseY - h * 0.3);
    x.lineTo(cx + w * 0.58, baseY);
    x.lineTo(cx - w * 0.58, baseY);
    x.lineTo(cx - w * 0.18, baseY - h * 0.3);
    x.lineTo(cx - w * 0.46, baseY - h * 0.3);
    x.lineTo(cx - w * 0.12, baseY - h * 0.64);
    x.lineTo(cx - w * 0.3, baseY - h * 0.64);
    x.closePath();
    x.fill();
    x.globalAlpha = 1;
  }
  function spireShape(x, cx, baseY, w, h, color, alpha, seed) {
    x.globalAlpha = alpha;
    x.fillStyle = color;
    x.beginPath();
    x.moveTo(cx - w * 0.5, baseY);
    x.lineTo(cx - w * 0.22 + (hash(seed) - 0.5) * w * 0.2, baseY - h * 0.5);
    x.lineTo(cx + (hash(seed + 3) - 0.5) * w * 0.25, baseY - h);
    x.lineTo(cx + w * 0.26 + (hash(seed + 5) - 0.5) * w * 0.18, baseY - h * 0.46);
    x.lineTo(cx + w * 0.5, baseY);
    x.closePath();
    x.fill();
    x.globalAlpha = 1;
  }
  function bottomShade(x, from, to, alpha) {
    var g = x.createLinearGradient(0, from, 0, to);
    g.addColorStop(0, "rgba(2,4,9,0)");
    g.addColorStop(1, "rgba(2,4,9," + alpha + ")");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }
  function topShade(x, from, to, alpha) {
    var g = x.createLinearGradient(0, from, 0, to);
    g.addColorStop(0, "rgba(1,2,6," + alpha + ")");
    g.addColorStop(1, "rgba(1,2,6,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
  }

  /* ================================================================ SKY ART */

  function skyCave(x, p) {
    blob(x, 300, 138, 120, p.glowSoft, 0.34);
    blob(x, 66, 200, 88, p.accent2, 0.10);
    blob(x, 190, 110, 46, p.accent, 0.22);

    /* light shafts from the ceiling */
    x.globalCompositeOperation = "lighter";
    for (var s = 0; s < 3; s++) {
      var sx = 90 + s * 105, wTop = 5 + s * 3, wBot = 42 + s * 14, len = 150 + s * 20;
      var g = x.createLinearGradient(0, 0, 0, len);
      g.addColorStop(0, rgba(p.accent, 0.10));
      g.addColorStop(1, rgba(p.accent, 0));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(sx - wTop, 0); x.lineTo(sx + wTop, 0);
      x.lineTo(sx + wBot, len); x.lineTo(sx - wBot, len);
      x.closePath(); x.fill();
    }
    x.globalCompositeOperation = "source-over";

    /* cavern ceiling */
    x.fillStyle = p.silhouette;
    x.beginPath();
    x.moveTo(0, 0); x.lineTo(W, 0); x.lineTo(W, 12);
    var n = 16;
    for (var i = n - 1; i >= 0; i--) {
      var px = W * i / n;
      var py = 8 + hash2(i, 4.1) * 26 + (i % 3 === 0 ? 10 : 0);
      x.lineTo(px, py);
    }
    x.lineTo(0, 12);
    x.closePath(); x.fill();
    x.strokeStyle = rgba(p.rockEdge, 0.20);
    x.lineWidth = 0.7; x.stroke();

    /* distant rock columns / spires */
    spireShape(x, 54, H, 40, 132, p.silhouette, 0.92, 2);
    spireShape(x, 340, H, 52, 150, p.silhouette, 0.9, 5);
    spireShape(x, 206, H, 24, 92, "#050f16", 0.75, 9);
    spireShape(x, 288, H, 20, 64, "#050f16", 0.6, 12);

    /* giant distance crystals glowing faintly */
    x.globalCompositeOperation = "lighter";
    x.strokeStyle = rgba(p.accent, 0.30);
    x.lineWidth = 1.1;
    x.beginPath();
    x.moveTo(54, 240); x.lineTo(46, 150); x.lineTo(58, 112); x.lineTo(66, 152); x.lineTo(54, 240);
    x.stroke();
    x.strokeStyle = rgba(p.accent2, 0.22);
    x.beginPath();
    x.moveTo(340, 240); x.lineTo(330, 148); x.lineTo(342, 100); x.lineTo(356, 150); x.lineTo(340, 240);
    x.stroke();
    x.globalCompositeOperation = "source-over";

    /* mushroom cluster, bottom-left */
    for (var m = 0; m < 5; m++) {
      var mx = 18 + m * 9 + hash2(m, 2.2) * 6;
      var mh = 5 + hash2(m, 3.3) * 9;
      x.strokeStyle = "rgba(7,17,21,0.95)";
      x.lineWidth = 1.2;
      x.beginPath(); x.moveTo(mx, 218); x.lineTo(mx, 218 - mh); x.stroke();
      x.fillStyle = rgba(p.accent, 0.5);
      x.beginPath();
      x.arc(mx, 218 - mh, 2.4 + hash2(m, 4.4) * 2.2, Math.PI, TAU);
      x.fill();
      x.globalCompositeOperation = "lighter";
      blob(x, mx, 218 - mh, 9, p.accent, 0.22);
      x.globalCompositeOperation = "source-over";
    }

    /* floating dust motes baked */
    for (var d = 0; d < 40; d++) {
      x.globalAlpha = 0.12 + hash2(d, 8.8) * 0.3;
      x.fillStyle = p.particle;
      x.beginPath();
      x.arc(hash2(d, 5.5) * W, hash2(d, 6.6) * H, 0.3 + hash2(d, 7.7) * 0.7, 0, TAU);
      x.fill();
    }
    x.globalAlpha = 1;

    bottomShade(x, H * 0.72, H, 0.5);
  }

  function skyForge(x, p) {
    /* furnace glow */
    blob(x, W * 0.5, H + 30, 190, "#ff5a1f", 0.55);
    blob(x, W * 0.24, H + 10, 120, "#ff7a2a", 0.4);
    blob(x, W * 0.82, H + 20, 120, "#ffb347", 0.32);

    /* furnace arches */
    for (var a = 0; a < 3; a++) {
      var ax = 46 + a * 146, aw = 44, ah = 62, ay = 150;
      x.fillStyle = p.silhouette;
      x.beginPath();
      x.moveTo(ax - aw / 2, ay + ah);
      x.lineTo(ax - aw / 2, ay + 8);
      x.quadraticCurveTo(ax, ay - 26, ax + aw / 2, ay + 8);
      x.lineTo(ax + aw / 2, ay + ah);
      x.closePath(); x.fill();
      x.globalCompositeOperation = "lighter";
      blob(x, ax, ay + 34, 32, "#ff6a1f", 0.42);
      blob(x, ax, ay + 42, 16, "#ffd27a", 0.5);
      x.globalCompositeOperation = "source-over";
      x.strokeStyle = rgba(p.rockEdge, 0.4);
      x.lineWidth = 1;
      x.strokeRect(ax - aw / 2 + 2, ay + 6, aw - 4, ah - 8);
      /* grate */
      x.strokeStyle = "rgba(8,4,3,0.85)";
      x.lineWidth = 1.4;
      for (var b = 0; b < 4; b++) {
        x.beginPath(); x.moveTo(ax - aw / 2 + 2, ay + 18 + b * 10); x.lineTo(ax + aw / 2 - 2, ay + 18 + b * 10); x.stroke();
      }
    }

    /* pipes */
    x.strokeStyle = p.silhouette;
    x.lineWidth = 5;
    x.beginPath(); x.moveTo(0, 46); x.lineTo(W, 46); x.stroke();
    x.lineWidth = 3;
    x.beginPath(); x.moveTo(0, 64); x.lineTo(260, 64); x.stroke();
    x.beginPath(); x.moveTo(120, 46); x.lineTo(120, 86); x.stroke();
    x.beginPath(); x.moveTo(320, 46); x.lineTo(320, 78); x.stroke();
    x.strokeStyle = rgba(p.rockEdge, 0.28);
    x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(0, 43.4); x.lineTo(W, 43.4); x.stroke();
    x.globalAlpha = 0.3;
    x.fillStyle = p.brickEdge;
    for (var pl = 0; pl < 8; pl++) x.fillRect(pl * 48 + 12, 44.5, 2, 2);
    x.globalAlpha = 1;

    /* chains */
    x.strokeStyle = "rgba(9,5,4,0.9)";
    x.lineWidth = 0.9;
    for (var c = 0; c < 4; c++) {
      var cx = 74 + c * 92;
      x.beginPath(); x.moveTo(cx, 0); x.lineTo(cx, 46 + hash2(c, 1.5) * 18); x.stroke();
      for (var k = 0; k < 5; k++) x.strokeRect(cx - 1, 8 + k * 7, 2, 3.6);
    }

    /* smoke cloudbank up top */
    for (var sm = 0; sm < 8; sm++) {
      blob(x, hash2(sm, 2.3) * W, 20 + hash2(sm, 3.4) * 46, 34 + hash2(sm, 4.5) * 42, "#120605", 0.4);
    }

    /* anvil silhouette */
    x.fillStyle = p.silhouette;
    x.beginPath();
    x.moveTo(292, 208); x.lineTo(342, 208); x.lineTo(334, 198); x.lineTo(348, 194);
    x.lineTo(346, 186); x.lineTo(310, 186); x.lineTo(304, 192); x.lineTo(298, 194);
    x.lineTo(306, 198); x.closePath(); x.fill();
    x.fillRect(310, 208, 14, 10);
    x.strokeStyle = rgba(p.rockEdge, 0.35);
    x.lineWidth = 0.8;
    x.stroke();

    /* lava cracks */
    x.globalCompositeOperation = "lighter";
    x.strokeStyle = rgba("#ff7a2a", 0.4);
    x.lineWidth = 1.1;
    for (var lc = 0; lc < 3; lc++) {
      x.beginPath();
      var lx = 30 + lc * 140;
      x.moveTo(lx, 240);
      x.lineTo(lx + 14, 218); x.lineTo(lx + 4, 206); x.lineTo(lx + 22, 186);
      x.stroke();
    }
    x.globalCompositeOperation = "source-over";
    bottomShade(x, H * 0.66, H, 0.5);
  }

  function skyIce(x, p) {
    stars(x, 90, H * 0.72, p.star, 3);
    blob(x, 84, 58, 54, "#9fe8ff", 0.12);
    x.fillStyle = "#dff8ff"; x.globalAlpha = 0.55;
    x.beginPath(); x.arc(84, 58, 15, 0, TAU); x.fill(); x.globalAlpha = 1;
    x.globalCompositeOperation = "lighter"; blob(x, 84, 58, 46, "#9fe8ff", 0.16); x.globalCompositeOperation = "source-over";

    /* far ridge */
    var pts = [0, 200];
    for (var i = 0; i <= 8; i++) {
      var px = W * i / 8;
      pts.push(px, 132 + hash2(i, 2.2) * 36 - (i % 3 === 0 ? 22 : 0));
    }
    pts.push(W, 200);
    ridge(x, pts, p.silhouette, 0.82);
    x.strokeStyle = rgba("#cdf6ff", 0.18); x.lineWidth = 0.8;
    x.beginPath();
    for (var j = 0; j < 9; j++) {
      var qx = W * j / 8, qy = 132 + hash2(j, 2.2) * 36 - (j % 3 === 0 ? 22 : 0);
      if (j === 0) x.moveTo(qx, qy); else x.lineTo(qx, qy);
    }
    x.stroke();

    /* near ridge */
    var pts2 = [0, 240];
    for (var k = 0; k <= 6; k++) {
      var rx = W * k / 6;
      pts2.push(rx, 186 + hash2(k, 5.5) * 26 - (k % 2 === 0 ? 16 : 0));
    }
    pts2.push(W, 240);
    ridge(x, pts2, "#051120", 0.92);

    /* glacier spires */
    spireShape(x, 22, H, 56, 168, "#071624", 0.95, 4);
    spireShape(x, 64, H, 26, 96, "#081a2a", 0.85, 7);
    spireShape(x, 362, H, 62, 176, "#071624", 0.95, 9);
    spireShape(x, 322, H, 30, 80, "#081a2a", 0.8, 11);
    x.globalCompositeOperation = "lighter";
    x.strokeStyle = rgba(p.rockEdge, 0.24); x.lineWidth = 1;
    x.beginPath(); x.moveTo(24, 240); x.lineTo(14, 120); x.lineTo(28, 74); x.stroke();
    x.beginPath(); x.moveTo(360, 240); x.lineTo(370, 112); x.lineTo(356, 66); x.stroke();
    x.globalCompositeOperation = "source-over";

    /* frozen lake sheen */
    var lg = x.createLinearGradient(0, 214, 0, H);
    lg.addColorStop(0, rgba("#8fe4ff", 0.16));
    lg.addColorStop(1, rgba("#8fe4ff", 0));
    x.fillStyle = lg; x.fillRect(0, 210, W, 30);
    x.strokeStyle = rgba("#cdf6ff", 0.10); x.lineWidth = 0.6;
    for (var w = 0; w < 9; w++) {
      x.beginPath();
      x.moveTo(30 + w * 42, 222 + (w % 2) * 5);
      x.lineTo(60 + w * 42, 220 + (w % 2) * 5);
      x.stroke();
    }
    bottomShade(x, H * 0.8, H, 0.35);
  }

  function skyForest(x, p) {
    /* moon */
    x.globalCompositeOperation = "lighter";
    blob(x, 300, 58, 64, "#cde8ff", 0.16);
    x.globalCompositeOperation = "source-over";
    x.fillStyle = "#dff2ff"; x.globalAlpha = 0.7;
    x.beginPath(); x.arc(300, 58, 19, 0, TAU); x.fill();
    x.globalAlpha = 0.25;
    x.fillStyle = "#9fb8cc";
    x.beginPath(); x.arc(294, 52, 4, 0, TAU); x.arc(306, 64, 3, 0, TAU); x.fill();
    x.globalAlpha = 1;
    /* thin clouds across the moon */
    for (var c = 0; c < 4; c++) {
      x.globalAlpha = 0.18 + hash2(c, 1.3) * 0.14;
      x.fillStyle = "#0a1a16";
      x.beginPath();
      x.ellipse(230 + c * 60, 48 + hash2(c, 2.4) * 22, 52, 4 + hash2(c, 3.5) * 3, 0, 0, TAU);
      x.fill();
    }
    x.globalAlpha = 1;

    /* far pines */
    for (var f = 0; f < 11; f++) {
      var fx = f * 38 + hash2(f, 1.1) * 16;
      pine(x, fx, 196 + hash2(f, 2.2) * 20, 34 + hash2(f, 3.3) * 26, "#0a2218", 0.72);
    }
    /* mid pines */
    for (var m = 0; m < 8; m++) {
      var mx = m * 52 + hash2(m, 4.4) * 22;
      pine(x, mx, 226 + hash2(m, 5.5) * 14, 56 + hash2(m, 6.6) * 34, "#071b12", 0.9);
    }
    /* near pines */
    for (var n = 0; n < 5; n++) {
      var nx2 = 20 + n * 90 + hash2(n, 7.7) * 26;
      pine(x, nx2, 250, 86 + hash2(n, 8.8) * 44, "#04120b", 1);
    }

    /* baked fireflies */
    x.globalCompositeOperation = "lighter";
    for (var ff = 0; ff < 12; ff++) {
      var ffx = hash2(ff, 2.7) * W, ffy = 120 + hash2(ff, 3.8) * 100;
      blob(x, ffx, ffy, 5 + hash2(ff, 4.9) * 5, p.accent, 0.22);
      x.globalAlpha = 0.5;
      x.fillStyle = p.particle;
      x.beginPath(); x.arc(ffx, ffy, 0.7, 0, TAU); x.fill();
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
    bottomShade(x, H * 0.74, H, 0.45);
  }

  function skyCastle(x, p) {
    stars(x, 70, H * 0.55, p.star, 11);
    /* moon */
    x.globalCompositeOperation = "lighter";
    blob(x, 292, 62, 78, "#b9a8ff", 0.18);
    x.globalCompositeOperation = "source-over";
    x.fillStyle = "#efe6ff"; x.globalAlpha = 0.85;
    x.beginPath(); x.arc(292, 62, 23, 0, TAU); x.fill();
    x.globalAlpha = 0.3;
    x.fillStyle = "#b9a8ff";
    x.beginPath(); x.arc(286, 55, 4.5, 0, TAU); x.arc(298, 68, 3.2, 0, TAU); x.arc(295, 51, 2.2, 0, TAU); x.fill();
    x.globalAlpha = 1;
    /* moon rays */
    x.globalCompositeOperation = "lighter";
    for (var r = 0; r < 3; r++) {
      var g = x.createLinearGradient(292, 62, 180 - r * 20, 240);
      g.addColorStop(0, rgba("#cbb6ff", 0.09));
      g.addColorStop(1, rgba("#cbb6ff", 0));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(292 - 14, 70); x.lineTo(292 + 14, 76);
      x.lineTo(150 - r * 40, 240); x.lineTo(60 - r * 30, 240);
      x.closePath(); x.fill();
    }
    x.globalCompositeOperation = "source-over";

    /* distant castle */
    x.fillStyle = p.silhouette;
    function tower(tx, baseY, tw, th) {
      x.fillRect(tx - tw / 2, baseY - th, tw, th);
      x.beginPath();
      x.moveTo(tx - tw / 2 - 2, baseY - th);
      x.lineTo(tx, baseY - th - tw * 0.9);
      x.lineTo(tx + tw / 2 + 2, baseY - th);
      x.closePath(); x.fill();
      for (var w = 0; w < 3; w++) {
        var wx = tx - tw / 2 + 2 + w * (tw / 3);
        x.globalCompositeOperation = "lighter";
        x.fillStyle = rgba(p.accent2, 0.5);
        x.fillRect(wx, baseY - th + 6, 2.2, 4);
        x.globalCompositeOperation = "source-over";
      }
    }
    tower(112, 190, 30, 96);
    tower(156, 194, 22, 70);
    tower(224, 190, 36, 112);
    tower(268, 196, 20, 62);
    x.fillRect(90, 168, 210, 26);
    /* battlements */
    for (var b = 0; b < 16; b++) x.fillRect(92 + b * 13, 160, 7, 9);
    /* windows */
    x.globalCompositeOperation = "lighter";
    for (var w2 = 0; w2 < 9; w2++) {
      var wx2 = 108 + w2 * 23 + hash2(w2, 2.2) * 6, wy2 = 178 + hash2(w2, 3.3) * 10;
      x.fillStyle = rgba(p.accent2, 0.4 + hash2(w2, 4.4) * 0.3);
      x.beginPath();
      x.moveTo(wx2, wy2 - 4); x.lineTo(wx2 + 2.2, wy2 - 1); x.lineTo(wx2 + 2.2, wy2 + 4);
      x.lineTo(wx2 - 2.2, wy2 + 4); x.lineTo(wx2 - 2.2, wy2 - 1);
      x.closePath(); x.fill();
      blob(x, wx2, wy2, 8, p.accent2, 0.18);
    }
    x.globalCompositeOperation = "source-over";

    /* foreground fog bank */
    for (var f = 0; f < 5; f++) {
      blob(x, hash2(f, 7.7) * W, 214 + hash2(f, 8.8) * 22, 46 + hash2(f, 9.9) * 36, p.fog, 0.25);
    }
    bottomShade(x, H * 0.74, H, 0.5);
  }

  function skyVoid(x, p) {
    /* nebula */
    blob(x, 120, 90, 150, "#7a2a9a", 0.4);
    blob(x, 300, 60, 120, "#2a5a9a", 0.3);
    blob(x, 210, 170, 130, "#ff3d8a", 0.16);
    blob(x, 60, 40, 90, "#5df0ff", 0.10);
    stars(x, 120, H * 0.85, p.star, 23);
    /* brighter stars */
    x.globalCompositeOperation = "lighter";
    for (var i = 0; i < 8; i++) {
      var sx = hash2(i, 4.4) * W, sy = hash2(i, 6.6) * H * 0.7;
      blob(x, sx, sy, 6, p.particle2, 0.35);
      x.globalAlpha = 0.9; x.fillStyle = "#fff";
      x.beginPath(); x.arc(sx, sy, 0.9, 0, TAU); x.fill();
    }
    x.globalAlpha = 1;
    /* ringed planet */
    var px = 330, py = 52, pr = 34;
    x.fillStyle = "#0a0518";
    x.beginPath(); x.arc(px, py, pr, 0, TAU); x.fill();
    x.strokeStyle = rgba("#ff7ae0", 0.55); x.lineWidth = 1;
    x.beginPath(); x.arc(px, py, pr, 0.6, 2.4); x.stroke();
    x.strokeStyle = rgba("#5df0ff", 0.3); x.lineWidth = 0.7;
    x.beginPath(); x.ellipse(px, py, pr * 1.9, pr * 0.5, -0.36, 0, TAU); x.stroke();
    x.globalCompositeOperation = "source-over";
    /* floating shards */
    for (var s = 0; s < 7; s++) {
      var sx2 = 40 + hash2(s, 1.2) * 320, sy2 = 96 + hash2(s, 2.3) * 110;
      var sw = 6 + hash2(s, 3.4) * 16, sh = 4 + hash2(s, 4.5) * 9;
      x.fillStyle = "#0b0618";
      x.beginPath();
      x.moveTo(sx2 - sw, sy2); x.lineTo(sx2 - sw * 0.3, sy2 - sh);
      x.lineTo(sx2 + sw, sy2 - sh * 0.2); x.lineTo(sx2 + sw * 0.2, sy2 + sh * 0.7);
      x.closePath(); x.fill();
      x.strokeStyle = rgba(p.accent, 0.28); x.lineWidth = 0.6;
      x.beginPath(); x.moveTo(sx2 - sw * 0.3, sy2 - sh); x.lineTo(sx2 + sw, sy2 - sh * 0.2); x.stroke();
    }
    bottomShade(x, H * 0.72, H, 0.5);
  }

  function buildSky(theme) {
    var p = pal(theme);
    var cv = makeCanvas(W, H), x = cv.getContext("2d");
    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, p.bgTop);
    g.addColorStop(0.55, p.bgMid);
    g.addColorStop(1, p.bgBot);
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);
    blob(x, W * 0.5, H * 0.62, W * 0.78, p.glowSoft, 0.18);

    if (theme === "forge") skyForge(x, p);
    else if (theme === "ice") skyIce(x, p);
    else if (theme === "forest") skyForest(x, p);
    else if (theme === "castle") skyCastle(x, p);
    else if (theme === "void") skyVoid(x, p);
    else skyCave(x, p);

    if (theme === "ice" || theme === "castle" || theme === "void") topShade(x, 0, 90, 0.22);
    return cv;
  }
  function getSky(theme) {
    var s = G.sky[theme];
    if (!s) { s = buildSky(theme); G.sky[theme] = s; }
    return s;
  }

  /* ---------------------------------------------------------------- AURORA */
  function buildAurora(theme) {
    var p = pal(theme);
    if (!p.aurora) return null;
    var cfg = p.aurora;
    var cv = makeCanvas(AUR_W, H), x = cv.getContext("2d");
    x.globalCompositeOperation = "lighter";
    x.lineCap = "round";
    var N = 64;
    for (var r = 0; r < cfg.colors.length; r++) {
      var color = cfg.colors[r];
      var baseY = cfg.base + r * 30 + hash(r + 1) * 18;
      var a1 = 14 + r * 6, a2 = 8 + hash(r + 2) * 10;
      var k1 = 2 + r, k2 = 5 + r * 3;
      var ph1 = hash(r + 4) * TAU, ph2 = hash(r + 5) * TAU;
      var passes = [[30, 0.040], [15, 0.070], [5.5, 0.15], [1.6, 0.36]];
      for (var pi = 0; pi < passes.length; pi++) {
        x.beginPath();
        for (var i = 0; i <= N; i++) {
          var px = i / N * AUR_W;
          var py = baseY + a1 * Math.sin(TAU * k1 * i / N + ph1) + a2 * Math.sin(TAU * k2 * i / N + ph2);
          if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.lineWidth = passes[pi][0];
        x.strokeStyle = rgba(color, passes[pi][1] * cfg.strength);
        x.stroke();
      }
      /* vertical curtains */
      x.lineWidth = 4;
      for (var c = 0; c < N; c += 2) {
        var cx = c / N * AUR_W;
        var cy = baseY + a1 * Math.sin(TAU * k1 * c / N + ph1) + a2 * Math.sin(TAU * k2 * c / N + ph2);
        var len = 34 + hash(c + r * 7) * 46;
        var lg = x.createLinearGradient(0, cy, 0, cy + len);
        lg.addColorStop(0, rgba(color, 0.10));
        lg.addColorStop(1, rgba(color, 0));
        x.strokeStyle = lg;
        x.beginPath();
        x.moveTo(cx, cy);
        x.lineTo(cx + 2, cy + len);
        x.stroke();
      }
    }
    return cv;
  }
  function getAurora(theme) {
    if (!(theme in G.aurora)) G.aurora[theme] = buildAurora(theme);
    return G.aurora[theme];
  }

  /* ------------------------------------------------------------------- FOG */
  function buildFog(theme) {
    var p = pal(theme);
    var cv = makeCanvas(512, 128), x = cv.getContext("2d");
    for (var i = 0; i < 10; i++) {
      var cx = hash2(i, 1.1) * 512, cy = 40 + hash2(i, 2.2) * 70;
      var r = 26 + hash2(i, 3.3) * 48;
      blob(x, cx, cy, r, p.fog, 0.10 + hash2(i, 4.4) * 0.08);
    }
    return cv;
  }
  function getFog(theme) {
    if (!(theme in G.fog)) G.fog[theme] = buildFog(theme);
    return G.fog[theme];
  }

  /* --------------------------------------------------------------- VIGNETTE */
  function getVignette() {
    if (G.vignette) return G.vignette;
    var w = G.canvas.width, h = G.canvas.height;
    var cv = makeCanvas(w, h), x = cv.getContext("2d");
    var g = x.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.16, w / 2, h * 0.5, Math.max(w, h) * 0.72);
    g.addColorStop(0, "rgba(24,6,32,0)");
    g.addColorStop(0.55, "rgba(10,5,20,0.12)");
    g.addColorStop(1, "rgba(2,2,8,0.55)");
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    var g2 = x.createLinearGradient(0, 0, 0, h);
    g2.addColorStop(0, "rgba(1,2,7,0.40)");
    g2.addColorStop(0.22, "rgba(1,2,7,0)");
    g2.addColorStop(0.84, "rgba(1,2,7,0)");
    g2.addColorStop(1, "rgba(1,2,7,0.42)");
    x.fillStyle = g2;
    x.fillRect(0, 0, w, h);
    G.vignette = cv;
    return cv;
  }

  /* =============================================================== TERRAIN */
  function rowChar(row, j) {
    if (!row) return ".";
    if (typeof row === "string") return row.charAt(j) || ".";
    var c = row[j];
    return c === undefined ? "." : c;
  }
  function rowCode(row, j) {
    var c = rowChar(row, j);
    return c.charCodeAt(0);
  }
  function terrainHash(terrain) {
    var h = 0, i, j, r;
    for (i = 0; i < terrain.length; i++) {
      r = terrain[i];
      if (!r) continue;
      for (j = 0; j < r.length; j++) h = (h * 31 + rowCode(r, j)) | 0;
    }
    return h;
  }

  function drawStoneTile(bx, gx, p, tx, ty, px, py, isBrick) {
    var r = hash2(tx * 13 + ty * 7, 2.1);
    var r2 = hash2(tx * 5 + ty * 19, 4.7);
    bx.globalAlpha = 1;
    if (isBrick) {
      /* weathered, cracked brick: warm, visibly breakable */
      bx.fillStyle = p.brick;
      bx.fillRect(px + 0.4, py + 0.4, TILE - 0.8, TILE - 0.8);
      bx.fillStyle = rgba(p.brickEdge, 0.05);
      bx.fillRect(px + 0.6, py + 0.8, TILE - 1.2, 6.2);
      bx.fillStyle = rgba("#000000", 0.24);
      bx.fillRect(px + 0.6, py + 8.2, TILE - 1.2, 6.8);
      /* brick seams */
      bx.strokeStyle = rgba("#000000", 0.62);
      bx.lineWidth = 1.2;
      bx.beginPath();
      bx.moveTo(px, py + 7.6); bx.lineTo(px + TILE, py + 7.6);
      bx.moveTo(px, py + 15.4); bx.lineTo(px + TILE, py + 15.4);
      var seam = r > 0.5 ? 3.6 : 11.6;
      bx.moveTo(px + seam, py + 0.4); bx.lineTo(px + seam, py + 7.6);
      var seam2 = r > 0.5 ? 12 : 4.4;
      bx.moveTo(px + seam2, py + 7.6); bx.lineTo(px + seam2, py + 15.4);
      bx.stroke();
      /* brick face light */
      bx.strokeStyle = rgba(p.brickEdge, 0.16);
      bx.lineWidth = 0.5;
      bx.beginPath();
      bx.moveTo(px + 1, py + 1.1); bx.lineTo(px + TILE - 1, py + 1.1);
      bx.moveTo(px + 1, py + 8.8); bx.lineTo(px + TILE - 1, py + 8.8);
      bx.stroke();
      /* weathered branching cracks */
      bx.strokeStyle = rgba("#0c0907", 0.75);
      bx.lineWidth = 0.7;
      bx.beginPath();
      if (r2 < 0.34) {
        bx.moveTo(px + 3, py + 2.2);
        bx.lineTo(px + 5.6, py + 6);
        bx.lineTo(px + 4.2, py + 9.4);
        bx.lineTo(px + 8.6, py + 13.4);
        bx.moveTo(px + 5.6, py + 6); bx.lineTo(px + 2.4, py + 8.2);
      } else if (r2 < 0.67) {
        bx.moveTo(px + 12.4, py + 1.8);
        bx.lineTo(px + 9.2, py + 5.2);
        bx.lineTo(px + 10.6, py + 8.4);
        bx.lineTo(px + 6.8, py + 10.6);
        bx.lineTo(px + 7.6, py + 14.4);
        bx.moveTo(px + 10.6, py + 8.4); bx.lineTo(px + 13.2, py + 10.2);
      } else {
        bx.moveTo(px + 2.4, py + 12.6);
        bx.lineTo(px + 5.6, py + 9.4);
        bx.lineTo(px + 4.6, py + 6.2);
        bx.lineTo(px + 8.8, py + 3.6);
        bx.moveTo(px + 4.6, py + 6.2); bx.lineTo(px + 2, py + 4.2);
      }
      bx.stroke();
      bx.strokeStyle = rgba(p.brickEdge, 0.22);
      bx.lineWidth = 0.4;
      bx.beginPath();
      bx.moveTo(px + 3.4, py + 2.8);
      bx.lineTo(px + 5.8, py + 6.2);
      bx.stroke();
      /* chipped corner */
      if (r2 > 0.55) {
        bx.fillStyle = "#0a0503";
        bx.beginPath();
        bx.moveTo(px + TILE - 0.6, py + 0.4);
        bx.lineTo(px + TILE - 4.2, py + 0.4);
        bx.lineTo(px + TILE - 0.6, py + 4.4);
        bx.closePath();
        bx.fill();
      }
      /* weathering: mossy spots and chipped mortar */
      if (r2 > 0.62) {
        bx.fillStyle = rgba("#5f8a6a", 0.18);
        bx.beginPath();
        bx.arc(px + 3 + r * 9, py + 12.4, 0.9, 0, TAU);
        bx.fill();
      }
      if (r > 0.72) {
        bx.fillStyle = "rgba(0,0,0,0.5)";
        bx.fillRect(px + 2.2, py + 7.4, 1.6, 1.1);
        bx.fillRect(px + TILE - 3.8, py + 15.2, 1.4, 1);
      }
    } else {
      /* glass stone panel */
      bx.fillStyle = p.rock;
      bx.fillRect(px + 0.4, py + 0.4, TILE - 0.8, TILE - 0.8);
      bx.fillStyle = p.rockTop;
      bx.globalAlpha = 0.30;
      bx.fillRect(px + 0.4, py + 0.4, TILE - 0.8, 2.8);
      bx.fillStyle = "#000";
      bx.globalAlpha = 0.22;
      bx.fillRect(px + 0.4, py + TILE - 4, TILE - 0.8, 3.4);
      bx.globalAlpha = 1;
      /* glass sheen */
      bx.strokeStyle = rgba(p.rockEdge, 0.08);
      bx.lineWidth = 2.2;
      bx.beginPath();
      bx.moveTo(px + 2.2, py + 13.4);
      bx.lineTo(px + 12.4, py + 2.6);
      bx.stroke();
      bx.strokeStyle = rgba(p.rockEdgeDim, 0.20);
      bx.lineWidth = 0.55;
      bx.strokeRect(px + 1.1, py + 1.1, TILE - 2.2, TILE - 2.2);
      if (r > 0.32) {
        bx.fillStyle = rgba(p.rockEdgeDim, 0.5);
        bx.fillRect(px + 3 + r * 7, py + 4 + r * 6, 0.8, 0.8);
        bx.fillRect(px + 10 - r * 4, py + 10 - r * 3, 0.7, 0.7);
      }
      /* faint etched rune on a few blocks */
      if (r > 0.93) {
        bx.strokeStyle = rgba(p.rockEdge, 0.15);
        bx.lineWidth = 0.8;
        strokeRune(bx, ((tx + ty) | 0) % RUNES.length, px + 8, py + 8, 8);
      }
    }
  }

  function drawPlatformTile(bx, gx, p, px, py) {
    bx.globalAlpha = 1;
    bx.fillStyle = p.platform;
    bx.fillRect(px + 0.5, py + 0.5, TILE - 1, 4.6);
    bx.fillStyle = p.platformEdge;
    bx.globalAlpha = 0.2;
    bx.fillRect(px + 0.5, py + 0.5, TILE - 1, 1);
    bx.globalAlpha = 1;
    bx.strokeStyle = rgba(p.platformEdge, 0.45);
    bx.lineWidth = 0.5;
    bx.strokeRect(px + 0.5, py + 0.5, TILE - 1, 4.6);
    bx.fillStyle = p.platformEdge;
    bx.globalAlpha = 0.28;
    bx.fillRect(px + 2, py + 5.2, 0.7, 2.2);
    bx.fillRect(px + TILE - 2.7, py + 5.2, 0.7, 2.2);
    bx.globalAlpha = 1;
    gx.globalCompositeOperation = "lighter";
    gx.shadowColor = p.platformEdge;
    gx.shadowBlur = 10;
    gx.strokeStyle = rgba(p.platformEdge, 0.9);
    gx.lineWidth = 0.8;
    gx.beginPath();
    gx.moveTo(px + 0.5, py + 0.7);
    gx.lineTo(px + TILE - 0.5, py + 0.7);
    gx.stroke();
    gx.shadowBlur = 0;
    gx.globalAlpha = 1;
  }

  function drawSpikeTile(bx, gx, p, px, py) {
    bx.fillStyle = "#04060b";
    bx.fillRect(px, py + 10.6, TILE, 5.4);
    gx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 3; i++) {
      var cx = px + 3.2 + i * 4.8;
      bx.beginPath();
      bx.moveTo(cx - 2.1, py + 15.2);
      bx.lineTo(cx, py + 4.2 + i * 0.5);
      bx.lineTo(cx + 2.1, py + 15.2);
      bx.closePath();
      bx.fillStyle = rgba(p.spike, 0.24);
      bx.fill();
      bx.strokeStyle = rgba(p.spike, 0.9);
      bx.lineWidth = 0.55;
      bx.stroke();
      gx.shadowColor = p.spike;
      gx.shadowBlur = 9;
      gx.strokeStyle = rgba(p.spike, 0.5);
      gx.lineWidth = 1.2;
      gx.beginPath();
      gx.moveTo(cx - 2.1, py + 15.2);
      gx.lineTo(cx, py + 4.2 + i * 0.5);
      gx.lineTo(cx + 2.1, py + 15.2);
      gx.stroke();
      gx.shadowBlur = 0;
    }
    gx.globalAlpha = 1;
  }

  function edgeGlow(gx, color, x1, y1, x2, y2, k) {
    gx.globalCompositeOperation = "lighter";
    gx.lineCap = "round";
    gx.shadowColor = color;
    gx.shadowBlur = 16;
    gx.strokeStyle = rgba(color, 0.45 * k);
    gx.lineWidth = 2.2;
    gx.beginPath(); gx.moveTo(x1, y1); gx.lineTo(x2, y2); gx.stroke();
    gx.shadowBlur = 0;
    gx.strokeStyle = rgba(color, 0.95 * k);
    gx.lineWidth = 0.7;
    gx.beginPath(); gx.moveTo(x1, y1); gx.lineTo(x2, y2); gx.stroke();
  }

  function buildTerrain(theme, terrain, key) {
    var p = pal(theme);
    var pw = Math.round(W * G.sx), ph = Math.round(H * G.sy);
    var base = makeCanvas(pw, ph), bx = base.getContext("2d");
    var glowCv = makeCanvas(pw, ph), gx = glowCv.getContext("2d");
    bx.setTransform(G.sx, 0, 0, G.sy, 0, 0);
    gx.setTransform(G.sx, 0, 0, G.sy, 0, 0);
    bx.lineCap = "round"; bx.lineJoin = "round";
    gx.lineCap = "round"; gx.lineJoin = "round";

    var rows = terrain, rh = rows.length, rw = rows[0] ? rows[0].length : 0;
    function at(tx, ty) {
      if (ty < 0 || ty >= rh || tx < 0 || tx >= rw) return "#";
      return rowChar(rows[ty], tx);
    }
    function solid(c) { return c === "#" || c === "B"; }
    var spikes = [];
    var tx, ty, c, px, py;
    for (ty = 0; ty < rh; ty++) {
      for (tx = 0; tx < rw; tx++) {
        c = at(tx, ty); px = tx * TILE; py = ty * TILE;
        if (c === "#" || c === "B") drawStoneTile(bx, gx, p, tx, ty, px, py, c === "B");
        else if (c === "=") drawPlatformTile(bx, gx, p, px, py);
        else if (c === "^") {
          drawSpikeTile(bx, gx, p, px, py);
          spikes.push(px + 8, py + 9, hash2(tx, ty));
        }
      }
    }
    for (ty = 0; ty < rh; ty++) {
      for (tx = 0; tx < rw; tx++) {
        c = at(tx, ty);
        if (!solid(c)) continue;
        px = tx * TILE; py = ty * TILE;
        var isBr = c === "B";
        var ecol = isBr ? p.brickEdge : p.rockEdge;
        var bk = isBr ? 0.16 : 1;
        if (!solid(at(tx, ty - 1))) edgeGlow(gx, ecol, px + 0.9, py + 0.9, px + TILE - 0.9, py + 0.9, bk);
        if (!solid(at(tx, ty + 1))) edgeGlow(gx, ecol, px + 0.9, py + TILE - 0.9, px + TILE - 0.9, py + TILE - 0.9, 0.35 * bk);
        if (!solid(at(tx - 1, ty))) edgeGlow(gx, ecol, px + 0.9, py + 0.9, px + 0.9, py + TILE - 0.9, 0.5 * bk);
        if (!solid(at(tx + 1, ty))) edgeGlow(gx, ecol, px + TILE - 0.9, py + 0.9, px + TILE - 0.9, py + TILE - 0.9, 0.5 * bk);
      }
    }
    return { base: base, glow: glowCv, spikes: spikes, key: key };
  }

  function getTerrain(theme, terrain) {
    var key = theme + ":" + terrainHash(terrain);
    if (G.terrain && G.terrain.key === key) return G.terrain;
    G.terrain = buildTerrain(theme, terrain, key);
    return G.terrain;
  }

  function drawTerrainFx(ctx, view, t) {
    var cache = getTerrain(view.theme, view.terrain);
    var sp = cache.spikes;
    if (!sp.length) return;
    var col = pal(view.theme).spike;
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < sp.length; i += 3) {
      var a = 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(t * 3 + sp[i + 2] * TAU));
      glow(ctx, sp[i], sp[i + 1], 10, col, a);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* ------------------------------------------------------------- BACKGROUND */
  var MARGIN = 8;

  /* Static world layer: sky + terrain body + neon edges + vignette, composited
     once per (theme, terrain) so a frame costs one fullscreen blit.            */
  function buildWorld(theme, terrain, key) {
    var p = pal(theme);
    var cache = getTerrain(theme, terrain);
    var cw = Math.round((W + MARGIN * 2) * G.sx), ch = Math.round((H + MARGIN * 2) * G.sy);
    var cv = makeCanvas(cw, ch), x = cv.getContext("2d");
    x.setTransform(G.sx, 0, 0, G.sy, 0, 0);
    x.translate(MARGIN, MARGIN);

    /* sky (cached at 1x world, upscaled) */
    x.drawImage(getSky(theme), -MARGIN, -MARGIN, W + MARGIN * 2, H + MARGIN * 2);

    /* pre-drawn terrain body */
    x.drawImage(cache.base, 0, 0, W, H);

    /* neon edges */
    x.globalCompositeOperation = "lighter";
    x.globalAlpha = 0.9;
    x.drawImage(cache.glow, 0, 0, W, H);
    /* bake atmospheric haze so the live fog pass can be a single cheap blit */
    var fogBase = getFog(theme);
    x.globalAlpha = 0.16;
    x.drawImage(fogBase, -MARGIN, H - 92, 512, 96);
    x.globalAlpha = 0.09;
    x.drawImage(fogBase, -MARGIN, H - 152, 512, 80);
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";

    /* static vignette baked into the world */
    var vg = getVignette();
    if (vg) {
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.drawImage(vg, 0, 0, cw, ch);
    }
    return { canvas: cv, key: key, w: cw, h: ch, pad: MARGIN };
  }

  function getWorld(theme, terrain) {
    var key = theme + ":" + terrainHash(terrain);
    if (G.world && G.world.key === key) return G.world;
    G.world = buildWorld(theme, terrain, key);
    return G.world;
  }

  function drawAuroraVeil(ctx, view, t) {
    var p = pal(view.theme);
    if (!p.aurora) return;
    var au = getAurora(view.theme);
    if (!au) return;
    var a = p.aurora.alpha * (0.82 + 0.18 * Math.sin(t * 0.42));
    var off = mod(t * 2.6, AUR_W);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = a;
    /* only blit the visible slices, never the whole 2-screen-wide strip */
    var first = W;
    if (off + first > AUR_W) first = AUR_W - off;
    if (first > 0) ctx.drawImage(au, off, 0, first, H, 0, 0, first, H);
    var rest = W - first;
    if (rest > 0) ctx.drawImage(au, 0, 0, rest, H, first, 0, rest, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function drawFogBands(ctx, view, t) {
    var fog = getFog(view.theme);
    var foff = mod(t * 2.6, 512);
    var w1 = Math.min(W, 512 - foff);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.10;
    if (w1 > 0) ctx.drawImage(fog, foff, 0, w1, 128, 0, H - 88, w1, 92);
    var rest = W - w1;
    if (rest > 0) ctx.drawImage(fog, 0, 0, Math.min(rest, 512), 128, w1, H - 88, Math.min(rest, 512), 92);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function initSeeds() {
    var n = 48, a = new Float32Array(n * 6);
    for (var i = 0; i < n; i++) {
      a[i * 6] = hash2(i, 1.1);
      a[i * 6 + 1] = hash2(i, 2.2);
      a[i * 6 + 2] = 0.5 + hash2(i, 3.3);
      a[i * 6 + 3] = 0.12 + hash2(i, 4.4) * 0.26;
      a[i * 6 + 4] = hash2(i, 5.5) * TAU;
      a[i * 6 + 5] = hash2(i, 6.6);
    }
    G.seeds = a;
  }

  function drawAmbient(ctx, t, p, front) {
    if (!G.seeds) initSeeds();
    var s = G.seeds, n = s.length / 6, mode = p.ambient;
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < n; i++) {
      if ((i % 3 === 0) !== front) continue;
      var x0 = s[i * 6], y0 = s[i * 6 + 1], sp = s[i * 6 + 2], sz = s[i * 6 + 3];
      var ph = s[i * 6 + 4], kind = s[i * 6 + 5];
      var px, py, alpha;
      if (mode === "ember") {
        py = mod(y0 * H - t * (8 + sp * 12), H);
        px = mod(x0 * W + Math.sin(t * (0.8 + sp) * 2 + ph) * 6 + t * (2 + sp * 3), W);
        alpha = (0.22 + 0.45 * Math.abs(Math.sin(t * 3 + ph))) * (kind > 0.5 ? 1 : 0.6) * 0.7;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = kind > 0.6 ? p.particle : p.particle2;
        ctx.fillRect(px, py, sz * 0.6, sz * 2.2);
        continue;
      } else if (mode === "snow") {
        py = mod(y0 * H + t * (10 + sp * 16), H);
        px = mod(x0 * W + Math.sin(t * 0.9 + ph) * 8 + t * (3 + sp * 4), W);
        alpha = 0.22 + 0.4 * sp;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.particle;
        ctx.fillRect(px, py, sz * 1.2, sz * 1.2);
        continue;
      } else if (mode === "firefly") {
        py = mod(y0 * H + Math.sin(t * 0.5 + ph) * 10, H);
        px = mod(x0 * W + Math.cos(t * 0.37 + ph) * 14, W);
        alpha = (0.18 + 0.5 * (0.5 + 0.5 * Math.sin(t * 2.4 + ph * 3))) * (kind > 0.55 ? 1 : 0.6);
        glow(ctx, px, py, 3.2 + sz * 5, kind > 0.7 ? p.accent2 : p.accent, alpha * 0.9);
        continue;
      } else if (mode === "ash") {
        py = mod(y0 * H + t * (5 + sp * 8), H);
        px = mod(x0 * W + Math.sin(t * 0.7 + ph) * 7 + t * (1.5 + sp * 2), W);
        alpha = 0.16 + 0.32 * sp;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = kind > 0.6 ? p.particle2 : p.particle;
        ctx.fillRect(px, py, sz, sz);
        continue;
      } else if (mode === "void") {
        py = mod(y0 * H - t * (2 + sp * 3), H);
        px = mod(x0 * W + Math.sin(t * 0.4 + ph) * 12, W);
        alpha = 0.18 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.7 + ph * 2));
        glow(ctx, px, py, 3 + sz * 6, kind > 0.6 ? p.accent2 : p.accent, alpha * 0.8);
        continue;
      } else { /* dust */
        py = mod(y0 * H + Math.sin(t * 0.6 + ph) * 7 - t * (2 + sp * 3), H);
        px = mod(x0 * W + t * (4 + sp * 6), W);
        alpha = 0.14 + 0.3 * (0.5 + 0.5 * Math.sin(t * 1.3 + ph * 2));
        ctx.globalAlpha = alpha;
        ctx.fillStyle = kind > 0.7 ? p.particle2 : p.particle;
        ctx.fillRect(px, py, sz * 1.1, sz * 1.1);
        continue;
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* ================================================================ SHAPES */
  function roundRect(x, px, py, w, h, r) {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    x.beginPath();
    x.moveTo(px + r, py);
    x.lineTo(px + w - r, py);
    x.quadraticCurveTo(px + w, py, px + w, py + r);
    x.lineTo(px + w, py + h - r);
    x.quadraticCurveTo(px + w, py + h, px + w - r, py + h);
    x.lineTo(px + r, py + h);
    x.quadraticCurveTo(px, py + h, px, py + h - r);
    x.lineTo(px, py + r);
    x.quadraticCurveTo(px, py, px + r, py);
    x.closePath();
  }
  function limb(x, ax, ay, bx, by, cx2, cy2, w, col, dark) {
    x.lineCap = "round";
    x.lineJoin = "round";
    x.strokeStyle = dark;
    x.lineWidth = w + 1.15;
    x.beginPath();
    x.moveTo(ax, ay); x.lineTo(bx, by); x.lineTo(cx2, cy2);
    x.stroke();
    x.strokeStyle = col;
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(ax, ay); x.lineTo(bx, by); x.lineTo(cx2, cy2);
    x.stroke();
  }
  function limbLeg(x, hx, hy, kx, ky, fx, fy, w, col, dark, boot) {
    limb(x, hx, hy, kx, ky, fx, fy, w, col, dark);
    x.fillStyle = boot;
    x.beginPath();
    x.ellipse(fx + 0.75, fy - 0.45, 1.95, 1.15, 0.05, 0, TAU);
    x.fill();
  }

  /* ======================================================= WORLD OBJECTS */
  function arrayInCells(arr) {
    if (!arr || !arr.length) return true;
    var mx = -1e9, my = -1e9, i, o;
    for (i = 0; i < arr.length; i++) {
      o = arr[i];
      if (!o || typeof o.x !== "number" || typeof o.y !== "number") continue;
      if (o.x > mx) mx = o.x;
      if (o.y > my) my = o.y;
    }
    return mx <= TW - 0.5 && my <= TH - 0.5;
  }

  /* --- exit portals (stone ring door) ------------------------------------- */
  function portalFrame(theme, who, filledId) {
    if (!G.portalFrames) G.portalFrames = {};
    var key = theme + "|" + (who || "-") + "|" + (filledId == null ? "-" : filledId);
    var cached = G.portalFrames[key];
    if (cached) return cached;
    var p = pal(theme);
    var filled = filledId != null;
    var owner = who || filledId;
    var occ = charPal(owner);
    var col = owner ? occ.accent : p.portal;
    var cc = charPal(filledId || owner);
    var fw = Math.round(20 * G.sx), fh = Math.round(26 * G.sy);
    var cv = makeCanvas(fw, fh), x = cv.getContext("2d");
    x.setTransform(G.sx, 0, 0, G.sy, 0, 0);
    x.translate(10, 26);
    x.lineCap = "round";
    x.lineJoin = "round";
    var cy = -10.6, rx = 6.2, ry = 9.4;
    var rimA = filled ? 0.8 : 1;
    /* plinth */
    x.fillStyle = "#070d16";
    roundRect(x, -8, -3.6, 16, 4.4, 1.5);
    x.fill();
    x.strokeStyle = col;
    x.globalAlpha = filled ? 0.55 : 0.7;
    x.lineWidth = 0.6;
    x.stroke();
    x.globalAlpha = 1;
    x.fillStyle = col;
    x.globalAlpha = filled ? 0.45 : 0.55;
    x.fillRect(-6, -3.3, 12, 0.7);
    x.globalAlpha = 1;
    /* owner gem on the plinth */
    x.fillStyle = col;
    x.globalAlpha = filled ? 0.5 : 0.9;
    x.beginPath(); x.arc(0, -1.4, 1.1, 0, TAU); x.fill();
    x.globalAlpha = 1;
    /* doorway interior */
    x.beginPath();
    x.ellipse(0, cy, rx - 0.9, ry - 0.9, 0, 0, TAU);
    x.fillStyle = "#02050a";
    x.fill();
    if (filled) {
      /* sealed door: dark interior, faint owner light, the rescued viking */
      x.fillStyle = "#071019";
      x.globalAlpha = 0.9;
      x.fill();
      x.globalAlpha = 1;
      /* the rescued viking is lit up inside */
      x.globalCompositeOperation = "lighter";
      x.fillStyle = col;
      x.globalAlpha = 0.3;
      x.beginPath(); x.arc(0, cy + 1.6, 4.4, 0, TAU); x.fill();
      x.globalAlpha = 0.5;
      x.beginPath(); x.arc(0, cy - 6.6, 2.6, 0, TAU); x.fill();
      x.globalAlpha = 1;
      x.globalCompositeOperation = "source-over";
      var by = -2;
      x.fillStyle = "#eaf6ff";
      x.fillRect(-2.3, by - 5.2, 1.6, 5.2);
      x.fillRect(0.7, by - 5.2, 1.6, 5.2);
      x.beginPath();
      x.moveTo(-3.1, by - 5.2);
      x.quadraticCurveTo(0, by - 10.6, 3.1, by - 5.2);
      x.closePath();
      x.fill();
      x.beginPath(); x.arc(0, by - 11.8, 2, 0, TAU); x.fill();
      x.beginPath(); x.arc(0, by - 12.4, 2.2, Math.PI, TAU); x.fill();
      x.strokeStyle = cc.accent2;
      x.globalAlpha = 1;
      x.lineWidth = 0.55;
      x.beginPath(); x.arc(0, by - 11.8, 2.1, -2.4, -0.4); x.stroke();
      x.globalAlpha = 1;
      /* closed grille over the door */
      for (var gb = 0; gb < 3; gb++) {
        var gx = -3.6 + gb * 3.6;
        x.fillStyle = "#0a1622";
        x.fillRect(gx - 0.75, cy - 8.4, 1.5, 16.8);
        x.strokeStyle = "#c8dcea";
        x.globalAlpha = 0.85;
        x.lineWidth = 0.4;
        x.strokeRect(gx - 0.75, cy - 8.4, 1.5, 16.8);
        x.globalAlpha = 1;
        x.fillStyle = col;
        x.globalAlpha = 0.7;
        x.fillRect(gx - 0.25, cy - 7.8, 0.5, 15.6);
        x.globalAlpha = 1;
      }
      /* seal bands */
      x.fillStyle = col;
      x.globalAlpha = 0.95;
      x.fillRect(-5.4, cy - 6.8, 10.8, 0.9);
      x.fillRect(-5.4, cy + 5.9, 10.8, 0.9);
      x.globalAlpha = 1;
    }
    /* stone ring */
    x.beginPath();
    x.ellipse(0, cy, rx, ry, 0, 0, TAU);
    x.strokeStyle = "#0b1520";
    x.lineWidth = 3;
    x.stroke();
    x.strokeStyle = col;
    x.globalAlpha = rimA;
    x.lineWidth = 1;
    x.stroke();
    x.globalAlpha = filled ? 0.3 : 0.55;
    x.strokeStyle = filled ? col : p.accent2;
    x.lineWidth = 0.4;
    x.beginPath();
    x.ellipse(0, cy, rx - 1.1, ry - 1.1, 0, 0, TAU);
    x.stroke();
    x.globalAlpha = 1;
    /* tick marks around the ring */
    x.strokeStyle = filled ? col : p.accent2;
    for (var i = 0; i < 8; i++) {
      var a = i * 0.785;
      x.globalAlpha = filled ? 0.28 : 0.55;
      x.lineWidth = 0.45;
      x.beginPath();
      x.moveTo(Math.cos(a) * (rx + 2.2), cy + Math.sin(a) * (ry + 2.4));
      x.lineTo(Math.cos(a) * (rx + 4), cy + Math.sin(a) * (ry + 4.4));
      x.stroke();
    }
    x.globalAlpha = 1;
    /* keystone: owner rune so the door identity is obvious */
    x.fillStyle = "#0b1520";
    roundRect(x, -3.2, cy - ry - 5.6, 6.4, 5.4, 1.2);
    x.fill();
    x.strokeStyle = col;
    x.globalAlpha = filled ? 0.85 : 0.9;
    x.lineWidth = 0.5;
    x.stroke();
    x.strokeStyle = col;
    x.globalAlpha = filled ? 0.85 : 1;
    x.lineWidth = 0.85;
    strokeRune(x, occ.rune, 0, cy - ry - 2.9, 4.4, 0);
    x.globalAlpha = 1;
    /* side brackets */
    x.fillStyle = "#070d16";
    x.fillRect(-8.6, -5.8, 1.8, 4.2);
    x.fillRect(6.8, -5.8, 1.8, 4.2);
    x.strokeStyle = col;
    x.globalAlpha = filled ? 0.4 : 0.6;
    x.lineWidth = 0.45;
    x.strokeRect(-8.6, -5.8, 1.8, 4.2);
    x.strokeRect(6.8, -5.8, 1.8, 4.2);
    x.globalAlpha = 1;
    G.portalFrames[key] = cv;
    return cv;
  }

  function drawExitPortal(ctx, ex, t, p, theme, cells) {
    var cx = cells ? ex.x * TILE + 8 : ex.x;
    var base = cells ? ex.y * TILE + TILE : ex.y;
    var filled = ex.filledBy != null;
    var owner = ex.who || ex.filledBy;
    var occ = charPal(owner);
    var cc = charPal(ex.filledBy || owner);
    var col = owner ? occ.accent : p.portal;
    var seed = (ex.anim || 0) + ex.x * 0.37;
    var pulse = 0.5 + 0.5 * Math.sin(t * 2.3 + seed);
    var frame = portalFrame(theme, ex.who || null, filled ? ex.filledBy : null);

    ctx.globalCompositeOperation = "lighter";
    glow(ctx, cx, base - 10, filled ? 13 : 13, col, (filled ? 0.2 : 0.24) + pulse * (filled ? 0.03 : 0.07));
    glow(ctx, cx, base - 1.5, 10, col, filled ? 0.12 : 0.18 + pulse * 0.04);
    if (filled) glow(ctx, cx, base - 11, 13, cc.accent2, 0.06 + pulse * 0.03);
    ctx.globalCompositeOperation = "source-over";

    ctx.drawImage(frame, cx - 10, base - 26, 20, 26);

    /* live energy inside the ring */
    if (!filled) {
      ctx.globalCompositeOperation = "lighter";
      var gs = glowSprite(col);
      ctx.globalAlpha = 0.24 + pulse * 0.1;
      ctx.drawImage(gs, cx - 5.6, base - 19.6, 11.2, 18);
      ctx.strokeStyle = col;
      for (var r = 0; r < 3; r++) {
        var off = t * (1.5 + r * 0.4) + r * 1.6 + seed;
        ctx.globalAlpha = 0.5 - r * 0.11;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.ellipse(cx, base - 10.6, 2.1 + r * 1.4, 5 + r * 1.5, 0, off, off + 2.2);
        ctx.stroke();
      }
      for (var i = 0; i < 4; i++) {
        var ph = t * 1.7 + i * 1.4 + seed;
        var my = base - 3 - mod(t * 7 + i * 4.3, 14);
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = i % 2 ? "#ffffff" : col;
        ctx.fillRect(cx + Math.sin(ph) * 3 - 0.35, my, 0.7, 1.5);
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, cx, base - 11, 6.5 + pulse * 3, cc.accent2, 0.16 + pulse * 0.1);
      for (var k = 0; k < 3; k++) {
        var ph2 = t * 1.9 + k * 2.1 + seed;
        glow(ctx, cx + Math.sin(ph2) * 5, base - 4 - mod(t * 5 + k * 4, 12), 2, cc.accent2, 0.38);
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /* --- gates (portcullis + energy field) ---------------------------------- */
  function drawGate(ctx, g, t, p, cells) {
    var cx = cells ? g.x * TILE + 8 : g.x;
    var top = cells ? g.y * TILE : g.y - 8;
    var openAmt = clamp(typeof g.anim === "number" ? g.anim : (g.open || 0), 0, 1);
    var col = groupCol(g.group);
    var close = 1 - openAmt;
    var shift = openAmt * 19;
    var i;

    /* side channels + head beam */
    ctx.fillStyle = "#0a1420";
    ctx.fillRect(cx - 8, top - 1, 3.4, TILE + 1);
    ctx.fillRect(cx + 4.6, top - 1, 3.4, TILE + 1);
    ctx.strokeStyle = "#435a6c";
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.4;
    ctx.strokeRect(cx - 8, top - 1, 3.4, TILE + 1);
    ctx.strokeRect(cx + 4.6, top - 1, 3.4, TILE + 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#0d1a26";
    ctx.fillRect(cx - 8, top - 2.6, 16, 3.8);
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(cx - 8, top - 2.6, 16, 3.8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#0b1520";
    ctx.beginPath(); ctx.arc(cx, top - 0.7, 2.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    strokeRune(ctx, g.group === "a" ? 0 : g.group === "b" ? 1 : g.group === "c" ? 2 : 3, cx, top - 0.7, 3.2, 0);

    /* energy field: the barrier itself */
    if (close > 0.02) {
      ctx.fillStyle = col;
      ctx.globalAlpha = close * 0.14;
      ctx.fillRect(cx - 4.6, top, 9.2, TILE);
      ctx.globalAlpha = close * 0.6;
      ctx.fillRect(cx - 4.6, top, 0.7, TILE);
      ctx.fillRect(cx + 3.9, top, 0.7, TILE);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = col;
      for (var sc = 0; sc < 2; sc++) {
        var sy2 = top + mod(t * 10 + sc * 8 + g.x, TILE);
        ctx.globalAlpha = close * 0.20;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(cx - 4.4, sy2);
        ctx.lineTo(cx + 4.4, sy2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    /* retracting bars */
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 4.8, top - 2, 9.6, TILE + 4);
    ctx.clip();
    ctx.translate(0, -shift);
    for (i = 0; i < 4; i++) {
      var bx = cx - 3.7 + i * 2.46;
      ctx.fillStyle = "#182838";
      roundRect(ctx, bx - 0.8, top - 3, 1.6, TILE + 10, 0.6);
      ctx.fill();
      ctx.strokeStyle = "#9fb4c4";
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.55;
      ctx.fillRect(bx - 0.3, top - 2.2, 0.6, TILE + 7);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#0c1824";
      ctx.beginPath();
      ctx.moveTo(bx - 0.9, top + TILE - 0.3);
      ctx.lineTo(bx, top + TILE + 2.2);
      ctx.lineTo(bx + 0.9, top + TILE - 0.3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#1c2c3c";
    ctx.fillRect(cx - 4.8, top + 2.4, 9.6, 1.8);
    ctx.fillRect(cx - 4.8, top + 9.4, 9.6, 1.8);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(cx - 4.8, top + 2.4, 9.6, 0.7);
    ctx.fillRect(cx - 4.8, top + 9.4, 9.6, 0.7);
    ctx.globalAlpha = 1;
    ctx.restore();

    /* floor slot */
    ctx.fillStyle = "#04080e";
    ctx.fillRect(cx - 6.2, top + TILE - 1.6, 12.4, 1.6);
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.45 + close * 0.4;
    ctx.fillRect(cx - 5, top + TILE - 1.4, 10, 0.6);
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = "lighter";
    glow(ctx, cx, top + TILE / 2, 11, col, 0.06 + close * 0.16 + 0.03 * Math.sin(t * 2.4 + g.x));
    ctx.globalCompositeOperation = "source-over";
  }

  /* --- pressure plate ----------------------------------------------------- */
  function drawPlate(ctx, pl, t, p, cells) {
    var cx = cells ? pl.x * TILE + 8 : pl.x;
    var base = cells ? pl.y * TILE + TILE : pl.y;
    var col = groupCol(pl.group);
    var pressed = !!pl.pressed;
    var seed = pl.x * 0.7 + pl.y * 1.3;
    var pulse = 0.5 + 0.5 * Math.sin(t * 4 + seed);
    var drop = pressed ? 1.4 : 0;
    var top = base - 6 + drop;

    /* recessed metal frame */
    ctx.fillStyle = "#060b13";
    roundRect(ctx, cx - 7.6, base - 8.2, 15.2, 7.4, 1.8);
    ctx.fill();
    ctx.fillStyle = "#02040a";
    ctx.globalAlpha = 0.6;
    ctx.fillRect(cx - 6.4, base - 7, 12.8, 1.2);
    ctx.globalAlpha = 1;
    /* corner bolts */
    ctx.fillStyle = "#7d92a2";
    ctx.beginPath(); ctx.arc(cx - 6.4, base - 7.2, 0.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 6.4, base - 7.2, 0.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#3d5162";
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    /* colour brackets bind the plate to its gate */
    ctx.strokeStyle = col;
    ctx.globalAlpha = pressed ? 0.95 : 0.5;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 7, base - 4.6); ctx.lineTo(cx - 7, base - 7.4); ctx.lineTo(cx - 4, base - 7.4);
    ctx.moveTo(cx + 7, base - 4.6); ctx.lineTo(cx + 7, base - 7.4); ctx.lineTo(cx + 4, base - 7.4);
    ctx.stroke();
    ctx.globalAlpha = 1;
    /* pad */
    ctx.fillStyle = pressed ? "#0a1a24" : "#0c1520";
    roundRect(ctx, cx - 5.2, top - 3.4, 10.4, 4.4, 1.2);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.globalAlpha = pressed ? 1 : 0.55;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = col;
    ctx.globalAlpha = pressed ? 0.75 : 0.22;
    roundRect(ctx, cx - 4, top - 2.7, 8, 2.4, 0.8);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = pressed ? "#ffffff" : col;
    ctx.globalAlpha = pressed ? 0.95 : 0.6;
    ctx.beginPath(); ctx.arc(cx, top - 1.5, pressed ? 1.5 : 1, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.globalCompositeOperation = "lighter";
    glow(ctx, cx, top - 1.4, pressed ? 12 : 6, col, pressed ? 0.4 + 0.16 * pulse : 0.1);
    if (pressed) {
      ctx.strokeStyle = col;
      for (var k = 0; k < 2; k++) {
        var f = mod(t * 1.4 + k * 0.5 + seed, 1);
        ctx.globalAlpha = (1 - f) * 0.5;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(cx, base - 3.4, 4 + f * 9, 1.4 + f * 2.8, 0, 0, TAU);
        ctx.stroke();
      }
      /* flat glow ring proves the plate is active */
      ctx.globalAlpha = 0.22 + 0.08 * pulse;
      ctx.fillStyle = col;
      roundRect(ctx, cx - 5.6, base - 6.6, 11.2, 3.4, 1.1);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = "source-over";
  }

  /* --- wall lever --------------------------------------------------------- */
  function drawLever(ctx, lv, t, p, cells) {
    var cx = cells ? lv.x * TILE + 8 : lv.x;
    var base = cells ? lv.y * TILE + TILE : lv.y;
    var col = groupCol(lv.group);
    var anim = clamp(typeof lv.anim === "number" ? lv.anim : (lv.on ? 1 : 0), 0, 1);
    var ang = lerp(0.62, -1.02, anim);
    var px = cx, py = base - 6.4;
    var len = 8.2;
    var hx = px + Math.sin(ang) * len;
    var hy = py - Math.cos(ang) * len;

    /* wall panel */
    ctx.fillStyle = "#081019";
    roundRect(ctx, cx - 6, base - 14.6, 12, 13.6, 2.2);
    ctx.fill();
    ctx.strokeStyle = "#3f5566";
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;
    /* panel bevel */
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - 5.1, base - 8.4);
    ctx.lineTo(cx - 5.1, base - 13.7);
    ctx.lineTo(cx + 5.1, base - 13.7);
    ctx.stroke();
    /* bolts */
    ctx.fillStyle = "#7d92a2";
    ctx.beginPath(); ctx.arc(cx - 4.6, base - 13.2, 0.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4.6, base - 13.2, 0.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - 4.6, base - 2.6, 0.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 4.6, base - 2.6, 0.6, 0, TAU); ctx.fill();
    /* indicator lamp */
    var lampY = base - 12.2;
    ctx.fillStyle = "#05090f";
    roundRect(ctx, cx - 2.6, lampY - 1.5, 5.2, 3, 1);
    ctx.fill();
    ctx.fillStyle = anim > 0.5 ? col : "#16202a";
    ctx.globalAlpha = anim > 0.5 ? 0.95 : 0.7;
    ctx.fillRect(cx - 1.8, lampY - 0.9, 3.6, 1.8);
    ctx.globalAlpha = 1;
    /* group rune on the panel */
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 0.45;
    strokeRune(ctx, lv.group === "b" ? 1 : 4, cx, base - 8.4, 3.2, 0);
    ctx.globalAlpha = 1;
    /* slot track in the panel */
    ctx.strokeStyle = "#04080d";
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(px, py, len, -Math.PI * 0.82, -Math.PI * 0.18);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.25 + anim * 0.45;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.arc(px, py, len, -Math.PI * (0.18 + 0.64 * anim), -Math.PI * 0.18);
    ctx.stroke();
    ctx.globalAlpha = 1;
    /* lever arm: tapered metal bar with a rectangular grip */
    var nx = -Math.cos(ang), ny = -Math.sin(ang);
    var bw = 1.15;
    ctx.fillStyle = "#04070c";
    ctx.beginPath();
    ctx.moveTo(px + nx * bw, py + ny * bw);
    ctx.lineTo(hx + nx * bw, hy + ny * bw);
    ctx.lineTo(hx - nx * bw, hy - ny * bw);
    ctx.lineTo(px - nx * bw, py - ny * bw);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8497a8";
    ctx.beginPath();
    ctx.moveTo(px + nx * 0.7, py + ny * 0.7);
    ctx.lineTo(hx + nx * 0.7, hy + ny * 0.7);
    ctx.lineTo(hx - nx * 0.7, hy - ny * 0.7);
    ctx.lineTo(px - nx * 0.7, py - ny * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(px + nx * 0.7, py + ny * 0.7);
    ctx.lineTo(hx + nx * 0.7, hy + ny * 0.7);
    ctx.stroke();
    ctx.globalAlpha = 1;
    /* grip */
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    ctx.fillStyle = "#111d28";
    roundRect(ctx, -1.6, -1.9, 3.6, 3.8, 1);
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.globalAlpha = anim > 0.5 ? 0.85 : 0.45;
    ctx.fillRect(-0.9, -0.9, 1.8, 0.7);
    ctx.fillRect(-0.9, 0.5, 1.8, 0.7);
    ctx.globalAlpha = 1;
    ctx.restore();
    /* pivot cap */
    ctx.fillStyle = "#0a1119";
    ctx.beginPath(); ctx.arc(px, py, 2.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#8497a8";
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(px, py, 0.8, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, hx, hy, 3.6, col, 0.12 + anim * 0.2);
    glow(ctx, cx, lampY, 3, col, anim * 0.4);
    ctx.globalCompositeOperation = "source-over";
  }

  /* --- arrow turret trap -------------------------------------------------- */
  function drawTrap(ctx, tr, t, p, cells) {
    var cx = cells ? tr.x * TILE + 8 : tr.x;
    var cy = cells ? tr.y * TILE + 8 : tr.y;
    var dir = tr.dir >= 0 ? 1 : -1;
    var seed = tr.x * 0.9 + tr.y * 2.3;
    var cycle = mod(t * (1 / 2.2) + seed * 0.13, 1);
    var charge = smooth(clamp((cycle - 0.55) / 0.45, 0, 1));
    var aim = Math.sin(t * 1.6 + seed) * 0.05;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(dir, 1);
    ctx.rotate(aim);

    /* wall bracket */
    ctx.fillStyle = "#080e16";
    roundRect(ctx, -5.5, -6.5, 6, 13, 2);
    ctx.fill();
    ctx.strokeStyle = "#3f5566";
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    /* rivets */
    ctx.fillStyle = "#6d8292";
    ctx.fillRect(-4.4, -5.2, 0.9, 0.9);
    ctx.fillRect(-4.4, 4.2, 0.9, 0.9);

    /* bow limbs */
    ctx.strokeStyle = "#566a7a";
    ctx.lineWidth = 1.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0.6, -4.6);
    ctx.quadraticCurveTo(5.6, -3.4, 4.4, 0);
    ctx.quadraticCurveTo(5.6, 3.4, 0.6, 4.6);
    ctx.stroke();
    ctx.strokeStyle = "#93a8b8";
    ctx.lineWidth = 0.45;
    ctx.stroke();

    /* string */
    ctx.strokeStyle = "#c8d8e6";
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(0.6, -4.6);
    ctx.lineTo(0.6 + charge * 1.6, 0);
    ctx.lineTo(0.6, 4.6);
    ctx.stroke();
    ctx.globalAlpha = 1;

    /* housing */
    ctx.fillStyle = "#0b1420";
    ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, TAU); ctx.fill();
    ctx.strokeStyle = "#8aa0b0";
    ctx.lineWidth = 0.6;
    ctx.stroke();
    ctx.strokeStyle = "#3a4e5d";
    ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.stroke();

    /* barrel */
    ctx.fillStyle = "#1a2836";
    roundRect(ctx, 2, -1.2, 5.4, 2.4, 0.8);
    ctx.fill();
    ctx.strokeStyle = "#9ab0c0";
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.fillStyle = "#cfe0ec";
    ctx.fillRect(6.6, -0.9, 1.1, 1.8);

    /* inner eye */
    ctx.fillStyle = "#12060a";
    ctx.beginPath(); ctx.arc(0, 0, 1.7, 0, TAU); ctx.fill();
    ctx.fillStyle = "#ff4a5e";
    ctx.beginPath(); ctx.arc(0.2, 0, 1.05, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.globalCompositeOperation = "lighter";
    var ex = cx + dir * 0.4, ey = cy;
    glow(ctx, ex, ey, 3.4, "#ff3a50", 0.3 + 0.5 * charge + 0.1 * Math.sin(t * 5 + seed));
    glow(ctx, cx + dir * 7.4, cy, 2.6, "#ffb347", 0.1 + charge * 0.35);
    /* warning laser */
    ctx.strokeStyle = "#ff4a5e";
    ctx.globalAlpha = 0.06 + charge * 0.2;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + dir * 7.4, cy);
    ctx.lineTo(cx + dir * 40, cy);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* --- treasure crystal --------------------------------------------------- */
  function drawCrystal(ctx, tr, t, p, cells) {
    if (tr.taken) return;
    var cx = cells ? tr.x * TILE + 8 : tr.x;
    var base = cells ? tr.y * TILE + TILE : tr.y;
    var seed = tr.x * 1.3 + tr.y * 2.1;
    var bob = Math.sin(t * 1.8 + seed) * 1.7;
    var cy = base - 8 + bob;
    var spin = Math.cos(t * 1.3 + seed);
    var w = 3.2 + Math.abs(spin) * 1.7;
    var h = 5.6;
    var col = p.accent2;

    ctx.globalCompositeOperation = "lighter";
    glow(ctx, cx, cy, 11, p.accent, 0.26 + 0.08 * Math.sin(t * 2.3 + seed));
    glow(ctx, cx, base - 1, 8, p.accent, 0.16);
    ctx.globalCompositeOperation = "source-over";

    /* float shadow */
    ctx.fillStyle = "#02040a";
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.ellipse(cx, base - 1, 3.4, 1.1, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    /* crystal body */
    ctx.fillStyle = p.accent;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx + w, cy - 1);
    ctx.lineTo(cx, cy + h);
    ctx.lineTo(cx - w, cy - 1);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx + w, cy - 1);
    ctx.lineTo(cx, cy + h);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#eafcff";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h);
    ctx.lineTo(cx + w, cy - 1);
    ctx.lineTo(cx, cy + h);
    ctx.lineTo(cx - w, cy - 1);
    ctx.closePath();
    ctx.stroke();
    /* inner spark line */
    ctx.strokeStyle = "#ffffff";
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.25, cy - 0.6);
    ctx.lineTo(cx, cy - h * 0.55);
    ctx.stroke();
    ctx.globalAlpha = 1;

    /* sparkles */
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 3; i++) {
      var ph = t * 1.9 + i * 2.1 + seed;
      var sx = cx + Math.cos(ph) * (w + 2.5);
      var sy = cy + Math.sin(ph * 1.3) * (h * 0.7);
      var a = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * 5 + i + seed));
      ctx.globalAlpha = a;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(sx - 1.1, sy - 0.17, 2.2, 0.34);
      ctx.fillRect(sx - 0.17, sy - 1.1, 0.34, 2.2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* --- cave enemy --------------------------------------------------------- */
  function drawEnemy(ctx, e, t, p, cells, idx) {
    var dead = !e.alive;
    var dk = 0;
    if (dead) {
      var rec = G.deadEnemies[idx];
      if (!rec || e.anim < rec.base - 0.001) {
        rec = { base: e.anim || 0 };
        G.deadEnemies[idx] = rec;
      }
      dk = clamp((((e.anim || 0) - rec.base) / 0.45), 0, 1);
      if (dk >= 1) return;
    } else if (G.deadEnemies[idx]) {
      delete G.deadEnemies[idx];
    }
    var x = cells ? e.x * TILE + 8 : e.x;
    var y = cells ? (e.y + 1) * TILE : e.y;
    var dir = e.dir >= 0 ? 1 : -1;
    var seed = (e.x * 0.37 + e.y * 0.71) % 6.28;
    var walk = e.state !== "die";
    var cyc = t * 7 + seed;
    var bob = walk ? Math.sin(cyc * 2) * 0.5 : 0;
    var legA = walk ? Math.sin(cyc) * 1.9 : 0;
    var legB = -legA;

    /* shadow */
    ctx.fillStyle = "#02040a";
    ctx.globalAlpha = 0.4;
    ctx.beginPath(); ctx.ellipse(x, y - 0.5, 6.4, 1.7, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    ctx.save();
    if (dead) {
      ctx.globalAlpha = (1 - dk) * 0.85;
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, y - 6, 8, "#5a2a7a", 0.18 * (1 - dk));
      glow(ctx, x, y - 11 - dk * 8, 5, "#b58cff", 0.14 * (1 - dk));
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.translate(x, y + bob);
    ctx.scale(dir, 1);
    if (dead) ctx.scale(1, 1 - dk * 0.5);

    /* legs (two pairs) */
    var i;
    ctx.strokeStyle = "#05070f";
    ctx.lineWidth = 2.1;
    ctx.lineCap = "round";
    for (i = 0; i < 4; i++) {
      var lx = i < 2 ? -3.2 : 2.6;
      var sw = i % 2 === 0 ? legA : legB;
      var ly = i < 2 ? -0.2 : 0;
      ctx.beginPath();
      ctx.moveTo(lx, -4.4);
      ctx.lineTo(lx + sw * 0.8 + 1.1, -2.1);
      ctx.lineTo(lx + sw * 1.3 + 1.6, ly);
      ctx.stroke();
    }
    ctx.strokeStyle = "#2a2140";
    ctx.lineWidth = 0.8;
    for (i = 0; i < 4; i++) {
      var lx2 = i < 2 ? -3.2 : 2.6;
      var sw2 = i % 2 === 0 ? legA : legB;
      ctx.beginPath();
      ctx.moveTo(lx2, -4.4);
      ctx.lineTo(lx2 + sw2 * 0.8 + 1.1, -2.1);
      ctx.lineTo(lx2 + sw2 * 1.3 + 1.6, i < 2 ? -0.2 : 0);
      ctx.stroke();
    }

    /* back / hump */
    ctx.fillStyle = "#0a0712";
    ctx.beginPath();
    ctx.moveTo(-5.2, -5.4);
    ctx.quadraticCurveTo(-5.6, -10.2, -1.2, -11.4);
    ctx.quadraticCurveTo(2.6, -12.2, 5.2, -8.4);
    ctx.quadraticCurveTo(6.2, -6.2, 4.2, -4.6);
    ctx.quadraticCurveTo(0, -3.2, -5.2, -5.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#30234c";
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;

    /* back spikes */
    ctx.fillStyle = "#0e0a1a";
    for (i = 0; i < 4; i++) {
      var sx = -4.4 + i * 2.3;
      var sy = -10.2 + Math.sin(i * 1.7) * 0.9;
      ctx.beginPath();
      ctx.moveTo(sx - 1, sy);
      ctx.lineTo(sx + 0.2, sy - 3.2 - (i === 1 ? 1 : 0));
      ctx.lineTo(sx + 1.2, sy + 0.3);
      ctx.closePath();
      ctx.fill();
    }

    /* head + jaw */
    ctx.fillStyle = "#0b0814";
    ctx.beginPath();
    ctx.ellipse(6.2, -8.4, 3.4, 2.7, -0.16, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(4.6, -7.6);
    ctx.lineTo(9.2, -6.4);
    ctx.lineTo(4.9, -5.4);
    ctx.closePath();
    ctx.fill();

    /* front arm + claws */
    ctx.strokeStyle = "#0a0712";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(3.2, -8.6);
    ctx.quadraticCurveTo(6.6, -7.2, 7.4, -4.8);
    ctx.stroke();
    ctx.strokeStyle = "#3a2c5a";
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(7.4, -4.8);
    ctx.lineTo(8.6, -4.1);
    ctx.moveTo(7.4, -4.8);
    ctx.lineTo(8.4, -5.5);
    ctx.stroke();

    /* glowing eyes */
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, 6.9, -9.1, 3.2, "#ff3d5e", 0.5 + 0.12 * Math.sin(t * 6 + seed));
    ctx.fillStyle = "#ff8a96";
    ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.ellipse(6.9, -9.1, 0.95, 0.62, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5.2, -9.4, 0.7, 0.5, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    /* smoke wisps */
    var ph = t * 1.3 + seed;
    glow(ctx, -2 + Math.sin(ph) * 2, -13 - mod(t * 4 + seed, 5), 3.4, "#4a2a6e", 0.13);
    glow(ctx, -4 + Math.cos(ph * 1.3) * 2, -10 - mod(t * 3 + seed * 2, 4), 2.6, "#4a2a6e", 0.10);
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();
  }

  function drawWorldObjects(ctx, view, t) {
    var p = pal(view.theme);
    var i, arr, cells;
    arr = view.exits || EMPTY;
    cells = arrayInCells(arr);
    for (i = 0; i < arr.length; i++) if (arr[i]) drawExitPortal(ctx, arr[i], t, p, view.theme, cells);

    arr = view.gates || EMPTY;
    cells = arrayInCells(arr);
    for (i = 0; i < arr.length; i++) if (arr[i]) drawGate(ctx, arr[i], t, p, cells);

    arr = view.plates || EMPTY;
    cells = arrayInCells(arr);
    for (i = 0; i < arr.length; i++) if (arr[i]) drawPlate(ctx, arr[i], t, p, cells);

    arr = view.levers || EMPTY;
    cells = arrayInCells(arr);
    for (i = 0; i < arr.length; i++) if (arr[i]) drawLever(ctx, arr[i], t, p, cells);

    arr = view.traps || EMPTY;
    cells = arrayInCells(arr);
    for (i = 0; i < arr.length; i++) if (arr[i]) drawTrap(ctx, arr[i], t, p, cells);

    arr = view.treasures || EMPTY;
    cells = arrayInCells(arr);
    for (i = 0; i < arr.length; i++) if (arr[i]) drawCrystal(ctx, arr[i], t, p, cells);

    arr = view.enemies || EMPTY;
    cells = arrayInCells(arr);
    for (i = 0; i < arr.length; i++) if (arr[i]) drawEnemy(ctx, arr[i], t, p, cells, i);
  }

  /* ================================================================ ACTORS */
  function drawAura(ctx, x, y, c, t) {
    var pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
    ctx.globalCompositeOperation = "lighter";
    /* soft column of light */
    ctx.save();
    ctx.translate(x, y - 12);
    ctx.scale(0.78, 2.1);
    glow(ctx, 0, 0, 16, c.glow, 0.11 + pulse * 0.05);
    ctx.restore();
    /* ground pool + halo ring */
    ctx.save();
    ctx.translate(x, y - 1);
    ctx.scale(1, 0.3);
    glow(ctx, 0, 0, 13, c.glow, 0.32);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = c.accent;
    ctx.globalAlpha = 0.55 + pulse * 0.3;
    ctx.lineWidth = 0.95;
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 8.2, 2.7, 0, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 0.28 + pulse * 0.18;
    ctx.setLineDash([2.4, 2.6]);
    ctx.lineDashOffset = -t * 9;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 10.6, 3.6, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < 3; i++) {
      var ang = t * 1.9 + i * 2.094;
      glow(ctx, x + Math.cos(ang) * 9, y - 12 + Math.sin(ang * 1.4) * 4.5, 2.6, c.accent2, 0.45);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawDeadActor(ctx, a, c, t) {
    var x = a.x, y = a.y;
    ctx.fillStyle = "#05070d";
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.ellipse(x, y - 0.6, 7, 1.8, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.cloth;
    ctx.beginPath();
    ctx.ellipse(x, y - 2.6, 6.2, 2.8, -0.12, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = c.metal;
    ctx.beginPath(); ctx.arc(x - 4.6, y - 3.4, 2.3, 0, TAU); ctx.fill();
    ctx.strokeStyle = c.accent;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, x + 1, y - 4, 8, c.glow, 0.10);
    var ph = t * 1.2;
    glow(ctx, x + Math.sin(ph) * 2, y - 8 - mod(t * 3, 6), 2.6, "#b58cff", 0.16);
    ctx.globalCompositeOperation = "source-over";
  }

  function drawVikingBody(ctx, a, c, state, t, p) {
    var id = a.id;
    var run = state === "run";
    var act = state === "act";
    var brace = state === "brace" || (a.shield && id === "olaf");
    var air = state === "jump" || state === "fall" || !a.onGround;
    var ph = t * (run ? 12.5 : 2.2) + (a.anim || 0) * 2.1;
    var bob = run ? -Math.abs(Math.sin(ph)) * 0.9 : Math.sin(ph) * 0.45;
    if (air) bob = 0;

    var olaf = id === "olaf";
    var baleog = id === "baleog";
    var shW = olaf ? 4.2 : baleog ? 3.5 : 2.9;
    var waistW = olaf ? 3.4 : baleog ? 2.8 : 2.2;
    var hipY = -9.4 + bob;
    var shY = -17.2 + bob;
    var lean = 0;
    if (run) lean = 1.3;
    if (state === "jump") lean = 1.4;
    if (state === "fall") lean = 0.5;
    if (act && id === "erik") lean = 2.4;
    if (act && id === "baleog") lean = 0.5;
    if (brace) lean = 0.6;

    /* ---- cloak / back-gear (behind everything) ---- */
    if (id === "erik") {
      var sway = run ? Math.sin(ph * 0.5) * 1.8 : Math.sin(ph * 0.6) * 0.7;
      ctx.fillStyle = c.cloak;
      ctx.beginPath();
      ctx.moveTo(-1.2, shY + 0.4);
      ctx.quadraticCurveTo(-3.6, shY + 4.4, -4.6 + sway, -5.4);
      ctx.quadraticCurveTo(-3.2 + sway * 0.5, -6.2, -1.6, -10.4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.accent;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(-1.4, shY + 1);
      ctx.quadraticCurveTo(-3.4, shY + 4.8, -4.4 + sway, -5.6);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (id === "baleog") {
      /* quiver on the back */
      ctx.save();
      ctx.translate(-2.2, -12.4);
      ctx.rotate(0.5);
      ctx.fillStyle = c.fur;
      roundRect(ctx, -1.6, -5.4, 3.2, 8.6, 1.2);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.strokeStyle = c.accent;
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.moveTo(-1.2, -4.6); ctx.lineTo(1.2, -4.6); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#a88050";
      ctx.lineWidth = 0.55;
      for (var q = 0; q < 3; q++) {
        ctx.beginPath();
        ctx.moveTo(-1 + q, -5.2);
        ctx.lineTo(-1 + q + 1.2, -8.4);
        ctx.stroke();
      }
      ctx.restore();
    } else if (!brace) {
      /* round shield on the back */
      ctx.fillStyle = "#0c1522";
      ctx.beginPath(); ctx.arc(-2.6, -12.4, 4.8, 0, TAU); ctx.fill();
      ctx.strokeStyle = c.accent;
      ctx.globalAlpha = 0.75;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = c.metal;
      ctx.lineWidth = 0.45;
      ctx.beginPath(); ctx.arc(-2.6, -12.4, 3.2, 0, TAU); ctx.stroke();
      ctx.fillStyle = c.accent2;
      ctx.beginPath(); ctx.arc(-2.6, -12.4, 1.1, 0, TAU); ctx.fill();
    }

    /* ---- legs ---- */
    var footLx, footLy, footRx, footRy, kneeLx, kneeLy, kneeRx, kneeRy;
    if (air) {
      if (state === "jump") {
        footLx = -2.4; footLy = -4.4; footRx = 3.2; footRy = -2.2;
        kneeLx = -2.2; kneeLy = -7.4; kneeRx = 2.9; kneeRy = -6.4;
      } else {
        footLx = -3.6; footLy = -1.6; footRx = 3.8; footRy = -2.6;
        kneeLx = -2.9; kneeLy = -6.4; kneeRx = 3.1; kneeRy = -6.8;
      }
    } else if (run) {
      var sw = Math.sin(ph);
      var liftF = Math.max(0, Math.cos(ph));
      var liftB = Math.max(0, -Math.cos(ph));
      footRx = 0.8 + sw * 2.7; footRy = -liftF * 2.3;
      footLx = 0.8 - sw * 2.7; footLy = -liftB * 2.3;
      kneeRx = (footRx + 0) / 2 + 0.9; kneeRy = (footRy + hipY) / 2 + 0.4;
      kneeLx = (footLx + 0) / 2 + 0.7; kneeLy = (footLy + hipY) / 2 + 0.4;
    } else if (brace) {
      footLx = -3.5; footLy = 0; footRx = 3.5; footRy = 0;
      kneeLx = -2.9; kneeLy = -5.4; kneeRx = 2.9; kneeRy = -5.4;
    } else if (act && id === "erik") {
      footLx = -4; footLy = 0; footRx = 3.4; footRy = 0;
      kneeLx = -2.8; kneeLy = -5; kneeRx = 2.6; kneeRy = -5;
    } else {
      footLx = -2.5; footLy = 0; footRx = 2.4; footRy = 0;
      kneeLx = -2.2; kneeLy = -5; kneeRx = 2.1; kneeRy = -5;
    }
    kneeLx += lean * 0.3;
    kneeRx += lean * 0.3;
    footLx += lean * 0.25;
    footRx += lean * 0.25;
    hipY = -9.4 + bob;
    shY = -17.2 + bob;

    var lw = olaf ? 2.9 : baleog ? 2.6 : 2.3;
    /* far leg */
    limbLeg(ctx, -1.6, hipY, kneeLx, kneeLy, footLx, footLy, lw, c.cloak, "#05070c", c.metalDark);
    /* near leg */
    limbLeg(ctx, 1.7, hipY, kneeRx, kneeRy, footRx, footRy, lw + 0.2, c.cloth2, "#05070c", c.metalDark);

    /* ---- torso ---- */
    var leanX = lean;
    ctx.beginPath();
    ctx.moveTo(-shW + leanX * 0.4, shY);
    ctx.quadraticCurveTo(leanX * 0.4, shY - 1.8, shW + leanX * 0.4, shY);
    ctx.quadraticCurveTo(waistW + 1, (shY + hipY) / 2, waistW, hipY);
    ctx.quadraticCurveTo(0, hipY + 1.3, -waistW, hipY);
    ctx.quadraticCurveTo(-waistW - 1, (shY + hipY) / 2, -shW + leanX * 0.4, shY);
    ctx.closePath();
    ctx.fillStyle = c.cloth;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1.1;
    ctx.stroke();
    /* tunic panel */
    ctx.fillStyle = c.cloth2;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(-waistW + 0.6, hipY - 0.6);
    ctx.lineTo(-shW + 0.9 + leanX * 0.4, shY + 0.8);
    ctx.lineTo(shW - 1.1 + leanX * 0.4, shY + 0.8);
    ctx.lineTo(waistW - 0.7, hipY - 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    /* belt */
    ctx.fillStyle = "#0a0d14";
    ctx.fillRect(-waistW, hipY - 1.3, waistW * 2, 1.7);
    ctx.fillStyle = c.metal;
    ctx.fillRect(leanX * 0.4 - 1, hipY - 1.7, 2, 2.2);
    ctx.fillStyle = c.accent;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(leanX * 0.4 - 0.5, hipY - 1.2, 1, 1.1);
    ctx.globalAlpha = 1;
    /* fur collar */
    if (olaf || baleog) {
      ctx.fillStyle = id === "olaf" ? c.fur : c.fur;
      roundRect(ctx, -shW + 0.2 + leanX * 0.4, shY - 1.6, shW * 2 - 0.4, 2.3, 1.1);
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 0.4;
      ctx.stroke();
    }

    /* ---- head ---- */
    var headX = 0.6 + leanX;
    var headY = -20 + bob;
    /* neck */
    ctx.fillStyle = c.skin;
    ctx.fillRect(headX - 1.2, headY + 2.4, 2.4, 2.4);
    /* face */
    ctx.fillStyle = c.skin;
    ctx.beginPath(); ctx.arc(headX, headY, 3.1, 0, TAU); ctx.fill();
    /* beard */
    ctx.fillStyle = c.beard;
    if (id === "erik") {
      ctx.beginPath();
      ctx.moveTo(headX - 2.9, headY + 0.6);
      ctx.quadraticCurveTo(headX - 2.4, headY + 3.4, headX + 0.4, headY + 3.6);
      ctx.quadraticCurveTo(headX + 2.8, headY + 3, headX + 2.9, headY + 0.4);
      ctx.quadraticCurveTo(headX, headY + 1.8, headX - 2.9, headY + 0.6);
      ctx.closePath();
      ctx.fill();
    } else if (id === "baleog") {
      ctx.beginPath();
      ctx.moveTo(headX - 2.9, headY + 0.2);
      ctx.quadraticCurveTo(headX - 2.4, headY + 4.6, headX - 0.2, headY + 5.4);
      ctx.quadraticCurveTo(headX + 2.2, headY + 4.8, headX + 2.9, headY + 0.2);
      ctx.quadraticCurveTo(headX, headY + 2.2, headX - 2.9, headY + 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 0.35;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(headX - 3.2, headY + 0.4);
      ctx.quadraticCurveTo(headX - 2.6, headY + 4.4, headX, headY + 4.8);
      ctx.quadraticCurveTo(headX + 2.6, headY + 4.4, headX + 3.2, headY + 0.4);
      ctx.quadraticCurveTo(headX, headY + 2, headX - 3.2, headY + 0.4);
      ctx.closePath();
      ctx.fill();
    }
    /* eyes */
    ctx.fillStyle = c.eye;
    ctx.globalAlpha = 0.95;
    ctx.beginPath(); ctx.ellipse(headX + 1.1, headY - 0.5, 0.55, 0.4, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(headX + 2.45, headY - 0.5, 0.45, 0.34, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    /* ---- helmets ---- */
    if (id === "erik") {
      ctx.fillStyle = c.metalDark;
      ctx.beginPath();
      ctx.arc(headX, headY - 0.2, 3.5, Math.PI * 0.98, Math.PI * 2.02);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.metal;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.fillStyle = c.metal;
      ctx.fillRect(headX - 3.6, headY - 1.1, 7.2, 1.6);
      ctx.fillStyle = c.accent2;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(headX - 3.7, headY - 1.15, 7.4, 0.5);
      ctx.globalAlpha = 1;
      /* horns */
      ctx.strokeStyle = "#e8dcc4";
      ctx.lineWidth = 1.25;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(headX - 2.6, headY - 2.5);
      ctx.quadraticCurveTo(headX - 5.4, headY - 4.4, headX - 3.6, headY - 6.2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(headX + 2.6, headY - 2.5);
      ctx.quadraticCurveTo(headX + 5.4, headY - 4.4, headX + 3.6, headY - 6.2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 0.35;
      ctx.stroke();
    } else if (id === "baleog") {
      ctx.fillStyle = c.metalDark;
      ctx.beginPath();
      ctx.moveTo(headX - 3.6, headY - 0.8);
      ctx.lineTo(headX + 0.4, headY - 5.8);
      ctx.lineTo(headX + 3.6, headY - 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.metal;
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.fillStyle = c.metal;
      ctx.fillRect(headX - 3.7, headY - 1.5, 7.4, 1.5);
      /* nose guard */
      ctx.fillRect(headX + 1.4, headY - 1.2, 1.1, 3.1);
      ctx.fillStyle = c.accent;
      ctx.globalAlpha = 0.65;
      ctx.fillRect(headX + 1.55, headY - 1.1, 0.8, 2.8);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = c.metalDark;
      ctx.beginPath();
      ctx.arc(headX, headY - 0.4, 3.6, Math.PI * 0.96, Math.PI * 2.04);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = c.metal;
      ctx.lineWidth = 0.55;
      ctx.stroke();
      ctx.fillStyle = c.metal;
      ctx.fillRect(headX - 3.7, headY - 1.5, 7.4, 1.7);
      /* cheek guards */
      ctx.fillRect(headX - 3.7, headY - 1.4, 1.1, 3);
      ctx.fillRect(headX + 2.6, headY - 1.4, 1.1, 3);
      /* nose guard */
      ctx.fillRect(headX + 0.9, headY - 1.3, 1.1, 2.9);
      /* rivets */
      ctx.fillStyle = c.metal;
      for (var rv = 0; rv < 3; rv++) {
        ctx.beginPath();
        ctx.arc(headX - 2.2 + rv * 2.2, headY - 2.2, 0.35, 0, TAU);
        ctx.fill();
      }
    }

    /* ---- arms ---- */
    var backHandX, backHandY, frontHandX, frontHandY;
    if (act && id === "baleog") {
      frontHandX = 5.4 + leanX; frontHandY = -15.6 + bob;
      backHandX = 1.8 + leanX; backHandY = -16.6 + bob;
    } else if (act && id === "erik") {
      frontHandX = 1.2 + leanX; frontHandY = -13.4 + bob;
      backHandX = -3.6 + leanX; backHandY = -14.6 + bob;
    } else if (brace) {
      frontHandX = 3.6 + leanX; frontHandY = -23.2 + bob;
      backHandX = -3.6 + leanX; backHandY = -23.2 + bob;
    } else if (air) {
      if (state === "jump") {
        frontHandX = 4.6 + leanX; frontHandY = -16.4 + bob;
        backHandX = -4.6 + leanX; backHandY = -15.2 + bob;
      } else {
        frontHandX = 5.2 + leanX; frontHandY = -13.6 + bob;
        backHandX = -5.2 + leanX; backHandY = -13.2 + bob;
      }
    } else if (run) {
      var asw = Math.sin(ph);
      frontHandX = 3.2 - asw * 2.4; frontHandY = -10.6 - Math.max(0, asw) * 2.2;
      backHandX = -3.2 + asw * 2.4; backHandY = -10.6 - Math.max(0, -asw) * 2.2;
    } else {
      frontHandX = 3.9; frontHandY = -9.6 + bob;
      backHandX = -3.9; backHandY = -9.6 + bob;
    }
    /* far arm */
    limb(ctx, -shW + 0.6 + leanX * 0.4, shY + 1.4, -shW - 0.8 + leanX * 0.3, (shY + backHandY) / 2, backHandX, backHandY, olaf ? 2.5 : 2.1, c.cloak, "#05070c");
    /* near arm */
    limb(ctx, shW - 0.6 + leanX * 0.4, shY + 1.4, shW + 1.1 + leanX * 0.3, (shY + frontHandY) / 2, frontHandX, frontHandY, olaf ? 2.7 : 2.3, c.cloth2, "#05070c");
    /* hands */
    ctx.fillStyle = c.skin;
    ctx.beginPath(); ctx.arc(backHandX, backHandY, 1.15, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(frontHandX, frontHandY, 1.25, 0, TAU); ctx.fill();

    /* ---- weapons ---- */
    if (id === "baleog") {
      if (act) {
        /* drawn bow */
        ctx.strokeStyle = "#c9a06a";
        ctx.lineWidth = 0.95;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(frontHandX, frontHandY - 5.8);
        ctx.quadraticCurveTo(frontHandX + 2.4, frontHandY, frontHandX, frontHandY + 5.8);
        ctx.stroke();
        ctx.strokeStyle = "rgba(230,240,255,0.75)";
        ctx.lineWidth = 0.4;
        ctx.beginPath();
        ctx.moveTo(frontHandX, frontHandY - 5.8);
        ctx.lineTo(backHandX, backHandY);
        ctx.lineTo(frontHandX, frontHandY + 5.8);
        ctx.stroke();
        /* arrow */
        ctx.strokeStyle = c.accent;
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 0.55;
        ctx.beginPath();
        ctx.moveTo(backHandX, backHandY);
        ctx.lineTo(frontHandX + 8.4, frontHandY - 0.2);
        ctx.stroke();
        ctx.fillStyle = c.accent2;
        ctx.beginPath();
        ctx.moveTo(frontHandX + 9.6, frontHandY - 0.2);
        ctx.lineTo(frontHandX + 7.6, frontHandY - 1);
        ctx.lineTo(frontHandX + 7.6, frontHandY + 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, frontHandX + 8.6, frontHandY - 0.2, 3.4, c.accent, 0.5);
        ctx.globalCompositeOperation = "source-over";
      } else {
        /* sheathed bow on the back */
        ctx.strokeStyle = "#6b5232";
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-4.2, -16.4);
        ctx.quadraticCurveTo(-7.2, -12, -4.2, -7.6);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      /* sword hilt at the hip */
      ctx.fillStyle = "#c8d4e4";
      ctx.fillRect(waistW - 0.8, hipY - 2.2, 1.2, 3.4);
      ctx.fillStyle = c.accent;
      ctx.fillRect(waistW - 1.6, hipY - 2.4, 2.8, 0.8);
    }

    /* ---- Olaf shield ---- */
    if (id === "olaf") {
      if (brace) {
        var shCX = 0.4 + leanX, shCY = -26.4 + bob;
        ctx.fillStyle = "#0a1320";
        ctx.beginPath(); ctx.ellipse(shCX, shCY, 10.2, 3.5, 0, 0, TAU); ctx.fill();
        /* rim */
        ctx.strokeStyle = c.accent;
        ctx.globalAlpha = 0.95;
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.ellipse(shCX, shCY, 10.2, 3.5, 0, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = c.accent2;
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.ellipse(shCX, shCY, 8.4, 2.6, 0, 0, TAU); ctx.stroke();
        ctx.globalAlpha = 1;
        /* top surface highlight */
        ctx.strokeStyle = "#eaf6ff";
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.ellipse(shCX, shCY - 0.25, 8.6, 2.2, 0, Math.PI * 1.08, Math.PI * 1.92);
        ctx.stroke();
        ctx.globalAlpha = 1;
        /* boss + runes */
        ctx.fillStyle = c.accent2;
        ctx.beginPath(); ctx.ellipse(shCX, shCY, 2.1, 0.9, 0, 0, TAU); ctx.fill();
        ctx.strokeStyle = c.accent2;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 0.55;
        strokeRune(ctx, 3, shCX - 5, shCY, 3, 0);
        strokeRune(ctx, 3, shCX + 5, shCY, 3, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "lighter";
        glow(ctx, shCX, shCY - 0.5, 9, c.glow, 0.16);
        ctx.globalCompositeOperation = "source-over";
        /* bracing arms */
        ctx.strokeStyle = c.cloth2;
        ctx.lineWidth = 2.1;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-shW + 1, shY + 2); ctx.lineTo(-3.4, -23.2 + bob);
        ctx.moveTo(shW - 1, shY + 2); ctx.lineTo(3.4, -23.2 + bob);
        ctx.stroke();
      }
    }

    /* ---- rim light ---- */
    ctx.strokeStyle = c.accent;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.arc(headX, headY - 0.6, 3.5, -2.5, -0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(shW - 0.4 + leanX * 0.4, shY + 1);
    ctx.quadraticCurveTo(shW + 0.4 + leanX * 0.3, shY + 4.4, waistW - 0.2, hipY - 1);
    ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(frontHandX - 0.6, frontHandY + 1);
    ctx.lineTo(kneeRx + 0.4, kneeRy);
    ctx.stroke();
    ctx.globalAlpha = 1;

    /* ---- running dust ---- */
    if (run && !air) {
      ctx.globalCompositeOperation = "lighter";
      for (var d = 0; d < 2; d++) {
        var pgr = mod(t * 3 + d * 0.5, 1);
        glow(ctx, -3 - pgr * 7, -0.6, 2.4 + pgr * 2, p.accent, (1 - pgr) * 0.16);
      }
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function drawActor(ctx, a, t, isActive, p) {
    var state = a.state || "idle";
    if (state === "gone") return;
    var c = charPal(a.id);
    var dir = a.dir >= 0 ? 1 : -1;
    var x = a.x, y = a.y;

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = "#02040a";
    ctx.beginPath(); ctx.ellipse(x, y - 0.6, 5.4, 1.8, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;

    if (state === "dead") { drawDeadActor(ctx, a, c, t); return; }
    if (isActive) drawAura(ctx, x, y, c, t);

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    var scale = a.id === "olaf" ? 1.06 : (a.id === "baleog" ? 1.02 : 0.98);
    ctx.scale(scale, scale);
    if (!isActive) ctx.globalAlpha = 0.55;
    drawVikingBody(ctx, a, c, state, t, p);
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function drawActors(ctx, view, t) {
    var list = view.actors || EMPTY, i, a, p = pal(view.theme);
    for (i = 0; i < list.length; i++) {
      a = list[i];
      if (!a || a.active) continue;
      drawActor(ctx, a, t, false, p);
    }
    for (i = 0; i < list.length; i++) {
      a = list[i];
      if (!a || !a.active) continue;
      drawActor(ctx, a, t, true, p);
    }
  }

  /* =================================================================== FX */
  function drawArrow(ctx, a, t) {
    var dir = a.dir >= 0 ? 1 : -1;
    var hostile = !!a.hostile;
    var col = hostile ? "#ff5a6e" : "#9dffd0";
    var tipX = a.x + dir * 4;
    ctx.globalCompositeOperation = "lighter";
    glow(ctx, tipX, a.y, 6, col, 0.4);
    glow(ctx, a.x - dir * 4, a.y, 3.4, col, 0.16);
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 0.9;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(tipX - dir * 9, a.y);
    ctx.lineTo(tipX - dir * 1.2, a.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = hostile ? "#ffb0ba" : "#e8fff4";
    ctx.beginPath();
    ctx.moveTo(tipX, a.y);
    ctx.lineTo(tipX - dir * 2.4, a.y - 1.1);
    ctx.lineTo(tipX - dir * 2.4, a.y + 1.1);
    ctx.closePath();
    ctx.fill();
    /* fletching */
    ctx.strokeStyle = col;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(tipX - dir * 8.4, a.y);
    ctx.lineTo(tipX - dir * 6.6, a.y - 1.5);
    ctx.moveTo(tipX - dir * 8.4, a.y);
    ctx.lineTo(tipX - dir * 6.6, a.y + 1.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function drawFxItem(ctx, fx, t, p) {
    var type = fx.type;
    var age = fx.age || 0, ttl = fx.ttl || 0.5;
    if (ttl <= 0) return;
    var k = clamp(age / ttl, 0, 1);
    var fade = 1 - k;
    var x = fx.x, y = fx.y;
    var seed = (fx.dir || 1) * 1.7 + (fx.x || 0) * 0.13;

    if (type === "dust") {
      ctx.globalCompositeOperation = "source-over";
      for (var i = 0; i < 6; i++) {
        var ang = -Math.PI + i * (Math.PI / 5) + seed * 0.1;
        var d = (2 + k * 9) * (0.5 + hash2(i, fx.age || 1) * 0.8);
        ctx.globalAlpha = fade * 0.28;
        ctx.fillStyle = i % 2 ? "#cfe0ea" : p.particle;
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * d, y - Math.abs(Math.sin(ang)) * d * 0.5 - k * 1.5, 0.8 + k * 2.6, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (type === "spark") {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, y, 7 + k * 5, p.accent2, fade * 0.5);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.7;
      for (var s = 0; s < 8; s++) {
        var ang2 = s * 0.785 + seed * 0.6;
        var r1 = 1.5 + k * 3;
        var r2 = r1 + 2.5 + k * 6;
        ctx.globalAlpha = fade * (0.9 - s * 0.05);
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(ang2) * r1, y + Math.sin(ang2) * r1);
        ctx.lineTo(x + Math.cos(ang2) * r2, y + Math.sin(ang2) * r2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    } else if (type === "break") {
      ctx.globalCompositeOperation = "source-over";
      for (var b = 0; b < 8; b++) {
        var an = hash2(b, 1.3) * TAU;
        var sp = 12 + hash2(b, 2.4) * 26;
        var bx = x + Math.cos(an) * sp * k;
        var by = y - 2 + Math.sin(an) * sp * k * 0.7 + k * k * 22;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(an + k * 5);
        ctx.globalAlpha = fade * 0.95;
        ctx.fillStyle = b % 3 === 0 ? p.brickEdge : p.brick;
        ctx.fillRect(-1.6, -1.1, 3.2, 2.2);
        ctx.strokeStyle = "rgba(0,0,0,0.4)";
        ctx.lineWidth = 0.35;
        ctx.strokeRect(-1.6, -1.1, 3.2, 2.2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    } else if (type === "pickup") {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, y, 10 + k * 10, p.accent2, fade * 0.55);
      ctx.strokeStyle = p.accent2;
      var rr = k * 15;
      ctx.globalAlpha = fade * 0.8;
      ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.ellipse(x, y, rr, rr * 0.42, 0, 0, TAU); ctx.stroke();
      for (var q = 0; q < 6; q++) {
        var anq = q * 1.047 + seed;
        ctx.globalAlpha = fade * 0.9;
        ctx.fillStyle = "#fff8e0";
        ctx.fillRect(x + Math.cos(anq) * (4 + k * 10) - 1.2, y + Math.sin(anq) * (3 + k * 7) - 0.2, 2.4, 0.5);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    } else if (type === "hit") {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, y, 7 + k * 6, "#ff5a6e", fade * 0.5);
      glow(ctx, x, y, 2.4, "#ffd9de", fade * 0.55);
      ctx.strokeStyle = "#ff8a9a";
      ctx.lineWidth = 0.8;
      for (var hh = 0; hh < 6; hh++) {
        var anh = hh * 1.047 + seed;
        ctx.globalAlpha = fade * 0.55;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(anh) * (2 + k * 3), y + Math.sin(anh) * (2 + k * 3));
        ctx.lineTo(x + Math.cos(anh) * (5 + k * 8), y + Math.sin(anh) * (5 + k * 8));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    } else if (type === "death") {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, y, 12 + k * 8, "#7a2a6a", fade * 0.5);
      glow(ctx, x, y - k * 8, 6, "#b58cff", fade * 0.35);
      ctx.strokeStyle = "#ff6f9c";
      ctx.globalAlpha = fade * 0.5;
      ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.ellipse(x, y, k * 14, k * 5, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    } else if (type === "level") {
      ctx.globalCompositeOperation = "lighter";
      glow(ctx, x, y, 18 + k * 14, p.accent2, fade * 0.6);
      ctx.strokeStyle = p.accent2;
      ctx.globalAlpha = fade * 0.9;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(x, y, k * 22, k * 9, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = fade * 0.5;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(x, y, k * 13, k * 5.4, 0, 0, TAU); ctx.stroke();
      for (var l = 0; l < 8; l++) {
        var anl = l * 0.785 + t * 0.8;
        var lr = 4 + k * 16;
        ctx.globalAlpha = fade * 0.8;
        ctx.fillStyle = "#fff6d8";
        ctx.fillRect(x + Math.cos(anl) * lr - 1.2, y + Math.sin(anl) * lr * 0.5 - 0.2, 2.4, 0.5);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function drawFx(ctx, view, t) {
    var p = pal(view.theme), i, arr;
    arr = view.arrows || EMPTY;
    for (i = 0; i < arr.length; i++) if (arr[i]) drawArrow(ctx, arr[i], t);
    arr = view.fx || EMPTY;
    for (i = 0; i < arr.length; i++) if (arr[i]) drawFxItem(ctx, arr[i], t, p);
  }

  /* ================================================================== MAIN */
  function draw(view) {
    if (!G.ctx) return;
    var ctx = G.ctx;
    var t = (view && view.t) || 0;
    var theme = (view && view.theme) || "cave";
    var p = pal(theme);
    var shake = view ? clamp(view.shake || 0, 0, 1) : 0;
    var dx = shake ? Math.sin(t * 91.3) * shake * 3.2 : 0;
    var dy = shake ? Math.cos(t * 77.7) * shake * 2.4 : 0;
    var flash = view ? clamp(view.flash || 0, 0, 1) : 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#04060c";
    ctx.fillRect(0, 0, G.canvas.width, G.canvas.height);
    ctx.setTransform(G.sx, 0, 0, G.sy, 0, 0);
    ctx.translate(dx, dy);

    if (!view || !view.terrain) {
      ctx.drawImage(getSky(theme), -8, -8, W + 16, H + 16);
      drawFogBands(ctx, { theme: theme }, t);
      drawAmbient(ctx, t, p, true);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      var vg0 = getVignette();
      if (vg0) ctx.drawImage(vg0, 0, 0);
      return;
    }

    var world = getWorld(theme, view.terrain);
    ctx.drawImage(world.canvas, -world.pad + dx, -world.pad + dy, W + world.pad * 2, H + world.pad * 2);
    drawAuroraVeil(ctx, view, t);
    drawFogBands(ctx, view, t);
    drawAmbient(ctx, t, p, false);
    drawTerrainFx(ctx, view, t);
    drawWorldObjects(ctx, view, t);
    drawActors(ctx, view, t);
    drawFx(ctx, view, t);
    drawAmbient(ctx, t, p, true);

    /* overlays in device space */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (flash > 0.001) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = flash * 0.5;
      ctx.fillStyle = p.accent;
      ctx.fillRect(0, 0, G.canvas.width, G.canvas.height);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /* ============================================================== PORTRAIT */
  function drawPortrait(canvas, id, t) {
    if (!canvas) return;
    var pw = 192, ph = 224;
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    var x = canvas.getContext("2d");
    var c = charPal(id);
    var k = t || 0;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, pw, ph);
    x.setTransform(pw / 96, 0, 0, ph / 112, 0, 0);
    x.lineCap = "round";
    x.lineJoin = "round";

    /* backdrop */
    var bg = x.createLinearGradient(0, 0, 0, 112);
    bg.addColorStop(0, "#0a1420");
    bg.addColorStop(0.55, "#060c16");
    bg.addColorStop(1, "#03060c");
    x.fillStyle = bg;
    x.fillRect(0, 0, 96, 112);
    var halo = x.createRadialGradient(48, 42, 4, 48, 48, 72);
    halo.addColorStop(0, rgba(c.accent, 0.30));
    halo.addColorStop(0.5, rgba(c.accent, 0.08));
    halo.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = halo;
    x.fillRect(0, 0, 96, 112);
    /* soft beam */
    x.globalCompositeOperation = "lighter";
    var beam = x.createLinearGradient(0, 0, 0, 112);
    beam.addColorStop(0, rgba(c.accent2, 0.0));
    beam.addColorStop(0.35, rgba(c.accent, 0.05));
    beam.addColorStop(1, rgba(c.accent, 0.0));
    x.fillStyle = beam;
    x.fillRect(30, 0, 36, 112);
    x.globalCompositeOperation = "source-over";

    /* rune medallion behind the head */
    var mr = 33 + Math.sin(k * 0.8) * 0.6;
    x.strokeStyle = c.accent;
    x.globalAlpha = 0.16;
    x.lineWidth = 0.7;
    x.beginPath(); x.arc(48, 48, mr, 0, TAU); x.stroke();
    x.globalAlpha = 0.10;
    x.setLineDash([1.6, 3.4]);
    x.lineDashOffset = -k * 4;
    x.beginPath(); x.arc(48, 48, mr + 6, 0, TAU); x.stroke();
    x.setLineDash([]);
    x.lineDashOffset = 0;
    x.lineWidth = 0.7;
    for (var mr2 = 0; mr2 < 8; mr2++) {
      var ang = mr2 * 0.785 + k * 0.12;
      x.globalAlpha = 0.13;
      x.strokeStyle = mr2 % 2 ? c.accent2 : c.accent;
      x.save();
      x.translate(48 + Math.cos(ang) * (mr + 3), 48 + Math.sin(ang) * (mr + 3));
      x.rotate(ang + Math.PI / 2);
      strokeRune(x, (mr2 + (c.rune || 0)) % 6, 0, 0, 5, 0);
      x.restore();
    }
    x.globalAlpha = 1;

    /* snow / dust */
    x.globalCompositeOperation = "lighter";
    for (var i = 0; i < 30; i++) {
      var px = hash2(i, 1.7) * 96;
      var py = mod(hash2(i, 2.9) * 112 + k * (1.4 + hash2(i, 3.1) * 2.2), 112);
      var sz = 0.22 + hash2(i, 4.3) * 0.6;
      x.globalAlpha = 0.10 + hash2(i, 5.7) * 0.28;
      x.fillStyle = i % 4 === 0 ? c.accent2 : "#cfe4f4";
      x.beginPath(); x.arc(px, py, sz, 0, TAU); x.fill();
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";

    /* ===================== bust ===================== */
    var baleog = id === "baleog", olaf = id === "olaf";

    /* back props */
    if (baleog) {
      x.strokeStyle = "#6b5232";
      x.lineWidth = 2.4;
      x.beginPath();
      x.moveTo(12, 102);
      x.quadraticCurveTo(2, 62, 20, 20);
      x.stroke();
      x.strokeStyle = "rgba(230,240,255,0.35)";
      x.lineWidth = 0.5;
      x.beginPath();
      x.moveTo(12, 102);
      x.quadraticCurveTo(2, 62, 20, 20);
      x.stroke();
      /* arrow fletchings behind the right shoulder */
      x.strokeStyle = "#a88050";
      x.lineWidth = 1.1;
      for (var ar = 0; ar < 3; ar++) {
        x.beginPath();
        x.moveTo(66 + ar * 3.4, 66);
        x.lineTo(72 + ar * 3.4, 40);
        x.stroke();
        x.fillStyle = c.accent;
        x.globalAlpha = 0.6;
        x.beginPath();
        x.moveTo(72 + ar * 3.4, 40);
        x.lineTo(69.6 + ar * 3.4, 45);
        x.lineTo(74 + ar * 3.4, 45);
        x.closePath(); x.fill();
        x.globalAlpha = 1;
      }
    } else if (olaf) {
      x.fillStyle = "#0b1522";
      x.beginPath(); x.arc(14, 74, 24, 0, TAU); x.fill();
      x.strokeStyle = c.accent;
      x.globalAlpha = 0.85;
      x.lineWidth = 1.6;
      x.stroke();
      x.globalAlpha = 0.5;
      x.strokeStyle = c.accent2;
      x.lineWidth = 0.7;
      x.beginPath(); x.arc(14, 74, 18, 0, TAU); x.stroke();
      x.globalAlpha = 1;
      x.fillStyle = c.metal;
      x.beginPath(); x.arc(14, 74, 5, 0, TAU); x.fill();
      x.strokeStyle = c.accent;
      x.globalAlpha = 0.6;
      x.lineWidth = 0.7;
      strokeRune(x, 3, 14, 74, 10, 0.3);
      x.globalAlpha = 1;
    } else {
      /* wolf-pelt over the shoulder */
      x.fillStyle = c.fur;
      x.beginPath();
      x.moveTo(74, 108);
      x.quadraticCurveTo(84, 92, 78, 80);
      x.quadraticCurveTo(72, 84, 70, 94);
      x.closePath();
      x.fill();
      x.strokeStyle = "rgba(0,0,0,0.35)";
      x.lineWidth = 0.5;
      x.stroke();
    }

    /* shoulders / cloak */
    x.fillStyle = c.cloak;
    x.beginPath();
    x.moveTo(-4, 112);
    x.quadraticCurveTo(10, 88, 26, 80);
    x.lineTo(40, 72);
    x.lineTo(56, 72);
    x.lineTo(70, 80);
    x.quadraticCurveTo(86, 88, 100, 112);
    x.closePath();
    x.fill();
    x.strokeStyle = "rgba(0,0,0,0.5)";
    x.lineWidth = 1;
    x.stroke();
    /* torso */
    x.fillStyle = c.cloth;
    x.beginPath();
    x.moveTo(10, 112);
    x.quadraticCurveTo(20, 92, 32, 84);
    x.lineTo(44, 77);
    x.lineTo(52, 77);
    x.lineTo(64, 84);
    x.quadraticCurveTo(76, 92, 86, 112);
    x.closePath();
    x.fill();
    /* tunic panel */
    x.fillStyle = c.cloth2;
    x.globalAlpha = 0.6;
    x.beginPath();
    x.moveTo(22, 112);
    x.lineTo(34, 86);
    x.lineTo(48, 82);
    x.lineTo(48, 112);
    x.closePath();
    x.fill();
    x.globalAlpha = 1;
    /* belt / strap */
    x.strokeStyle = "#0a0d14";
    x.lineWidth = 3.2;
    x.beginPath(); x.moveTo(10, 104); x.quadraticCurveTo(48, 96, 86, 104); x.stroke();
    x.fillStyle = c.metal;
    x.fillRect(43, 98, 10, 9);
    x.fillStyle = c.accent;
    x.globalAlpha = 0.8;
    x.fillRect(45, 100, 6, 5);
    x.globalAlpha = 1;
    /* fur collar */
    x.fillStyle = c.fur;
    x.beginPath();
    x.moveTo(11, 90);
    x.quadraticCurveTo(26, 76, 40, 72);
    x.lineTo(48, 78);
    x.lineTo(56, 72);
    x.quadraticCurveTo(70, 76, 85, 90);
    x.quadraticCurveTo(70, 86, 56, 84);
    x.lineTo(48, 88);
    x.lineTo(40, 84);
    x.quadraticCurveTo(26, 86, 11, 90);
    x.closePath();
    x.fill();
    x.strokeStyle = "rgba(0,0,0,0.35)";
    x.lineWidth = 0.5;
    x.stroke();

    /* neck */
    x.fillStyle = c.skin;
    x.fillRect(42, 64, 12, 14);
    x.fillStyle = "rgba(0,0,0,0.22)";
    x.fillRect(42, 64, 12, 4);

    /* head */
    x.fillStyle = c.skin;
    x.beginPath();
    x.ellipse(48, 46, 15.5, 16.5, 0, 0, TAU);
    x.fill();
    /* ears */
    x.beginPath(); x.ellipse(32.2, 48, 2.6, 4, 0, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(63.8, 48, 2.6, 4, 0, 0, TAU); x.fill();
    /* cheek shadow */
    x.fillStyle = "rgba(60,20,10,0.16)";
    x.beginPath(); x.ellipse(38, 54, 8, 6, 0.3, 0, TAU); x.fill();

    /* beard */
    x.fillStyle = c.beard;
    if (id === "erik") {
      x.beginPath();
      x.moveTo(33, 48);
      x.quadraticCurveTo(33, 64, 48, 66);
      x.quadraticCurveTo(63, 64, 63, 48);
      x.quadraticCurveTo(57, 58, 48, 57);
      x.quadraticCurveTo(39, 58, 33, 48);
      x.closePath();
      x.fill();
      x.strokeStyle = "rgba(0,0,0,0.25)";
      x.lineWidth = 0.5;
      x.beginPath(); x.moveTo(45, 58); x.quadraticCurveTo(48, 62, 51, 58); x.stroke();
    } else if (baleog) {
      x.beginPath();
      x.moveTo(31, 48);
      x.quadraticCurveTo(29, 74, 48, 82);
      x.quadraticCurveTo(67, 74, 65, 48);
      x.quadraticCurveTo(58, 60, 48, 59);
      x.quadraticCurveTo(38, 60, 31, 48);
      x.closePath();
      x.fill();
      /* braid lines */
      x.strokeStyle = "rgba(0,0,0,0.3)";
      x.lineWidth = 0.6;
      for (var br = 0; br < 4; br++) {
        x.beginPath();
        x.moveTo(42 + br * 3.4, 56);
        x.quadraticCurveTo(41 + br * 3.7, 66, 44 + br * 3, 76);
        x.stroke();
      }
    } else {
      x.beginPath();
      x.moveTo(30, 50);
      x.quadraticCurveTo(28, 78, 44, 90);
      x.quadraticCurveTo(52, 92, 56, 88);
      x.quadraticCurveTo(68, 76, 66, 50);
      x.quadraticCurveTo(57, 62, 48, 61);
      x.quadraticCurveTo(39, 62, 30, 50);
      x.closePath();
      x.fill();
      /* moustache */
      x.strokeStyle = c.beard;
      x.lineWidth = 3.4;
      x.beginPath();
      x.moveTo(40, 55);
      x.quadraticCurveTo(48, 59, 56, 55);
      x.stroke();
      /* braids with rings */
      x.fillStyle = c.metal;
      x.strokeStyle = c.beard;
      x.lineWidth = 2.6;
      x.beginPath(); x.moveTo(36, 82); x.quadraticCurveTo(33, 92, 35, 100); x.stroke();
      x.beginPath(); x.moveTo(60, 82); x.quadraticCurveTo(63, 92, 61, 100); x.stroke();
      x.beginPath(); x.arc(35, 101, 2.2, 0, TAU); x.fill();
      x.beginPath(); x.arc(61, 101, 2.2, 0, TAU); x.fill();
    }

    /* face features */
    var eyeY = 45;
    x.fillStyle = "#f3e7d3";
    x.beginPath(); x.ellipse(41, eyeY, 3.1, 2.2, 0, 0, TAU); x.fill();
    x.beginPath(); x.ellipse(55, eyeY, 3.1, 2.2, 0, 0, TAU); x.fill();
    x.fillStyle = c.accent;
    x.beginPath(); x.arc(41.8, eyeY + 0.2, 1.5, 0, TAU); x.fill();
    x.beginPath(); x.arc(55.5, eyeY + 0.2, 1.5, 0, TAU); x.fill();
    x.fillStyle = "#0a0a10";
    x.beginPath(); x.arc(42, eyeY + 0.2, 0.7, 0, TAU); x.fill();
    x.beginPath(); x.arc(55.7, eyeY + 0.2, 0.7, 0, TAU); x.fill();
    x.fillStyle = "rgba(255,255,255,0.9)";
    x.beginPath(); x.arc(41.3, eyeY - 0.5, 0.35, 0, TAU); x.fill();
    x.beginPath(); x.arc(55, eyeY - 0.5, 0.35, 0, TAU); x.fill();
    /* brows */
    x.strokeStyle = c.beard;
    x.lineWidth = 2;
    x.beginPath();
    x.moveTo(37, 40.5); x.quadraticCurveTo(41, 38.4, 45, 40);
    x.moveTo(51, 40); x.quadraticCurveTo(55, 38.4, 59, 40.5);
    x.stroke();
    /* nose */
    x.fillStyle = "rgba(120,60,40,0.28)";
    x.beginPath();
    x.moveTo(46, 48);
    x.lineTo(49.6, 55);
    x.lineTo(45.4, 56);
    x.closePath();
    x.fill();
    x.fillStyle = "rgba(255,235,210,0.5)";
    x.fillRect(46.4, 47, 1.2, 5.4);
    /* mouth line (mostly under the beard) */
    x.strokeStyle = "rgba(50,20,12,0.5)";
    x.lineWidth = 0.8;
    x.beginPath(); x.moveTo(44, 59); x.lineTo(52, 59); x.stroke();

    /* eye glow */
    x.globalCompositeOperation = "lighter";
    glow(x, 41.8, eyeY + 0.2, 4.4, c.accent, 0.28);
    glow(x, 55.5, eyeY + 0.2, 4.4, c.accent, 0.28);
    x.globalCompositeOperation = "source-over";

    /* ---- helmet ---- */
    if (id === "erik") {
      x.fillStyle = c.metalDark;
      x.beginPath();
      x.arc(48, 38, 17.2, Math.PI * 1.02, Math.PI * 1.98);
      x.lineTo(65.2, 36);
      x.lineTo(30.8, 36);
      x.closePath();
      x.fill();
      x.fillStyle = c.metal;
      x.beginPath();
      x.arc(48, 37, 15.4, Math.PI * 1.05, Math.PI * 1.92);
      x.closePath();
      x.fill();
      x.fillStyle = c.metalDark;
      x.fillRect(30.6, 34.4, 34.8, 5.4);
      x.fillStyle = c.metal;
      x.fillRect(31, 34.8, 34, 1.2);
      x.fillStyle = c.accent;
      x.globalAlpha = 0.65;
      x.fillRect(31, 38.6, 34, 1);
      x.globalAlpha = 1;
      /* central ridge */
      x.fillStyle = "rgba(255,255,255,0.16)";
      x.fillRect(46.6, 20, 2.8, 15);
      /* rivets */
      x.fillStyle = "#e8eef8";
      for (var rv = 0; rv < 4; rv++) {
        x.beginPath(); x.arc(33 + rv * 10, 38.4, 0.7, 0, TAU); x.fill();
      }
      /* horns */
      var horn = function (sx, dirSign) {
        x.fillStyle = "#e6d8bc";
        x.beginPath();
        x.moveTo(sx, 33);
        x.quadraticCurveTo(sx + dirSign * 13, 26, sx + dirSign * 15, 10);
        x.quadraticCurveTo(sx + dirSign * 10, 15, sx + dirSign * 7, 18);
        x.quadraticCurveTo(sx + dirSign * 5, 25, sx, 30);
        x.closePath();
        x.fill();
        x.strokeStyle = "rgba(90,60,30,0.45)";
        x.lineWidth = 0.6;
        x.stroke();
        x.strokeStyle = "rgba(255,250,235,0.75)";
        x.lineWidth = 0.8;
        x.beginPath();
        x.moveTo(sx + dirSign * 0.5, 31.6);
        x.quadraticCurveTo(sx + dirSign * 11, 24, sx + dirSign * 13.6, 12);
        x.stroke();
      };
      horn(32.4, -1);
      horn(63.6, 1);
    } else if (baleog) {
      x.fillStyle = c.metalDark;
      x.beginPath();
      x.moveTo(30.6, 36);
      x.quadraticCurveTo(32, 20, 48, 10);
      x.quadraticCurveTo(64, 20, 65.4, 36);
      x.closePath();
      x.fill();
      x.fillStyle = c.metal;
      x.beginPath();
      x.moveTo(32, 34.6);
      x.quadraticCurveTo(34, 21, 48, 12.4);
      x.quadraticCurveTo(62, 21, 64, 34.6);
      x.closePath();
      x.fill();
      /* brow band */
      x.fillStyle = c.metalDark;
      x.fillRect(30.4, 33.4, 35.2, 5.6);
      x.strokeStyle = c.metal;
      x.lineWidth = 0.8;
      x.beginPath(); x.moveTo(31, 34.4); x.lineTo(65, 34.4); x.stroke();
      /* nose guard */
      x.fillStyle = c.metal;
      x.beginPath();
      x.moveTo(45.4, 34.6);
      x.lineTo(50.6, 34.6);
      x.lineTo(49.4, 56);
      x.lineTo(46.6, 56);
      x.closePath();
      x.fill();
      x.strokeStyle = "rgba(0,0,0,0.3)";
      x.lineWidth = 0.5;
      x.stroke();
      x.fillStyle = c.accent;
      x.globalAlpha = 0.5;
      x.fillRect(47.4, 36, 1.4, 17);
      x.globalAlpha = 1;
      /* rivets */
      x.fillStyle = "#e8eef8";
      for (var rv2 = 0; rv2 < 3; rv2++) {
        x.beginPath(); x.arc(35 + rv2 * 13, 36.2, 0.7, 0, TAU); x.fill();
      }
      /* top spike */
      x.fillStyle = c.metal;
      x.beginPath();
      x.moveTo(47, 12); x.lineTo(48.4, 4.4); x.lineTo(50, 12);
      x.closePath(); x.fill();
    } else {
      x.fillStyle = c.metalDark;
      x.beginPath();
      x.arc(48, 36, 17.6, Math.PI * 0.98, Math.PI * 2.02);
      x.closePath();
      x.fill();
      x.fillStyle = c.metal;
      x.beginPath();
      x.arc(48, 35.4, 15.6, Math.PI * 1.02, Math.PI * 1.98);
      x.closePath();
      x.fill();
      /* brow band */
      x.fillStyle = c.metalDark;
      x.fillRect(30.4, 32.6, 35.2, 6);
      x.fillStyle = c.metal;
      x.fillRect(31, 33.2, 34, 1.2);
      /* cheek guards */
      x.fillStyle = c.metal;
      x.beginPath();
      x.moveTo(31.4, 36); x.lineTo(37.4, 36); x.lineTo(36, 56); x.lineTo(31.8, 52);
      x.closePath(); x.fill();
      x.beginPath();
      x.moveTo(64.6, 36); x.lineTo(58.6, 36); x.lineTo(60, 56); x.lineTo(64.2, 52);
      x.closePath(); x.fill();
      /* nose guard */
      x.fillStyle = c.metalDark;
      x.beginPath();
      x.moveTo(45.6, 36); x.lineTo(50.4, 36); x.lineTo(49, 51); x.lineTo(47, 51);
      x.closePath(); x.fill();
      x.fillStyle = c.accent;
      x.globalAlpha = 0.5;
      x.fillRect(47.8, 37, 1.2, 12);
      x.globalAlpha = 1;
      /* rivets */
      x.fillStyle = "#e8eef8";
      for (var rv3 = 0; rv3 < 4; rv3++) {
        x.beginPath(); x.arc(34 + rv3 * 9.4, 35.4, 0.75, 0, TAU); x.fill();
      }
      /* little crown ridge */
      x.strokeStyle = "rgba(255,255,255,0.18)";
      x.lineWidth = 1.6;
      x.beginPath(); x.arc(48, 34, 12.4, Math.PI * 1.12, Math.PI * 1.88); x.stroke();
    }


    /* rim light (light from upper right) */
    x.strokeStyle = c.accent;
    x.globalAlpha = 0.85;
    x.lineWidth = 1.1;
    x.beginPath(); x.arc(48, 37, 16.4, -1.15, -0.15); x.stroke();
    x.globalAlpha = 0.55;
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(64, 58);
    x.quadraticCurveTo(70, 76, 82, 94);
    x.stroke();
    x.globalAlpha = 0.7;
    x.lineWidth = 0.9;
    x.beginPath(); x.moveTo(62, 45); x.quadraticCurveTo(64, 52, 60, 58); x.stroke();
    x.globalAlpha = 1;

    /* foreground sparkles */
    x.globalCompositeOperation = "lighter";
    for (var sp = 0; sp < 4; sp++) {
      var sph = k * 1.4 + sp * 2.2;
      var spx = 48 + Math.cos(sph) * (30 + sp * 5);
      var spy = 54 + Math.sin(sph * 1.3) * (26 + sp * 3);
      x.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(k * 3 + sp));
      x.fillStyle = "#ffffff";
      x.fillRect(spx - 0.9, spy - 0.15, 1.8, 0.3);
      x.fillRect(spx - 0.15, spy - 0.9, 0.3, 1.8);
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";

    /* frame vignette */
    var vg = x.createRadialGradient(48, 50, 26, 48, 56, 74);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(2,3,8,0.55)");
    x.fillStyle = vg;
    x.fillRect(0, 0, 96, 112);
  }

  /* ================================================================= TITLE */
  function buildTitleScene(canvas) {
    var cv = makeCanvas(canvas.width, canvas.height);
    var x = cv.getContext("2d");
    var sc = canvas.width / W, sy = canvas.height / H;
    x.setTransform(sc, 0, 0, sy, 0, 0);

    /* sky */
    var g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#03050c");
    g.addColorStop(0.32, "#071120");
    g.addColorStop(0.58, "#0a2033");
    g.addColorStop(0.7, "#0c2a3c");
    g.addColorStop(1, "#040a12");
    x.fillStyle = g;
    x.fillRect(0, 0, W, H);

    /* stars */
    for (var i = 0; i < 170; i++) {
      var sx = hash2(i, 1.3) * W;
      var sy2 = hash2(i, 2.7) * 150;
      var sr = 0.2 + hash2(i, 3.9) * 0.75;
      x.globalAlpha = 0.18 + hash2(i, 5.1) * 0.7;
      x.fillStyle = i % 7 === 0 ? "#cfe8ff" : "#e8f2ff";
      x.beginPath(); x.arc(sx, sy2, sr, 0, TAU); x.fill();
      if (sr > 0.75) {
        x.globalAlpha *= 0.35;
        x.fillRect(sx - sr * 3.2, sy2 - 0.2, sr * 6.4, 0.4);
        x.fillRect(sx - 0.2, sy2 - sr * 3.2, 0.4, sr * 6.4);
      }
    }
    x.globalAlpha = 1;

    /* moon */
    x.globalCompositeOperation = "lighter";
    blob(x, 316, 34, 42, "#8fd8ff", 0.20);
    x.globalCompositeOperation = "source-over";
    x.fillStyle = "#eaf6ff";
    x.globalAlpha = 0.9;
    x.beginPath(); x.arc(316, 34, 11.5, 0, TAU); x.fill();
    x.globalAlpha = 0.24;
    x.fillStyle = "#9fb8cc";
    x.beginPath(); x.arc(312, 30, 2.4, 0, TAU); x.arc(320, 37, 1.8, 0, TAU); x.arc(318, 29, 1.2, 0, TAU); x.fill();
    x.globalAlpha = 1;

    /* distant aurora haze */
    x.globalCompositeOperation = "lighter";
    blob(x, 170, 52, 150, "#2a9a8a", 0.14);
    blob(x, 290, 44, 130, "#5a4aa8", 0.13);
    x.globalCompositeOperation = "source-over";

    /* far mountains */
    var mpts = [];
    for (var m = 0; m <= 10; m++) mpts.push(W * m / 10, 138 + hash2(m, 2.2) * 22 - (m % 3 === 0 ? 16 : 0));
    x.beginPath();
    x.moveTo(0, 168);
    for (var mi = 0; mi < mpts.length; mi += 2) x.lineTo(mpts[mi], mpts[mi + 1]);
    x.lineTo(W, 168);
    x.closePath();
    x.fillStyle = "#04101a";
    x.globalAlpha = 0.96;
    x.fill();
    x.globalAlpha = 1;
    /* snow caps on the peaks */
    for (var mc = 1; mc <= 10; mc++) {
      var capX = mpts[mc * 2], capY = mpts[mc * 2 + 1];
      var prevY = mpts[(mc - 1) * 2 + 1], nextY = mpts[(mc + 1) * 2 + 1];
      if (capY < prevY && capY < nextY) {
        x.fillStyle = "rgba(207,240,255,0.18)";
        x.beginPath();
        x.moveTo(capX, capY);
        x.lineTo(capX - 10, capY + 9);
        x.lineTo(capX - 3, capY + 6);
        x.lineTo(capX + 1.5, capY + 10);
        x.lineTo(capX + 5, capY + 5.5);
        x.lineTo(capX + 11, capY + 9);
        x.closePath();
        x.fill();
        x.strokeStyle = "rgba(207,240,255,0.26)";
        x.lineWidth = 0.5;
        x.beginPath();
        x.moveTo(capX - 10, capY + 9);
        x.lineTo(capX, capY);
        x.lineTo(capX + 11, capY + 9);
        x.stroke();
      }
    }
    /* near mountains */
    var npts = [];
    for (var n = 0; n <= 7; n++) npts.push(W * n / 7, 158 + hash2(n, 5.5) * 18 - (n % 2 === 0 ? 10 : 0));
    x.beginPath();
    x.moveTo(0, 180);
    for (var ni = 0; ni < npts.length; ni += 2) x.lineTo(npts[ni], npts[ni + 1]);
    x.lineTo(W, 180);
    x.closePath();
    x.fillStyle = "#030b14";
    x.fill();
    x.strokeStyle = "rgba(95,232,210,0.18)";
    x.lineWidth = 0.5;
    x.beginPath();
    for (var ns = 0; ns < npts.length; ns += 2) {
      if (ns === 0) x.moveTo(npts[ns], npts[ns + 1]); else x.lineTo(npts[ns], npts[ns + 1]);
    }
    x.stroke();

    /* sea */
    var sea = x.createLinearGradient(0, 164, 0, H);
    sea.addColorStop(0, "#0b2230");
    sea.addColorStop(0.35, "#071925");
    sea.addColorStop(1, "#03080f");
    x.fillStyle = sea;
    x.fillRect(0, 164, W, H - 164);

    /* horizon glow + haze */
    x.globalCompositeOperation = "lighter";
    var hz = x.createLinearGradient(0, 154, 0, 178);
    hz.addColorStop(0, "rgba(95,240,208,0)");
    hz.addColorStop(0.45, "rgba(95,240,208,0.13)");
    hz.addColorStop(1, "rgba(95,240,208,0)");
    x.fillStyle = hz;
    x.fillRect(0, 154, W, 26);
    for (var hb = 0; hb < 8; hb++) {
      blob(x, hash2(hb, 3.3) * W, 163 + hash2(hb, 4.4) * 8, 30 + hash2(hb, 5.5) * 30, "#8fe8ff", 0.045);
    }
    /* aurora reflection pools (soft, no hard edges) */
    x.save();
    x.translate(176, 178);
    x.scale(1.7, 0.7);
    glow(x, 0, 0, 26, "#5fe8d2", 0.11);
    glow(x, 26, 8, 20, "#8f9cff", 0.08);
    glow(x, -18, 10, 16, "#c9a7ff", 0.06);
    x.restore();
    /* moon glitter */
    for (var mg = 0; mg < 20; mg++) {
      var gx = 300 + (hash2(mg, 2.7) - 0.5) * 44;
      var gy = 170 + hash2(mg, 3.9) * 62;
      var gw = 1 + hash2(mg, 4.1) * 4;
      x.globalAlpha = 0.08 + hash2(mg, 5.3) * 0.2;
      x.fillStyle = "#dff4ff";
      x.fillRect(gx, gy, gw, 0.5);
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";

    /* wave strokes */
    for (var w = 0; w < 70; w++) {
      var wy = 168 + hash2(w, 1.7) * 70;
      var wx = hash2(w, 3.3) * W;
      var wl = 8 + hash2(w, 4.9) * 46;
      x.globalAlpha = 0.05 + hash2(w, 6.1) * 0.13;
      x.strokeStyle = w % 5 === 0 ? "#cfe8ff" : "#5fe8d2";
      x.lineWidth = 0.5;
      x.beginPath();
      x.moveTo(wx, wy);
      x.quadraticCurveTo(wx + wl * 0.5, wy + 0.9, wx + wl, wy);
      x.stroke();
    }
    x.globalAlpha = 1;

    /* ice cliffs framing the scene */
    x.fillStyle = "#050e18";
    x.beginPath();
    x.moveTo(0, 240); x.lineTo(0, 118); x.lineTo(8, 112); x.lineTo(12, 138);
    x.lineTo(20, 126); x.lineTo(26, 164); x.lineTo(18, 190); x.lineTo(24, 240);
    x.closePath(); x.fill();
    x.beginPath();
    x.moveTo(384, 240); x.lineTo(384, 104); x.lineTo(376, 96); x.lineTo(370, 126);
    x.lineTo(360, 112); x.lineTo(356, 156); x.lineTo(366, 186); x.lineTo(360, 240);
    x.closePath(); x.fill();
    x.globalCompositeOperation = "lighter";
    x.strokeStyle = "rgba(143,232,255,0.35)";
    x.lineWidth = 0.7;
    x.beginPath();
    x.moveTo(2, 120); x.lineTo(8, 114); x.lineTo(12, 136); x.lineTo(18, 128); x.lineTo(22, 158);
    x.stroke();
    x.beginPath();
    x.moveTo(382, 106); x.lineTo(376, 98); x.lineTo(371, 122); x.lineTo(362, 116); x.lineTo(358, 152);
    x.stroke();
    x.globalCompositeOperation = "source-over";

    /* floating ice shards */
    for (var sh = 0; sh < 9; sh++) {
      var shx = hash2(sh, 7.1) * W, shy = 190 + hash2(sh, 8.3) * 44;
      var shw = 3 + hash2(sh, 9.4) * 9, shh = 1.4 + hash2(sh, 10.2) * 3.4;
      x.fillStyle = "#08141f";
      x.beginPath();
      x.moveTo(shx - shw, shy); x.lineTo(shx, shy - shh);
      x.lineTo(shx + shw, shy + 0.6); x.lineTo(shx, shy + shh * 0.8);
      x.closePath(); x.fill();
      x.strokeStyle = "rgba(143,232,255,0.30)";
      x.lineWidth = 0.4;
      x.beginPath(); x.moveTo(shx, shy - shh); x.lineTo(shx + shw, shy + 0.6); x.stroke();
    }

    /* cinematic vignette */
    var vg = x.createRadialGradient(W * 0.55, H * 0.55, 50, W * 0.5, H * 0.5, 250);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(2,3,8,0.55)");
    x.fillStyle = vg;
    x.fillRect(0, 0, W, H);
    return cv;
  }

  function buildSoftAurora() {
    var cv = makeCanvas(AUR_W, 200), x = cv.getContext("2d");
    x.globalCompositeOperation = "lighter";
    x.lineCap = "round";
    var colors = ["#3fe6c0", "#6f8cff", "#c9a7ff"];
    var N = 72;
    for (var r = 0; r < colors.length; r++) {
      var color = colors[r];
      var baseY = 54 + r * 26 + hash(r + 3) * 24;
      var a1 = 16 + r * 7, a2 = 7 + hash(r + 5) * 9;
      var k1 = 2 + r, k2 = 6 + r * 2;
      var ph1 = hash(r + 7) * TAU, ph2 = hash(r + 9) * TAU;
      var passes = [[64, 0.018], [34, 0.03], [16, 0.045], [6, 0.05]];
      for (var pi = 0; pi < passes.length; pi++) {
        x.beginPath();
        for (var i = 0; i <= N; i++) {
          var px = i / N * AUR_W;
          var py = baseY + a1 * Math.sin(TAU * k1 * i / N + ph1) + a2 * Math.sin(TAU * k2 * i / N + ph2);
          if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.lineWidth = passes[pi][0];
        x.strokeStyle = rgba(color, passes[pi][1]);
        x.stroke();
      }
      /* vertical veils */
      for (var c = 0; c < N; c += 3) {
        var cx = c / N * AUR_W;
        var cy = baseY + a1 * Math.sin(TAU * k1 * c / N + ph1) + a2 * Math.sin(TAU * k2 * c / N + ph2);
        var len = 50 + hash(c + r * 11) * 70;
        var lg = x.createLinearGradient(0, cy - 10, 0, cy + len);
        lg.addColorStop(0, rgba(color, 0.05));
        lg.addColorStop(0.35, rgba(color, 0.055));
        lg.addColorStop(1, rgba(color, 0));
        x.strokeStyle = lg;
        x.lineWidth = 9;
        x.beginPath();
        x.moveTo(cx, cy - 8);
        x.lineTo(cx + 3, cy + len);
        x.stroke();
      }
    }
    return cv;
  }

  function titleAuroraSlice(x, au, off, dy, h, alpha) {
    off = mod(off, AUR_W);
    var w1 = Math.min(W, AUR_W - off);
    x.globalAlpha = alpha;
    if (w1 > 0) x.drawImage(au, off, 0, w1, au.height, 0, dy, w1, h);
    var rest = W - w1;
    if (rest > 0) x.drawImage(au, 0, 0, Math.min(rest, AUR_W), au.height, w1, dy, Math.min(rest, AUR_W), h);
  }

  function drawTitleAurora(x, k) {
    if (!G.titleAurora) G.titleAurora = buildSoftAurora();
    var au = G.titleAurora;
    x.globalCompositeOperation = "lighter";
    titleAuroraSlice(x, au, k * 1.5, -4, 178, 0.62);
    titleAuroraSlice(x, au, k * 0.8 + 380, 12, 150, 0.3);
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
  }


  function drawTitleRuneCircle(x, k) {
    var cx = 186, cy = 82, r = 60;
    x.save();
    x.translate(cx, cy);
    x.rotate(Math.sin(k * 0.07) * 0.05 + k * 0.012);
    x.globalCompositeOperation = "lighter";
    x.strokeStyle = "#8fd8ff";
    x.globalAlpha = 0.10;
    x.lineWidth = 0.7;
    x.beginPath(); x.arc(0, 0, r, 0, TAU); x.stroke();
    x.globalAlpha = 0.07;
    x.lineWidth = 1.4;
    x.beginPath(); x.arc(0, 0, r - 5, 0, TAU); x.stroke();
    x.strokeStyle = "#c9a7ff";
    x.globalAlpha = 0.10;
    x.lineWidth = 0.55;
    x.setLineDash([2, 5]);
    x.lineDashOffset = -k * 6;
    x.beginPath(); x.arc(0, 0, r + 6, 0, TAU); x.stroke();
    x.setLineDash([]);
    x.strokeStyle = "#cfe8ff";
    for (var i = 0; i < 8; i++) {
      var a = i * 0.785;
      x.save();
      x.rotate(a);
      x.translate(0, -r);
      x.globalAlpha = 0.14;
      x.lineWidth = 0.7;
      strokeRune(x, (i * 2 + 1) % 6, 0, 0, 9, 0);
      x.restore();
      x.globalAlpha = 0.10;
      x.lineWidth = 0.5;
      x.beginPath();
      x.moveTo(Math.cos(a) * (r - 9), Math.sin(a) * (r - 9));
      x.lineTo(Math.cos(a) * (r + 3), Math.sin(a) * (r + 3));
      x.stroke();
    }
    x.globalAlpha = 0.06;
    x.strokeStyle = "#8fd8ff";
    x.lineWidth = 0.6;
    for (var v = 0; v < 3; v++) {
      x.save();
      x.rotate(v * 2.094 + k * 0.05);
      x.beginPath();
      x.moveTo(0, -r * 0.55);
      x.lineTo(r * 0.48, r * 0.28);
      x.lineTo(-r * 0.48, r * 0.28);
      x.closePath();
      x.stroke();
      x.restore();
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
    x.restore();
  }

  function drawTitleShip(x, k) {
    var bob = Math.sin(k * 0.7) * 1.4;
    var roll = Math.sin(k * 0.5 + 1.2) * 0.022;
    var cx = 158, cy = 170 + bob;

    /* water reflection */
    x.globalCompositeOperation = "lighter";
    x.save();
    x.translate(cx, cy + 14);
    x.scale(1.6, 0.5);
    glow(x, 0, 0, 30, "#5fe8d2", 0.10);
    x.restore();
    x.strokeStyle = "#5fe8d2";
    x.globalAlpha = 0.16;
    x.lineWidth = 0.6;
    for (var wl = 0; wl < 5; wl++) {
      var wy = cy + 8 + wl * 3;
      var ww = 26 - wl * 4 + Math.sin(k * 1.6 + wl) * 3;
      x.beginPath();
      x.moveTo(cx - ww, wy);
      x.lineTo(cx + ww, wy);
      x.stroke();
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";

    x.save();
    x.translate(cx, cy);
    x.rotate(roll);

    /* hull */
    x.fillStyle = "#081120";
    x.beginPath();
    x.moveTo(-32, -1);
    x.lineTo(27, -1);
    x.quadraticCurveTo(18, 9, -4, 10);
    x.quadraticCurveTo(-22, 9, -34, 1);
    x.closePath();
    x.fill();
    x.strokeStyle = "rgba(95,232,210,0.55)";
    x.lineWidth = 0.7;
    x.beginPath();
    x.moveTo(-32, -0.6);
    x.lineTo(27, -0.6);
    x.stroke();

    /* dragon prow */
    x.fillStyle = "#081120";
    x.beginPath();
    x.moveTo(25, -2);
    x.quadraticCurveTo(31, -9, 32, -15);
    x.lineTo(29, -18);
    x.lineTo(39, -20);
    x.lineTo(36, -15.5);
    x.lineTo(41, -12.5);
    x.lineTo(33.5, -10.5);
    x.quadraticCurveTo(34, -6, 31, -2);
    x.closePath();
    x.fill();
    x.strokeStyle = "rgba(95,232,210,0.7)";
    x.lineWidth = 0.6;
    x.stroke();
    x.globalCompositeOperation = "lighter";
    glow(x, 37.5, -16, 2.4, "#ff9a5a", 0.85);
    x.globalCompositeOperation = "source-over";
    x.fillStyle = "#ffcf9a";
    x.beginPath(); x.arc(36.6, -16.2, 0.55, 0, TAU); x.fill();

    /* stern curl */
    x.strokeStyle = "#0b1524";
    x.lineWidth = 2.2;
    x.lineCap = "round";
    x.beginPath();
    x.moveTo(-31, -1);
    x.quadraticCurveTo(-38, -8, -32, -13);
    x.quadraticCurveTo(-28, -15, -28, -11);
    x.stroke();
    x.strokeStyle = "rgba(95,232,210,0.4)";
    x.lineWidth = 0.5;
    x.stroke();

    /* row of shields */
    var shieldCols = ["#ff8a4d", "#5af0a8", "#6fc0ff"];
    for (var s = 0; s < 7; s++) {
      var sx = -22 + s * 7.2;
      x.fillStyle = "#0a1420";
      x.beginPath(); x.arc(sx, -3.2, 2.7, 0, TAU); x.fill();
      x.strokeStyle = shieldCols[s % 3];
      x.globalAlpha = 0.85;
      x.lineWidth = 0.55;
      x.stroke();
      x.globalAlpha = 0.5;
      x.fillStyle = shieldCols[s % 3];
      x.beginPath(); x.arc(sx, -3.2, 0.7, 0, TAU); x.fill();
      x.globalAlpha = 1;
    }

    /* mast + yard */
    x.strokeStyle = "#16303a";
    x.lineWidth = 1.7;
    x.beginPath(); x.moveTo(-4, -2); x.lineTo(-4, -44); x.stroke();
    x.lineWidth = 1.1;
    x.beginPath(); x.moveTo(-21, -36); x.lineTo(15, -36); x.stroke();
    x.strokeStyle = "rgba(95,232,210,0.35)";
    x.lineWidth = 0.4;
    x.beginPath(); x.moveTo(-4, -2); x.lineTo(-4, -44); x.stroke();

    /* sail */
    x.fillStyle = "#07131d";
    x.beginPath();
    x.moveTo(-19, -36);
    x.quadraticCurveTo(-2, -37, 13, -36);
    x.quadraticCurveTo(15, -25, 10, -13);
    x.quadraticCurveTo(-2, -11, -14, -13);
    x.quadraticCurveTo(-19, -24, -19, -36);
    x.closePath();
    x.fill();
    x.strokeStyle = "rgba(143,216,255,0.55)";
    x.lineWidth = 0.6;
    x.stroke();
    /* sail seams */
    x.strokeStyle = "rgba(143,216,255,0.10)";
    x.lineWidth = 0.4;
    for (var sm = 0; sm < 4; sm++) {
      x.beginPath();
      x.moveTo(-16 + sm * 8, -34);
      x.lineTo(-13 + sm * 7, -14);
      x.stroke();
    }
    /* glowing rune on the sail */
    x.save();
    x.translate(-2, -25);
    x.strokeStyle = "#8fe8ff";
    x.globalAlpha = 0.95;
    x.lineWidth = 1;
    x.shadowColor = "#5fe8d2";
    x.shadowBlur = 10;
    strokeRune(x, 0, 0, 0, 15, 0);
    x.shadowBlur = 0;
    x.globalAlpha = 1;
    x.restore();

    /* pennant */
    x.fillStyle = "#ff8a4d";
    x.beginPath();
    x.moveTo(-4, -44);
    x.lineTo(2, -41.4);
    x.lineTo(-4, -38.6);
    x.closePath();
    x.fill();

    /* three tiny vikings on deck */
    var crew = [
      { x: -13, c: "#ff8a4d" },
      { x: -4.6, c: "#5af0a8" },
      { x: 3.6, c: "#6fc0ff" }
    ];
    for (var v = 0; v < 3; v++) {
      var vx = crew[v].x, vy = -5.6;
      x.fillStyle = "#061019";
      x.beginPath();
      x.ellipse(vx, vy - 1.6, 1.5, 3.1, 0, 0, TAU);
      x.fill();
      x.beginPath(); x.arc(vx, vy - 5.2, 1.15, 0, TAU); x.fill();
      x.strokeStyle = crew[v].c;
      x.globalAlpha = 0.9;
      x.lineWidth = 0.45;
      x.beginPath(); x.arc(vx, vy - 5.2, 1.25, -2.4, -0.3); x.stroke();
      x.beginPath(); x.moveTo(vx + 1.1, vy - 3); x.lineTo(vx + 2.2, vy - 0.6); x.stroke();
      x.globalAlpha = 1;
    }

    /* oars */
    x.strokeStyle = "#1c3540";
    x.lineWidth = 0.7;
    for (var o = 0; o < 4; o++) {
      var ox = -18 + o * 11;
      x.beginPath();
      x.moveTo(ox, 4);
      x.lineTo(ox - 5, 12);
      x.stroke();
      x.globalCompositeOperation = "lighter";
      glow(x, ox - 5, 12, 2.4, "#8fe8ff", 0.16);
      x.globalCompositeOperation = "source-over";
    }

    /* stern lantern */
    x.globalCompositeOperation = "lighter";
    glow(x, -27, -9, 4.6, "#ffb066", 0.5);
    x.globalCompositeOperation = "source-over";
    x.fillStyle = "#ffcf9a";
    x.beginPath(); x.arc(-27, -9, 0.9, 0, TAU); x.fill();

    x.restore();
  }

  function drawTitleSnow(x, k) {
    x.globalCompositeOperation = "lighter";
    for (var i = 0; i < 80; i++) {
      var px = mod(hash2(i, 3.1) * W + Math.sin(k * (0.3 + hash2(i, 4.2) * 0.4) + i) * 7 + k * (1.4 + hash2(i, 5.3) * 2.2), W);
      var py = mod(hash2(i, 6.4) * H + k * (3 + hash2(i, 7.5) * 7), H);
      var sz = 0.25 + hash2(i, 8.6) * 0.7;
      x.globalAlpha = 0.16 + hash2(i, 9.7) * 0.35;
      x.fillStyle = i % 5 === 0 ? "#c9a7ff" : "#dff4ff";
      x.beginPath(); x.arc(px, py, sz, 0, TAU); x.fill();
    }
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
  }

  function drawTitleMist(x, k) {
    var fog = getFog("ice");
    x.globalCompositeOperation = "lighter";
    var off = mod(k * 1.8, 512);
    var w1 = Math.min(W, 512 - off);
    x.globalAlpha = 0.14;
    if (w1 > 0) x.drawImage(fog, off, 0, w1, 128, 0, H - 40, w1, 46);
    var rest = W - w1;
    if (rest > 0) x.drawImage(fog, 0, 0, Math.min(rest, 512), 128, w1, H - 40, Math.min(rest, 512), 46);
    var off2 = mod(120 + k * 0.9, 512);
    var w2 = Math.min(W, 512 - off2);
    x.globalAlpha = 0.09;
    if (w2 > 0) x.drawImage(fog, off2, 30, w2, 98, 0, H - 62, w2, 36);
    var rest2 = W - w2;
    if (rest2 > 0) x.drawImage(fog, 0, 30, Math.min(rest2, 512), 98, w2, H - 62, Math.min(rest2, 512), 36);
    x.globalAlpha = 1;
    x.globalCompositeOperation = "source-over";
  }

  function drawTitle(canvas, t) {
    if (!canvas) return;
    if (canvas.width !== 1152) canvas.width = 1152;
    if (canvas.height !== 720) canvas.height = 720;
    var key = canvas.width + "x" + canvas.height;
    if (G.titleKey !== key || !G.title) {
      G.title = buildTitleScene(canvas);
      G.titleKey = key;
    }
    var x = canvas.getContext("2d");
    var k = t || 0;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(G.title, 0, 0);
    x.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    drawTitleAurora(x, k);
    drawTitleRuneCircle(x, k);
    drawTitleShip(x, k);
    drawTitleSnow(x, k);
    drawTitleMist(x, k);
  }

  /* ================================================================== INIT */
  function init(canvas) {
    if (!canvas) return;
    G.canvas = canvas;
    G.ctx = canvas.getContext("2d");
    G.sx = canvas.width / W;
    G.sy = canvas.height / H;
    G.ctx.imageSmoothingEnabled = true;
    if ("imageSmoothingQuality" in G.ctx) G.ctx.imageSmoothingQuality = "low";
    G.terrain = null;
    G.world = null;
    G.vignette = null;
    G.deadEnemies = {};
    G.portalFrames = null;
  }

  /* merge into any existing namespace so hot-injected rebuilds keep references */
  var API = window.LV_MODERN || {};
  API.init = init;
  API.draw = draw;
  API.drawPortrait = drawPortrait;
  API.drawTitle = drawTitle;
  window.LV_MODERN = API;
})();
