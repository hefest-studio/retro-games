/* LOST VIKINGS — src/render-retro.js
   8-bit NES/Amiga pixel-art renderer. Owner: retro-artist.
   window.LV_RETRO = { init(canvas), draw(view), drawPortrait(canvas,id,t), drawTitle(canvas,t) }
   ES2019, IIFE, no external assets, no game logic, never mutates `view`. */
(function () {
  "use strict";

  var MW = 384, MH = 240, TS = 16, TW = 24, TH = 15;

  /* ───────────────────────── helpers ───────────────────────── */

  function mk(w, h) { var c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  function ctx2(c) { var g = c.getContext("2d"); if (g) g.imageSmoothingEnabled = false; return g; }
  function rr(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

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
  function mix(a, b, k) {
    var A = hx(a), B = hx(b);
    return rgbHex(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k);
  }
  function shade(hex, f) {
    var c = hx(hex);
    if (f >= 1) { var d = (f - 1); return rgbHex(c[0] + (255 - c[0]) * d, c[1] + (255 - c[1]) * d, c[2] + (255 - c[2]) * d); }
    return rgbHex(c[0] * f, c[1] * f, c[2] * f);
  }
  function rng(seed) {
    var s = (seed | 0) >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function hash2(x, y) {
    var n = (x * 374761393 + y * 668265263) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function fillCircle(g, cx, cy, r, col) {
    g.fillStyle = col;
    for (var dy = -r; dy <= r; dy++) {
      var w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.4));
      g.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
    }
  }
  function linePx(g, x0, y0, x1, y1, col, thick) {
    g.fillStyle = col;
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy;
    var t = thick || 1, guard = 0;
    for (;;) {
      g.fillRect(x0, y0, t, t);
      if ((x0 === x1 && y0 === y1) || guard++ > 200) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  /* ───────────────────────── palettes ───────────────────────── */

  var GCOL = { a: "#ffc24d", b: "#69e06e", c: "#5fd0ff", d: "#e878ff" };

  var PAL = {
    cave: {
      sky: ["#05040c", "#0b0918", "#141026", "#1e1836"],
      rock: { hi: "#8f86ab", mid: "#5f5878", lo: "#39344f", cap: "#ab9fc7", spek: "#787092", crack: "#2a2540", deco: "#57d2a6" },
      brick: { hi: "#a07a58", mid: "#75533a", lo: "#4a3222", mort: "#22160f" },
      plank: { hi: "#c09a5c", mid: "#95713c", lo: "#5c4522" },
      spike: { hi: "#e4eaf6", mid: "#9aa3b8", lo: "#535b72" },
      gate: { hi: "#b6c2dc", mid: "#6f7c9c", lo: "#3b4560", frame: "#4a4560", frameHi: "#77708f" },
      accent: "#ffb347", accent2: "#e0742e", mote: "#ffd58a", glow: "rgba(255,170,80,0.13)"
    },
    forge: {
      sky: ["#0d0706", "#1a0c07", "#2a130a", "#3a1a0c"],
      rock: { hi: "#a8795a", mid: "#7a5238", lo: "#4c3020", cap: "#c28e68", spek: "#8f6346", crack: "#2e1a10", deco: "#ff7a2a" },
      brick: { hi: "#c07a44", mid: "#924f28", lo: "#5e3016", mort: "#2a1208" },
      plank: { hi: "#9aa0ac", mid: "#6c727e", lo: "#424852" },
      spike: { hi: "#f0d0a0", mid: "#b8905c", lo: "#6a4c2c" },
      gate: { hi: "#d0b090", mid: "#8a6a44", lo: "#4e3820", frame: "#5a4430", frameHi: "#8a6a4a" },
      accent: "#ff8a2a", accent2: "#ffd070", mote: "#ffcf70", glow: "rgba(255,120,40,0.14)"
    },
    ice: {
      sky: ["#050b16", "#0a1628", "#102440", "#163458"],
      rock: { hi: "#d8f0fb", mid: "#8cc4dd", lo: "#54839f", cap: "#f0fbff", spek: "#a8d8ea", crack: "#3c6a86", deco: "#ffffff" },
      brick: { hi: "#c8e8f6", mid: "#90c2d8", lo: "#588aa4", mort: "#2c5468" },
      plank: { hi: "#cfeaf4", mid: "#9fc4d2", lo: "#5f8494" },
      spike: { hi: "#ffffff", mid: "#c0e0ee", lo: "#7a9cb0" },
      gate: { hi: "#e0f4ff", mid: "#8ec6e0", lo: "#4a7a96", frame: "#5686a0", frameHi: "#9ccade" },
      accent: "#66e0ff", accent2: "#b0f4ff", mote: "#e8faff", glow: "rgba(120,220,255,0.13)"
    },
    forest: {
      sky: ["#050e08", "#0a1a10", "#102818", "#163620"],
      rock: { hi: "#93a870", mid: "#6b7d4e", lo: "#445234", cap: "#a8bd82", spek: "#7c8f5c", crack: "#2c3820", deco: "#8fe05a" },
      brick: { hi: "#b08a5a", mid: "#84663c", lo: "#564024", mort: "#2a1e10" },
      plank: { hi: "#b08a52", mid: "#84622e", lo: "#503b1a" },
      spike: { hi: "#e0dcc0", mid: "#b0a882", lo: "#6e6448" },
      gate: { hi: "#c0c8a8", mid: "#788266", lo: "#424a36", frame: "#4c5438", frameHi: "#7c8662" },
      accent: "#a8e85e", accent2: "#e8d070", mote: "#c8f080", glow: "rgba(140,230,100,0.12)"
    },
    castle: {
      sky: ["#070814", "#0d1024", "#141a34", "#1c2444"],
      rock: { hi: "#b4b4c8", mid: "#84849c", lo: "#54546c", cap: "#c8c8dc", spek: "#9a9ab0", crack: "#3a3a50", deco: "#6a8ad0" },
      brick: { hi: "#b09484", mid: "#86685a", lo: "#584238", mort: "#2a1e1a" },
      plank: { hi: "#a8845c", mid: "#7c5c38", lo: "#4c3820" },
      spike: { hi: "#d8dce8", mid: "#a0a8b8", lo: "#626a80" },
      gate: { hi: "#d2d6e6", mid: "#8a90aa", lo: "#4c5268", frame: "#585a72", frameHi: "#8c90aa" },
      accent: "#ffcf5a", accent2: "#e86060", mote: "#ffe08a", glow: "rgba(255,210,110,0.12)"
    },
    void: {
      sky: ["#030208", "#080410", "#0f071c", "#180b2c"],
      rock: { hi: "#7a5f9a", mid: "#4e3a68", lo: "#2c2040", cap: "#9478b6", spek: "#5f487e", crack: "#170d22", deco: "#e060ff" },
      brick: { hi: "#7a4f8e", mid: "#543263", lo: "#331a3e", mort: "#180a22" },
      plank: { hi: "#8a6ab0", mid: "#62468a", lo: "#3c2860" },
      spike: { hi: "#e8c0ff", mid: "#b080e0", lo: "#6a4498" },
      gate: { hi: "#d8b8f8", mid: "#8a62b0", lo: "#4a2e6a", frame: "#5e3c80", frameHi: "#9468bc" },
      accent: "#e060ff", accent2: "#60e0ff", mote: "#f0a8ff", glow: "rgba(200,90,255,0.14)"
    }
  };
  function pal(theme) { return PAL[theme] || PAL.cave; }

  /* ───────────────────────── tile sprites (cached per theme) ───────────────────────── */

  var tileCache = {};

  function buildStone(p, v, seed) {
    var c = mk(16, 16), g = ctx2(c), r = rng(seed + v * 7919);
    rr(g, 0, 0, 16, 16, p.rock.mid);
    /* large soft chunks give the wall a rocky unevenness */
    if (v === 0) {
      rr(g, 2, 3, 5, 4, shade(p.rock.mid, 1.09));
      rr(g, 9, 8, 5, 5, shade(p.rock.mid, 0.9));
      rr(g, 2, 9, 3, 2, shade(p.rock.mid, 0.92));
    } else if (v === 1) {
      rr(g, 1, 8, 6, 5, shade(p.rock.mid, 0.88));
      rr(g, 8, 2, 6, 4, shade(p.rock.mid, 1.07));
      rr(g, 10, 9, 4, 3, shade(p.rock.mid, 1.05));
    } else {
      rr(g, 3, 5, 5, 3, shade(p.rock.mid, 0.9));
      rr(g, 9, 10, 5, 3, shade(p.rock.mid, 1.06));
    }
    /* speckles: only 2–3 muted pixels, no line work (walls must stay calm) */
    var n = 2 + ((r() * 2) | 0), i, x, y;
    for (i = 0; i < n; i++) {
      x = 2 + ((r() * 11) | 0); y = 2 + ((r() * 10) | 0);
      rr(g, x, y, 1, 1, r() < 0.45 ? p.rock.spek : p.rock.lo);
    }
    /* bottom / right ambient shadow */
    rr(g, 0, 15, 16, 1, p.rock.lo);
    rr(g, 15, 1, 1, 14, shade(p.rock.lo, 1.12));
    if (v === 1) {
      /* subtle fissure (low contrast, short) */
      var fc = mix(p.rock.mid, p.rock.lo, 0.55);
      rr(g, 5, 4, 1, 1, fc); rr(g, 6, 5, 1, 1, fc); rr(g, 7, 6, 1, 1, fc);
    } else if (v === 2) {
      /* sparse theme decoration (lichen / crystal / ember / moss / vein) */
      var d = p.rock.deco;
      rr(g, 10, 12, 2, 1, d);
      rr(g, 9, 13, 1, 1, shade(d, 0.7));
      rr(g, 12, 11, 1, 1, shade(d, 0.7));
      rr(g, 3, 2, 1, 1, shade(d, 0.55));
    }
    return c;
  }

  function buildBrick(p, v, seed) {
    var c = mk(16, 16), g = ctx2(c), r = rng(seed + v * 3571 + 99);
    rr(g, 0, 0, 16, 16, p.brick.mort);
    function brick(x, y, w, h) {
      rr(g, x, y, w, h, p.brick.mid);
      rr(g, x, y, w, 1, p.brick.hi);
      rr(g, x, y + h - 1, w, 1, p.brick.lo);
      rr(g, x + w - 1, y, 1, h, p.brick.lo);
      rr(g, x, y + 1, 1, h - 2, shade(p.brick.mid, 0.88));
    }
    /* two courses, running bond */
    brick(0, 0, 7, 7); brick(8, 0, 8, 7);
    brick(0, 8, 3, 7); brick(4, 8, 8, 7); brick(13, 8, 3, 7);
    /* chipped highlights */
    var k, x, y;
    for (k = 0; k < 3; k++) {
      x = 1 + ((r() * 13) | 0); y = 1 + ((r() * 12) | 0);
      rr(g, x, y, 1, 1, p.brick.hi);
    }
    if (v === 1) {
      rr(g, 5, 1, 1, 1, p.brick.lo); rr(g, 6, 2, 1, 2, p.brick.lo);
      rr(g, 7, 4, 1, 1, p.brick.lo);
      rr(g, 11, 9, 1, 2, p.brick.lo); rr(g, 12, 11, 1, 1, p.brick.lo);
      rr(g, 4, 12, 2, 1, p.brick.lo);
    } else {
      rr(g, 2, 2, 1, 1, p.brick.lo); rr(g, 9, 11, 1, 1, p.brick.lo);
    }
    return c;
  }

  function buildPlatform(p, v, seed) {
    var c = mk(16, 16), g = ctx2(c), r = rng(seed + v * 1237);
    rr(g, 0, 0, 16, 1, p.plank.hi);
    rr(g, 0, 1, 16, 3, p.plank.mid);
    rr(g, 0, 4, 16, 1, p.plank.lo);
    rr(g, 2, 2, 1, 1, p.plank.lo); rr(g, 10, 2, 1, 1, p.plank.lo);
    rr(g, 13, 2, 1, 1, p.plank.lo);
    /* wood grain */
    rr(g, 5, 1, 4, 1, shade(p.plank.mid, 0.82));
    rr(g, 8, 3, 5, 1, shade(p.plank.mid, 1.18));
    /* support stubs under plank */
    rr(g, 3, 5, 2, 2, shade(p.plank.lo, 0.72));
    rr(g, 11, 5, 2, 2, shade(p.plank.lo, 0.72));
    if (v === 1) { rr(g, 0, 5, 1, 2, p.plank.lo); }
    return c;
  }

  function buildSpikes(p) {
    var c = mk(16, 16), g = ctx2(c), s, i, w, x;
    /* base trough */
    rr(g, 0, 12, 16, 4, shade(p.spike.lo, 0.55));
    rr(g, 0, 12, 16, 1, p.spike.lo);
    for (s = 0; s < 3; s++) {
      var sx = 1 + s * 5;
      for (i = 0; i < 11; i++) {
        w = 1 + ((i * 4) / 11 | 0);
        x = sx + ((4 - w) >> 1);
        var col = i < 3 ? p.spike.hi : i < 7 ? p.spike.mid : p.spike.lo;
        rr(g, x, 2 + i, w, 1, col);
        if (w > 1) rr(g, x + w - 1, 2 + i, 1, 1, p.spike.lo);
      }
      rr(g, sx + 1, 2, 1, 1, shade(p.spike.hi, 1.15));
      rr(g, sx, 7, 1, 1, p.spike.lo);
      rr(g, sx + 2, 10, 1, 1, shade(p.spike.lo, 0.7));
    }
    rr(g, 0, 14, 16, 2, shade(p.spike.lo, 0.4));
    rr(g, 0, 14, 16, 1, shade(p.spike.lo, 0.8));
    return c;
  }

  function tiles(theme) {
    if (tileCache[theme]) return tileCache[theme];
    var p = pal(theme), seed = 1000 + theme.length * 771 + theme.charCodeAt(0) * 13;
    var t = {
      stone: [buildStone(p, 0, seed), buildStone(p, 1, seed), buildStone(p, 2, seed)],
      brick: [buildBrick(p, 0, seed), buildBrick(p, 1, seed)],
      plat: buildPlatform(p, 0, seed),
      spikes: buildSpikes(p)
    };
    tileCache[theme] = t;
    return t;
  }

  /* ───────────────────────── theme backdrops (cached) ───────────────────────── */

  var bgCache = {};

  function skyBands(g, sky) {
    var n = 15, bh = MH / n, i;
    for (i = 0; i < n; i++) {
      var k = i / (n - 1);
      var col;
      if (k < 0.45) col = mix(sky[0], sky[1], k / 0.45);
      else if (k < 0.8) col = mix(sky[1], sky[2], (k - 0.45) / 0.35);
      else col = mix(sky[2], sky[3] || sky[2], (k - 0.8) / 0.2);
      rr(g, 0, Math.round(i * bh), MW, Math.ceil(bh) + 1, col);
    }
    /* dithered band seams (2 rows checker) */
    for (i = 1; i < n; i++) {
      var y = Math.round(i * bh);
      var kk = i / (n - 1), c1;
      if (kk < 0.45) c1 = mix(sky[0], sky[1], kk / 0.45);
      else if (kk < 0.8) c1 = mix(sky[1], sky[2], (kk - 0.45) / 0.35);
      else c1 = mix(sky[2], sky[3] || sky[2], (kk - 0.8) / 0.2);
      g.fillStyle = c1;
      for (var x = (i % 2); x < MW; x += 2) g.fillRect(x, y - 1, 1, 1);
    }
  }

  function poly(g, pts, col) {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  }

  function bgStalactites(g, p, seed) {
    var r = rng(seed + 17), i, x;
    var rockDark = mix(p.sky[0], p.sky[2], 0.55);
    var rim = mix(p.sky[2], "#8f86ab", 0.35);
    /* jagged ceiling mass hanging over the whole cave */
    var pts = [0, 0, MW, 0];
    for (x = MW; x >= 0; x -= 16) {
      var by = 10 + Math.sin(x * 0.021) * 8 + hash2(x, 3) * 16;
      pts.push(x, Math.round(by));
    }
    poly(g, pts, rockDark);
    /* bigger stalactites growing from the ceiling */
    for (i = 0; i < 7; i++) {
      var sx = 6 + i * 56 + ((r() * 20) | 0);
      var w = 16 + ((r() * 26) | 0);
      var h = 26 + ((r() * 72) | 0);
      var cx = sx + (w >> 1);
      poly(g, [sx, 8, sx + w, 8, cx, h], rockDark);
      /* a couple of catch-light pixels only near the tip (not a dashed outline) */
      if (h > 40) {
        rr(g, cx + 1, h - 12, 1, 2, rim);
        rr(g, cx + 2, h - 8, 1, 1, rim);
        rr(g, cx - 2, h - 16, 1, 1, shade(rim, 0.8));
      }
      /* drips at the tip */
      if (h > 55) rr(g, cx - 1, h, 2, 3, rockDark);
    }
    /* faint rock shelves in the distance (very low contrast) */
    var far = mix(p.sky[1], p.sky[2], 0.2);
    for (i = 0; i < 4; i++) {
      var fx = 30 + i * 96, fw = 70 + ((r() * 40) | 0);
      poly(g, [fx, 240, fx + 14, 206, fx + fw * 0.45, 192, fx + fw, 214, fx + fw + 24, 240], far);
    }
    /* distant boulders near the floor */
    for (i = 0; i < 7; i++) {
      var bx = (i * 62 + (r() * 30) | 0), bw = 34 + ((r() * 40) | 0), bh = 18 + ((r() * 22) | 0);
      poly(g, [bx, 240, bx + 6, 240 - bh, bx + bw * 0.4, 240 - bh - 10, bx + bw * 0.76, 240 - bh + 2, bx + bw, 240], mix(p.sky[1], p.sky[2], 0.22));
    }
    /* faint mineral streaks on the far wall (no floating glow orbs) */
    for (i = 0; i < 9; i++) {
      var lx = 18 + i * 41 + ((r() * 16) | 0), ly = 100 + ((r() * 90) | 0);
      rr(g, lx, ly, 1, 2, mix(p.sky[2], p.rock.deco, 0.18));
      rr(g, lx + 1, ly + 2, 1, 1, mix(p.sky[2], p.rock.deco, 0.10));
    }
  }

  function bgForge(g, p, seed) {
    var r = rng(seed + 31), x, y;
    /* faint brick wall */
    var wall = mix(p.sky[2], p.sky[1], 0.25);
    for (y = 8; y < 220; y += 14) {
      rr(g, 0, y, MW, 1, wall);
      var off = ((y / 14) | 0) % 2 ? 10 : 0;
      for (x = off; x < MW; x += 20) rr(g, x, y - 13, 1, 13, wall);
    }
    /* furnace arch */
    var cx = 192;
    poly(g, [cx - 66, 240, cx - 66, 186, cx - 50, 158, cx, 146, cx + 50, 158, cx + 66, 186, cx + 66, 240], shade(p.sky[1], 0.6));
    poly(g, [cx - 46, 240, cx - 46, 192, cx - 30, 172, cx, 164, cx + 30, 172, cx + 46, 192, cx + 46, 240], "#3a1206");
    for (var i = 0; i < 9; i++) {
      rr(g, cx - 34 + i * 8, 176 + (i % 3) * 6, 4, 200, "rgba(255,110,30," + (0.10 + i * 0.012) + ")");
    }
    rr(g, cx - 30, 214, 60, 26, "rgba(255,150,50,0.10)");
    /* wall brackets (low, attached to the bottom edge) */
    for (var bq = 0; bq < 5; bq++) {
      rr(g, 40 + bq * 78, 222, 10, 18, shade(p.sky[1], 0.62));
      rr(g, 42 + bq * 78, 222, 6, 18, shade(p.sky[1], 0.78));
    }
  }

  function bgIce(g, p, seed) {
    var r = rng(seed + 43), i;
    /* distant peaks */
    for (i = 0; i < 6; i++) {
      var x = i * 76 - 20 + ((r() * 24) | 0);
      var h = 96 + ((r() * 60) | 0);
      var w = 90 + ((r() * 40) | 0);
      poly(g, [x, 240, x + w * 0.5, 240 - h, x + w, 240], mix(p.sky[1], p.sky[2], 0.35));
      poly(g, [x + w * 0.5, 240 - h, x + w * 0.5 - 8, 240 - h + 20, x + w * 0.5 + 8, 240 - h + 18], mix(p.sky[2], "#ffffff", 0.35));
    }
    /* horizon fog */
    for (i = 0; i < 4; i++) rr(g, 0, 186 + i * 6, MW, 2, "rgba(190,235,255,0.05)");
    /* crystal clusters bottom */
    for (i = 0; i < 8; i++) {
      var cx = (i * 53 + 20) % MW, baseY = 238, hh = 22 + ((r() * 40) | 0), ww = 10 + ((r() * 14) | 0);
      poly(g, [cx - ww, baseY, cx, baseY - hh, cx + ww, baseY], shade(p.rock.mid, 0.45));
      poly(g, [cx - ww * 0.5, baseY, cx, baseY - hh, cx, baseY], shade(p.rock.hi, 0.55));
    }
    /* snow specks */
    for (i = 0; i < 90; i++) rr(g, (r() * MW) | 0, (r() * 200) | 0, 1, 1, "rgba(230,248,255,0.35)");
  }

  function bgForest(g, p, seed) {
    var r = rng(seed + 59), i;
    /* distant fog */
    for (i = 0; i < 5; i++) rr(g, 0, 130 + i * 10, MW, 5, "rgba(140,200,150,0.035)");
    /* far trunks */
    for (i = 0; i < 9; i++) {
      var x = i * 46 + ((r() * 20) | 0), w = 6 + ((r() * 6) | 0);
      rr(g, x, 0, w, 240, mix(p.sky[1], p.sky[2], 0.28));
      for (var b = 0; b < 3; b++) {
        var by = 40 + b * 46 + ((r() * 20) | 0);
        rr(g, x - 12, by, 12, 2, mix(p.sky[1], p.sky[2], 0.24));
        rr(g, x + w, by + 8, 12, 2, mix(p.sky[1], p.sky[2], 0.24));
      }
    }
    /* canopy */
    for (i = 0; i < 40; i++) {
      var cx = (r() * MW) | 0, cy = ((r() * 30) | 0), rad = 12 + ((r() * 22) | 0);
      fillCircle(g, cx, cy, rad, shade(p.sky[1], 0.62));
    }
    /* forest floor mound */
    poly(g, [0, 240, 0, 214, 90, 200, 180, 214, 280, 198, 384, 214, 384, 240], shade(p.sky[2], 0.55));
  }

  function bgCastle(g, p, seed) {
    var r = rng(seed + 71), i;
    /* moon */
    fillCircle(g, 316, 44, 22, "#e8e2c8");
    fillCircle(g, 322, 40, 20, shade(p.sky[1], 0.9));
    /* star specks */
    for (i = 0; i < 60; i++) rr(g, (r() * MW) | 0, (r() * 120) | 0, 1, 1, "rgba(210,220,255,0.5)");
    /* distant towers */
    for (i = 0; i < 3; i++) {
      var x = 30 + i * 140, w = 54, top = 108 + ((i * 37) % 40);
      rr(g, x, top, w, 240 - top, mix(p.sky[1], p.sky[2], 0.3));
      poly(g, [x - 8, top, x + w / 2, top - 40, x + w + 8, top], mix(p.sky[1], p.sky[2], 0.3));
      /* arched moonlit windows */
      for (var wy = top + 24; wy < 200; wy += 44) {
        var wx = x + w / 2 - 7;
        rr(g, wx, wy, 14, 20, mix(p.sky[0], "#ffd890", 0.32));
        poly(g, [wx, wy, wx + 7, wy - 7, wx + 14, wy], mix(p.sky[0], "#ffd890", 0.32));
      }
    }
    /* pillars + banner silhouettes */
    rr(g, 0, 0, 18, 240, shade(p.sky[1], 0.7));
    rr(g, 366, 0, 18, 240, shade(p.sky[1], 0.7));
    for (i = 0; i < 4; i++) {
      var bx = 60 + i * 88;
      rr(g, bx, 0, 14, 56, shade(p.sky[1], 0.55));
      poly(g, [bx, 56, bx + 7, 70, bx + 14, 56], shade(p.sky[1], 0.55));
    }
    /* floor */
    rr(g, 0, 228, MW, 12, shade(p.sky[1], 0.62));
  }

  function bgVoid(g, p, seed) {
    var r = rng(seed + 83), i;
    for (i = 0; i < 220; i++) {
      var x = (r() * MW) | 0, y = (r() * MH) | 0, s = r();
      rr(g, x, y, 1, 1, s > 0.85 ? "#ffffff" : s > 0.6 ? "#c8b0ff" : "rgba(180,160,240,0.5)");
    }
    /* nebula smears (dithered, low contrast) */
    for (var band = 0; band < 4; band++) {
      for (var x2 = 0; x2 < MW; x2 += 2) {
        var y2 = 76 + band * 30 + Math.sin(x2 * 0.019 + band * 1.7) * 22 + Math.sin(x2 * 0.05 + band) * 7;
        for (var kk = 0; kk < 4; kk++) {
          if (((x2 >> 1) + kk + band) % 3 === 0) continue;
          rr(g, x2, (y2 + kk * 3) | 0, 2, 2, band % 2 ? "rgba(190,80,255,0.055)" : "rgba(90,140,255,0.05)");
        }
      }
    }
    /* floating rocks: jagged silhouettes with a magenta rim light */
    for (i = 0; i < 7; i++) {
      var cx = 14 + i * 56 + ((r() * 22) | 0), cy = 96 + ((r() * 100) | 0), w = 14 + ((r() * 20) | 0);
      var rock = shade(p.sky[1], 0.62);
      poly(g, [cx, cy - 7, cx + w * 0.35, cy - 11, cx + w, cy - 5, cx + w + 5, cy + 3, cx + w * 0.7, cy + 8, cx + w * 0.2, cy + 10, cx - 4, cy + 4], rock);
      /* rim */
      for (var rk = 0; rk < w; rk += 3) {
        rr(g, cx + 2 + rk, cy - 8 - (rk % 3), 2, 1, "rgba(214,110,255,0.35)");
      }
      rr(g, cx + w * 0.3, cy + 2, 2, 2, "rgba(120,90,160,0.35)");
    }
  }

  function backdrop(theme) {
    if (bgCache[theme]) return bgCache[theme];
    var p = pal(theme);
    var c = mk(MW, MH), g = ctx2(c);
    skyBands(g, p.sky);
    var seed = 500 + theme.length * 97 + theme.charCodeAt(1) * 31;
    if (theme === "cave") bgStalactites(g, p, seed);
    else if (theme === "forge") bgForge(g, p, seed);
    else if (theme === "ice") bgIce(g, p, seed);
    else if (theme === "forest") bgForest(g, p, seed);
    else if (theme === "castle") bgCastle(g, p, seed);
    else bgVoid(g, p, seed);
    bgCache[theme] = c;
    return c;
  }

  /* ───────────────────────── world drawing ───────────────────────── */

  function capDecor(g, theme, p, x, y, tx, ty) {
    rr(g, x, y, 16, 2, p.rock.cap);
    rr(g, x, y + 2, 16, 1, mix(p.rock.cap, p.rock.mid, 0.55));
    /* little carved notches so the rim isn't a perfect ruler line */
    rr(g, x + 2, y + 2, 2, 1, p.rock.mid);
    rr(g, x + 11, y + 2, 3, 1, p.rock.mid);
    if (theme === "forest" || theme === "castle") {
      for (var k = 0; k < 3; k++) {
        if (hash2(tx * 17 + k, ty * 31) > 0.4) {
          var mx = x + 3 + k * 5;
          rr(g, mx, y - 1, 1, 2, p.rock.deco);
          rr(g, mx + 1, y, 1, 1, p.rock.deco);
        }
      }
    } else if (theme === "cave") {
      if (hash2(tx + 3, ty * 7) > 0.5) { rr(g, x + 4, y - 1, 2, 1, p.rock.deco); rr(g, x + 5, y - 2, 1, 1, p.rock.deco); }
      if (hash2(tx * 7, ty + 3) > 0.6) { rr(g, x + 11, y - 1, 1, 1, p.rock.deco); }
    } else if (theme === "ice") {
      if (hash2(tx * 5, ty + 1) > 0.4) { rr(g, x + 5, y - 1, 1, 1, "#ffffff"); }
      if (hash2(tx, ty + 9) > 0.45) { rr(g, x + 12, y - 1, 2, 1, "#e8f8ff"); }
    } else if (theme === "void") {
      if (hash2(tx * 9, ty * 3) > 0.45) { rr(g, x + 8, y, 2, 1, p.rock.deco); }
    } else if (theme === "forge") {
      if (hash2(tx * 3, ty * 5) > 0.5) { rr(g, x + 6, y, 1, 1, "#ffd070"); }
    }
  }

  function drawTerrain(g, v, p, T, theme) {
    var terr = v.terrain || [], tx, ty, ch, x, y;
    var t = v.t || 0;
    for (ty = 0; ty < TH; ty++) {
      var row = terr[ty] || "";
      for (tx = 0; tx < TW; tx++) {
        ch = row.charAt(tx);
        if (!ch || ch === ".") continue;
        x = tx * TS; y = ty * TS;
        if (ch === "#") {
          var rv = hash2(tx, ty);
          var vv = rv > 0.88 ? 2 : rv > 0.46 ? 1 : 0;
          g.drawImage(T.stone[vv], x, y);
          var above = ty > 0 ? (terr[ty - 1] || "").charAt(tx) : "#";
          var below = ty < TH - 1 ? (terr[ty + 1] || "").charAt(tx) : "#";
          var left = tx > 0 ? row.charAt(tx - 1) : "#";
          var right = tx < TW - 1 ? row.charAt(tx + 1) : "#";
          if (above === ".") capDecor(g, theme, p, x, y, tx, ty);
          if (left === ".") rr(g, x, y + 2, 1, 13, p.rock.hi);
          if (right === ".") rr(g, x + 15, y + 2, 1, 13, shade(p.rock.lo, 1.15));
          if (above === "." && left === ".") rr(g, x, y + 2, 1, 1, mix(p.rock.cap, "#ffffff", 0.15));
          if (below === ".") {
            rr(g, x, y + 14, 16, 2, shade(p.rock.lo, 0.7));
            rr(g, x, y + 14, 16, 1, shade(p.rock.lo, 0.9));
            if (theme === "ice") {
              var ih = hash2(tx * 3, ty + 5);
              if (ih > 0.4) { rr(g, x + 3, y + 16, 1, 1 + ((ih * 3) | 0), shade(p.rock.hi, 0.95)); }
              if (ih < 0.35) { rr(g, x + 11, y + 16, 1, 2, shade(p.rock.hi, 0.9)); }
            } else if (theme === "cave" && hash2(tx + 1, ty + 7) > 0.55) {
              rr(g, x + 7, y + 16, 1, 2, shade(p.rock.mid, 0.8));
            } else if (theme === "castle" && hash2(tx, ty + 2) > 0.6) {
              rr(g, x + 9, y + 16, 1, 1, p.rock.deco);
            }
          }
          /* moss at the foot of walls */
          if (theme === "forest" && above === "." && hash2(tx * 11, ty) > 0.55) {
            rr(g, x + 2, y + 2, 2, 1, p.rock.deco);
          }
        } else if (ch === "B") {
          g.drawImage(T.brick[(hash2(ty * 3, tx) * 2) | 0], x, y);
          var ab = ty > 0 ? (terr[ty - 1] || "").charAt(tx) : "#";
          if (ab === ".") rr(g, x, y, 16, 1, mix(p.brick.hi, "#ffffff", 0.12));
        } else if (ch === "=") {
          g.drawImage(T.plat, x, y);
          var l = tx > 0 ? row.charAt(tx - 1) : "-";
          var r = tx < TW - 1 ? row.charAt(tx + 1) : "-";
          if (l !== "=") { rr(g, x, y, 2, 5, p.plank.lo); rr(g, x, y, 2, 1, p.plank.hi); rr(g, x, y + 4, 2, 1, shade(p.plank.lo, 0.7)); }
          if (r !== "=") { rr(g, x + 14, y, 2, 5, p.plank.lo); rr(g, x + 14, y, 2, 1, p.plank.hi); rr(g, x + 14, y + 4, 2, 1, shade(p.plank.lo, 0.7)); }
          /* little rope knots at tile joints */
          if (l === "=") {
            rr(g, x, y + 1, 1, 3, shade(p.plank.mid, 0.8));
            if (hash2(tx, ty) > 0.55) rr(g, x + 1, y + 5, 1, 2, shade(p.plank.lo, 0.8));
          }
        } else if (ch === "^") {
          g.drawImage(T.spikes, x, y);
        }
      }
    }
  }

  function drawGates(g, v, p, terr) {
    var gates = v.gates || [], i;
    for (i = 0; i < gates.length; i++) {
      var gt = gates[i];
      if (!gt) continue;
      var gx0 = (gt.x | 0) * TS, gy0 = (gt.y | 0) * TS;
      /* visual progress: game lerps `anim`; fall back to binary `open` */
      var open = clamp01(gt.anim != null ? gt.anim : (gt.open == null ? 0 : gt.open));
      var above = (gt.y | 0) > 0 ? (terr[(gt.y | 0) - 1] || "").charAt(gt.x | 0) : "#";
      var solidAbove = above === "#" || above === "B" || above === "a" || above === "b" || above === "c" || above === "d";
      if (open > 0.97) continue; /* retracted: leave the passage open */
      var dy = Math.round(open * 16);
      /* dark recess */
      rr(g, gx0, gy0, 16, 16, shade(p.gate.lo, 0.42));
      rr(g, gx0 + 1, gy0 + 1, 14, 14, shade(p.sky[0], 0.62));
      rr(g, gx0, gy0 + 1, 1, 14, shade(p.gate.lo, 0.7));
      g.save();
      g.beginPath();
      if (solidAbove) g.rect(gx0, gy0, 16, 16); else g.rect(gx0, gy0 - 16, 16, 32);
      g.clip();
      g.translate(0, -dy);
      var gx = gx0, gy = gy0;
      /* stone side jambs */
      rr(g, gx, gy, 2, 16, p.rock.mid);
      rr(g, gx + 1, gy, 1, 16, p.rock.lo);
      rr(g, gx + 14, gy, 2, 16, p.rock.mid);
      rr(g, gx + 14, gy, 1, 16, p.rock.hi);
      /* steel portcullis bars */
      var b, bx;
      for (b = 0; b < 3; b++) {
        bx = gx + 3 + b * 4;
        rr(g, bx, gy, 2, 16, p.gate.mid);
        rr(g, bx, gy, 1, 16, p.gate.hi);
        rr(g, bx + 1, gy, 1, 16, p.gate.lo);
        rr(g, bx, gy + 15, 1, 1, p.gate.hi);
        rr(g, bx + 2, gy + 14, 1, 2, p.gate.mid);
        rr(g, bx + 2, gy + 15, 1, 1, p.gate.lo);
      }
      /* crossbars */
      rr(g, gx + 2, gy + 3, 12, 2, p.gate.mid);
      rr(g, gx + 2, gy + 3, 12, 1, p.gate.hi);
      rr(g, gx + 2, gy + 4, 12, 1, p.gate.lo);
      rr(g, gx + 2, gy + 10, 12, 2, p.gate.mid);
      rr(g, gx + 2, gy + 10, 12, 1, p.gate.hi);
      rr(g, gx + 2, gy + 11, 12, 1, p.gate.lo);
      /* group gem, glowing when open */
      var gc = GCOL[gt.group] || p.accent;
      if (open > 0.05) {
        g.globalAlpha = 0.25;
        fillCircle(g, gx + 8, gy + 8, 5, gc);
        g.globalAlpha = 1;
      }
      rr(g, gx + 7, gy + 6, 2, 1, gc);
      rr(g, gx + 6, gy + 7, 4, 2, gc);
      rr(g, gx + 7, gy + 9, 2, 1, gc);
      rr(g, gx + 8, gy + 7, 1, 1, "#ffffff");
      g.restore();
      /* fixed lintel + threshold */
      rr(g, gx0, gy0, 16, 1, p.rock.cap);
      rr(g, gx0, gy0 + 15, 16, 1, shade(p.rock.lo, 0.65));
    }
  }

  function drawPlates(g, v, p) {
    var plates = v.plates || [], i;
    for (i = 0; i < plates.length; i++) {
      var pl = plates[i]; if (!pl) continue;
      var x = (pl.x | 0) * TS, y = (pl.y | 0) * TS;
      var pressed = !!pl.pressed;
      var gc = GCOL[pl.group] || p.accent;
      /* slot in the floor */
      rr(g, x + 1, y + 10, 14, 6, shade(p.rock.lo, 0.5));
      rr(g, x + 2, y + 15, 12, 1, shade(p.rock.lo, 0.35));
      /* side brackets */
      rr(g, x + 1, y + 11, 1, 4, p.gate.frame);
      rr(g, x + 14, y + 11, 1, 4, p.gate.frame);
      rr(g, x + 1, y + 11, 1, 1, p.gate.frameHi);
      rr(g, x + 14, y + 11, 1, 1, p.gate.frameHi);
      if (!pressed) {
        /* raised metal pad */
        rr(g, x + 3, y + 10, 10, 4, p.gate.mid);
        rr(g, x + 3, y + 10, 10, 1, p.gate.hi);
        rr(g, x + 3, y + 13, 10, 1, shade(p.gate.lo, 1.1));
        rr(g, x + 4, y + 11, 8, 1, shade(p.gate.mid, 0.8));
        /* corner bolts */
        rr(g, x + 3, y + 12, 1, 1, p.gate.lo); rr(g, x + 12, y + 12, 1, 1, p.gate.lo);
      } else {
        /* pad pressed into the slot */
        rr(g, x + 3, y + 13, 10, 2, p.gate.mid);
        rr(g, x + 3, y + 13, 10, 1, p.gate.hi);
        rr(g, x + 3, y + 12, 10, 1, shade(p.gate.lo, 0.8));
        rr(g, x + 4, y + 14, 8, 1, shade(p.gate.lo, 0.6));
      }
      /* group-coloured stud */
      var sy = pressed ? y + 13 : y + 11;
      rr(g, x + 7, sy, 2, 1, gc);
      rr(g, x + 6, sy + 1, 4, 1, gc);
      rr(g, x + 7, sy + 2, 2, 1, gc);
      rr(g, x + 7, sy + 1, 1, 1, "#ffffff");
      if (pressed) {
        /* soft glow leaking from the slot */
        g.globalAlpha = 0.22;
        rr(g, x + 3, y + 14, 10, 1, gc);
        g.globalAlpha = 1;
      }
    }
  }

  function drawLevers(g, v, p) {
    var levers = v.levers || [], i;
    var t = v.t || 0;
    for (i = 0; i < levers.length; i++) {
      var lv = levers[i]; if (!lv) continue;
      var x = (lv.x | 0) * TS, y = (lv.y | 0) * TS;
      var a = clamp01(lv.anim != null ? lv.anim : (lv.on ? 1 : 0));
      var on = !!lv.on;
      var gc = GCOL[lv.group] || p.accent;
      var px = x + 8, py = y + 13;
      /* stone pedestal + iron base */
      rr(g, x + 3, y + 14, 10, 2, shade(p.rock.lo, 0.55));
      rr(g, x + 3, y + 14, 10, 1, shade(p.rock.lo, 0.85));
      rr(g, x + 4, y + 11, 8, 4, p.gate.frame);
      rr(g, x + 4, y + 11, 8, 1, p.gate.frameHi);
      rr(g, x + 4, y + 14, 8, 1, shade(p.gate.frame, 0.6));
      rr(g, x + 5, y + 12, 6, 1, shade(p.gate.frameHi, 0.85));
      /* handle rod (swings with animation) */
      var ex = x + 3 + a * 10;
      var ey = y + 4;
      limb(g, px, py, ex, ey, 2, p.gate.lo);
      limb(g, px, py - 1, ex, ey - 1, 1, p.gate.hi);
      /* grip knob */
      rr(g, ex - 2, ey - 1, 4, 4, gc);
      rr(g, ex - 1, ey, 2, 2, shade(gc, 1.3));
      rr(g, ex - 1, ey - 1, 1, 1, "#ffffff");
      if (on) {
        g.globalAlpha = 0.3;
        fillCircle(g, ex, ey, 4, gc);
        g.globalAlpha = 1;
      }
      /* pivot bolt */
      rr(g, px - 2, py - 1, 4, 3, p.gate.mid);
      rr(g, px - 1, py, 2, 1, p.gate.hi);
      /* group tag on the pedestal */
      rr(g, x + 7, y + 12, 2, 1, gc);
      if (Math.sin(t * 3 + x) > 0.6) rr(g, ex - 1, ey - 1, 1, 1, "#ffffff");
    }
  }

  function drawTraps(g, v, p) {
    var traps = v.traps || [], i;
    var t = v.t || 0;
    for (i = 0; i < traps.length; i++) {
      var tr = traps[i]; if (!tr) continue;
      var x = (tr.x | 0) * TS, y = (tr.y | 0) * TS, dir = tr.dir < 0 ? -1 : 1;
      /* wall bracket + chain */
      rr(g, x + 6, y, 4, 4, shade(p.rock.lo, 0.6));
      rr(g, x + 7, y, 2, 4, shade(p.gate.frame, 0.8));
      rr(g, x + 7, y + 1, 1, 1, p.gate.frameHi);
      /* housing */
      rr(g, x + 2, y + 4, 12, 9, p.gate.lo);
      rr(g, x + 2, y + 4, 12, 1, p.gate.mid);
      rr(g, x + 3, y + 5, 10, 1, shade(p.gate.mid, 0.72));
      rr(g, x + 2, y + 11, 12, 2, shade(p.gate.lo, 0.6));
      rr(g, x + 3, y + 12, 10, 1, shade(p.gate.lo, 0.4));
      /* bolt channel */
      var chanX = dir > 0 ? x + 10 : x + 4;
      rr(g, chanX, y + 6, 2, 5, shade(p.gate.lo, 0.4));
      /* bolt */
      if (dir > 0) {
        rr(g, x + 12, y + 8, 3, 1, p.spike.mid);
        rr(g, x + 15, y + 7, 2, 3, p.spike.hi);
        rr(g, x + 15, y + 7, 1, 1, "#ffffff");
      } else {
        rr(g, x + 1, y + 8, 3, 1, p.spike.mid);
        rr(g, x - 1, y + 7, 2, 3, p.spike.hi);
        rr(g, x - 1, y + 7, 1, 1, "#ffffff");
      }
      /* crossbow limbs */
      rr(g, x + 2, y + 5, 2, 2, p.gate.frame);
      rr(g, x + 12, y + 5, 2, 2, p.gate.frame);
      rr(g, x + 2, y + 6, 3, 1, shade(p.gate.frame, 0.65));
      rr(g, x + 11, y + 6, 3, 1, shade(p.gate.frame, 0.65));
      /* trigger glint */
      var glint = Math.sin(t * 5.5 + x * 0.7) > 0.45;
      rr(g, dir > 0 ? x + 8 : x + 6, y + 8, 1, 1, glint ? "#fff6c0" : p.accent);
      if (glint) {
        g.globalAlpha = 0.4;
        rr(g, dir > 0 ? x + 7 : x + 5, y + 7, 3, 3, p.accent);
        g.globalAlpha = 1;
      }
      /* rivets */
      rr(g, x + 3, y + 10, 1, 1, p.gate.frameHi);
      rr(g, x + 12, y + 10, 1, 1, p.gate.frameHi);
    }
  }

  function drawTreasures(g, v) {
    var list = v.treasures || [], i;
    var t = v.t || 0;
    for (i = 0; i < list.length; i++) {
      var tr = list[i]; if (!tr || tr.taken) continue;
      var x = (tr.x | 0) * TS, y = (tr.y | 0) * TS;
      var bob = Math.round(Math.sin(t * 3 + x * 0.4));
      var bx = x + 3, by = y + 6 + bob;
      rr(g, x + 4, y + 15, 8, 1, "rgba(0,0,0,0.4)");
      /* chest */
      rr(g, bx + 1, by - 1, 8, 3, "#8a5a24");
      rr(g, bx, by + 1, 10, 2, "#a8702e");
      rr(g, bx, by + 3, 10, 6, "#6a421c");
      rr(g, bx + 1, by + 4, 8, 4, "#7c4e20");
      /* gold bands */
      rr(g, bx + 2, by + 1, 1, 8, "#f2c24a");
      rr(g, bx + 7, by + 1, 1, 8, "#f2c24a");
      rr(g, bx, by + 2, 10, 1, "#d9a63a");
      rr(g, bx, by + 2, 10, 1, "#d9a63a");
      /* lock */
      rr(g, bx + 4, by + 4, 2, 3, "#f2c24a");
      rr(g, bx + 5, by + 5, 1, 1, "#5a3a14");
      /* sparkle */
      var sp = Math.sin(t * 5 + x * 0.9);
      if (sp > 0.2) {
        rr(g, bx + 9, by - 2, 1, 1, "#ffffff");
        rr(g, bx + 8, by - 3, 1, 1, "#ffe9a0");
        if (sp > 0.75) { rr(g, bx + 10, by - 3, 1, 1, "#ffffff"); rr(g, bx + 9, by - 4, 1, 1, "#ffe9a0"); }
      }
    }
  }

  var RUNE_FALLBACK = ["##.", "#.#", "##.", "#.#", "#.#"];

  /* each viking has a personal door: colour + carved rune (view.exits[i].who) */
  var OWNER_COLOR = { erik: "#ff8a5c", baleog: "#6ee06e", olaf: "#8a8aff" };
  var OWNER_DARK = { erik: "#8a3a1e", baleog: "#2f7a36", olaf: "#3a3a8a" };
  var OWNER_RUNE = {
    erik: ["#..", "#..", "###", "#..", "#.."],
    baleog: ["##.", "#.#", "##.", "#.#", "##."],
    olaf: [".#.", "#.#", "#.#", "#.#", ".#."]
  };

  function tinyRune(g, x, y, rows, col) {
    for (var ry = 0; ry < rows.length; ry++) {
      for (var rx = 0; rx < 3; rx++) {
        if (rows[ry].charAt(rx) === "#") rr(g, x + rx, y + ry, 1, 1, col);
      }
    }
  }

  function drawExits(g, v, p) {
    var list = v.exits || [], i, k, ry, rx;
    var t = v.t || 0;
    for (i = 0; i < list.length; i++) {
      var ex = list[i]; if (!ex) continue;
      var x = (ex.x | 0) * TS, y = (ex.y | 0) * TS;
      var filled = ex.filledBy != null;
      var who = ex.who;
      if (who !== "erik" && who !== "baleog" && who !== "olaf") who = ex.filledBy;
      if (who !== "erik" && who !== "baleog" && who !== "olaf") who = null;
      var owner = who ? OWNER_COLOR[who] : p.accent;
      var ownerDark = who ? OWNER_DARK[who] : shade(p.accent, 0.5);
      var rune = who ? OWNER_RUNE[who] : RUNE_FALLBACK;
      var ph = t + (ex.anim || 0) * 0.9;
      var pulse = 0.5 + 0.5 * Math.sin(ph * 3.2);
      /* dark niche */
      rr(g, x, y, 16, 16, shade(p.sky[0], 0.72));
      rr(g, x + 1, y + 1, 14, 14, shade(p.sky[0], 0.4));
      /* stone jambs, tinted with the owner's colour */
      rr(g, x, y, 2, 16, mix(p.rock.mid, owner, filled ? 0.28 : 0.14));
      rr(g, x, y, 1, 16, mix(p.rock.hi, owner, filled ? 0.32 : 0.2));
      rr(g, x + 14, y, 2, 16, mix(p.rock.mid, owner, filled ? 0.24 : 0.1));
      rr(g, x + 15, y, 1, 16, p.rock.lo);
      rr(g, x, y, 16, 1, p.rock.lo);
      /* arch opening */
      rr(g, x + 2, y + 2, 12, 14, shade(p.sky[0], 0.4));
      /* owner plaque above the rune */
      rr(g, x + 5, y + 1, 6, 1, ownerDark);
      rr(g, x + 6, y + 1, 4, 1, owner);
      if (filled) {
        /* filled portal: the viking has already walked through */
        rr(g, x + 3, y + 2, 10, 13, mix(owner, "#0d0818", 0.66));
        rr(g, x + 4, y + 3, 8, 12, mix(owner, "#0d0818", 0.38));
        rr(g, x + 5, y + 4, 6, 11, mix(owner, "#0d0818", 0.14));
        for (k = 0; k < 5; k++) {
          rr(g, x + 4 + k * 2, y + 3 + (k % 2), 1, 8 - k, mix(owner, "#ffffff", 0.3));
        }
        tinyRune(g, x + 6, y + 6, rune, "#ffffff");
        rr(g, x + 7, y + 2, 2, 1, "#ffffff");
        /* two bright sparks rising */
        for (k = 0; k < 3; k++) {
          var sy2 = y + 14 - (((ph * 9 + k * 5) % 14) | 0);
          g.globalAlpha = 0.45;
          rr(g, x + 5 + ((k * 3) % 7), sy2, 1, 1, "#ffffff");
          g.globalAlpha = 1;
        }
        rr(g, x + 2, y + 15, 12, 1, mix(owner, "#ffffff", 0.45));
        /* extinguished marker: small dark notch under the rune (door used up) */
        rr(g, x + 6, y + 12, 4, 1, ownerDark);
      } else {
        /* closed owner door, rune glows in the owner colour */
        rr(g, x + 3, y + 2, 10, 13, "#3a2412");
        rr(g, x + 4, y + 3, 8, 12, "#6b4522");
        rr(g, x + 4, y + 3, 8, 1, "#8a5c30");
        rr(g, x + 5, y + 4, 1, 11, "#503318");
        rr(g, x + 10, y + 4, 1, 11, "#503318");
        rr(g, x + 4, y + 6, 8, 1, "#2e1c0c");
        rr(g, x + 4, y + 11, 8, 1, "#2e1c0c");
        rr(g, x + 9, y + 8, 1, 2, "#d9a63a");
        var rc = mix(owner, "#ffffff", 0.15 + pulse * 0.45);
        tinyRune(g, x + 6, y + 6, rune, rc);
        /* owner-coloured glow behind the rune */
        g.globalAlpha = 0.12 + pulse * 0.13;
        fillCircle(g, x + 7, y + 8, 5, owner);
        g.globalAlpha = 1;
        if (pulse > 0.75) {
          rr(g, x + 5, y + 5, 1, 1, "#ffffff");
          rr(g, x + 11, y + 12, 1, 1, "#ffffff");
        }
        /* owner emblem corners */
        rr(g, x + 4, y + 14, 1, 1, ownerDark);
        rr(g, x + 11, y + 14, 1, 1, ownerDark);
      }
      /* arch stones */
      rr(g, x + 2, y + 1, 1, 1, p.rock.mid); rr(g, x + 13, y + 1, 1, 1, p.rock.mid);
      rr(g, x + 3, y, 10, 1, mix(p.rock.cap, owner, 0.18));
      rr(g, x, y + 15, 16, 1, shade(p.rock.lo, 0.8));
      rr(g, x + 2, y + 15, 12, 1, filled ? mix(owner, "#ffffff", 0.3) : shade(p.rock.mid, 0.9));
    }
  }

  /* ───────────────────────── animated ambient motes ───────────────────────── */

  function drawMotes(g, theme, p, t) {
    var i, x, y, a, s;
    if (theme === "cave" || theme === "void" || theme === "castle") {
      for (i = 0; i < 16; i++) {
        s = hash2(i, 7);
        x = (hash2(i, 1) * MW + Math.sin(t * 0.4 + i) * 12) % MW;
        y = 20 + ((hash2(i, 3) * 210 + t * 5 * (0.4 + s)) % 210);
        a = 0.18 + 0.3 * hash2(i, 5);
        g.globalAlpha = a;
        rr(g, x | 0, y | 0, 1, 1, theme === "void" ? p.mote : theme === "castle" ? "#ffe6a0" : p.mote);
      }
      g.globalAlpha = 1;
    } else if (theme === "forge") {
      for (i = 0; i < 22; i++) {
        s = hash2(i, 11);
        x = (hash2(i, 2) * MW + Math.sin(t * 0.8 + i * 2) * 8 + 384) % MW;
        y = 240 - ((hash2(i, 4) * 240 + t * (10 + s * 26)) % 250);
        a = 0.25 + 0.55 * hash2(i, 6);
        g.globalAlpha = a;
        rr(g, x | 0, y | 0, 1, 2, i % 3 === 0 ? "#ffe0a0" : "#ff9a40");
      }
      g.globalAlpha = 1;
    } else if (theme === "ice") {
      for (i = 0; i < 26; i++) {
        s = hash2(i, 13);
        x = (hash2(i, 3) * MW + t * (4 + s * 10) + Math.sin(t * 0.7 + i) * 6) % MW;
        y = (hash2(i, 5) * 240 + t * (8 + s * 14)) % 240;
        g.globalAlpha = 0.30 + 0.4 * hash2(i, 8);
        rr(g, x | 0, y | 0, 1, 1, "#eaf8ff");
      }
      g.globalAlpha = 1;
    } else if (theme === "forest") {
      for (i = 0; i < 14; i++) {
        x = hash2(i, 2) * MW + Math.sin(t * 0.6 + i * 1.7) * 22;
        y = 60 + hash2(i, 4) * 150 + Math.cos(t * 0.5 + i) * 10;
        var blink = Math.sin(t * 1.8 + i * 2.3);
        if (blink > 0.1) {
          g.globalAlpha = 0.25 + 0.6 * blink;
          rr(g, x | 0, y | 0, 1, 1, i % 3 === 0 ? "#e8ffb0" : p.mote);
          rr(g, x | 0, (y - 1) | 0, 1, 1, "rgba(200,240,120,0.4)");
        }
      }
      g.globalAlpha = 1;
    }
  }
  /* ───────────────────────── vikings ───────────────────────── */

  var CHAR_COLOR = { erik: "#e2622c", baleog: "#3f9e4d", olaf: "#2f6fd0" };

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
      bow: "#9a6430", bowL: "#c08a4a", string: "#e8e0c8", blade: "#e6eef8", bladeS: "#9aa8bc",
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

  /* solid pixel limb: stamps w×w blocks along the segment (no holes) */
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
    var pants = back ? pal.tunicS : pal.tunic;
    limb(g, leg.hip, -6, leg.knee[0], leg.knee[1], 2, pants);
    limb(g, leg.knee[0], leg.knee[1], leg.foot[0], leg.foot[1], 2, pants);
    if (!back) limb(g, leg.hip, -6, leg.knee[0], leg.knee[1], 1, pal.tunicL);
    /* knee patch */
    rr(g, leg.knee[0], leg.knee[1], 2, 1, back ? pal.tunicS : pal.tunicL);
    /* boot */
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
      /* cuff */
      rr(g, arm.el[0] - 1, arm.el[1] + 1, 3, 1, pal.leather);
    }
    /* hand / fist */
    var hx = arm.hand[0] - 1, hy = arm.hand[1] - 1;
    rr(g, hx, hy, 2, 2, pal.skin);
    rr(g, hx, hy, 2, 1, shade(pal.skin, 1.06));
    if (up) rr(g, hx, hy + 1, 2, 1, pal.skinS);
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

  function drawActiveMarker(g, x, y, top, t) {
    var bob = Math.round(Math.abs(Math.sin(t * 3.4)) * 2);
    var my = y - top - 5 - bob;
    var c = "#ffd45e";
    rr(g, x - 2, my, 5, 1, "rgba(0,0,0,0.5)");
    rr(g, x - 2, my, 5, 1, c);
    rr(g, x - 1, my + 1, 3, 1, c);
    rr(g, x, my + 2, 1, 1, "#fff2c0");
    /* ground glow */
    rr(g, x - 5, y - 1, 10, 1, "rgba(255,214,110,0.16)");
  }

  /* ── Erik: swift, red hair, horned helmet, headbutt ── */
  function drawErik(g, pal, pose, st, f, t) {
    var by = -pose.bob, lean = pose.lean;
    drawLeg(g, pal, pose.legs[0], true);
    drawLeg(g, pal, pose.legs[1], false);
    drawArm(g, pal, pose.arms[0], true);
    /* torso */
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
    /* head */
    var hx = lean * 2, hy = by;
    /* hair at the back */
    rr(g, -4 + hx, -19 + hy, 1, 4, pal.hairS);
    rr(g, -5 + hx, -17 + hy, 1, 2, pal.hair);
    /* horns */
    rr(g, -4 + hx, -20 + hy, 2, 2, pal.cream);
    rr(g, -5 + hx, -22 + hy, 2, 2, pal.cream);
    rr(g, -6 + hx, -24 + hy, 1, 2, pal.creamL);
    rr(g, 3 + hx, -20 + hy, 2, 2, pal.cream);
    rr(g, 4 + hx, -22 + hy, 2, 2, pal.cream);
    rr(g, 5 + hx, -24 + hy, 1, 2, pal.creamL);
    /* helmet */
    rr(g, -2 + hx, -23 + hy, 4, 1, pal.metalL);
    rr(g, -3 + hx, -22 + hy, 6, 2, pal.metal);
    rr(g, -3 + hx, -20 + hy, 6, 1, pal.metalS);
    rr(g, -3 + hx, -19 + hy, 6, 1, pal.metalD);
    rr(g, -2 + hx, -21 + hy, 1, 1, pal.gold);
    rr(g, 2 + hx, -21 + hy, 1, 1, pal.gold);
    /* face */
    rr(g, -2 + hx, -18 + hy, 5, 4, pal.skin);
    rr(g, -2 + hx, -18 + hy, 5, 1, pal.skinS);
    rr(g, 1 + hx, -17 + hy, 1, 1, pal.white);
    rr(g, 2 + hx, -17 + hy, 1, 1, pal.eye);
    rr(g, 1 + hx, -18 + hy, 2, 1, pal.hairS);
    rr(g, 3 + hx, -16 + hy, 1, 2, pal.skinS);
    rr(g, 3 + hx, -15 + hy, 1, 1, pal.skin);
    /* beard */
    rr(g, -2 + hx, -15 + hy, 4, 2, pal.hair);
    rr(g, -1 + hx, -13 + hy, 3, 1, pal.hair);
    rr(g, 1 + hx, -15 + hy, 2, 1, pal.hairL);
    rr(g, 1 + hx, -14 + hy, 1, 1, "#6a2c10");
    rr(g, -3 + hx, -18 + hy, 1, 4, pal.hairS);
    if (st === "act") {
      rr(g, -9 + hx, -22 + hy, 2, 1, pal.goldL);
      rr(g, -10 + hx, -20 + hy, 2, 1, pal.gold);
      rr(g, -8 + hx, -24 + hy, 1, 1, pal.white);
    }
  }

  /* ── Baleog: fierce, green tunic, sword & bow ── */
  function drawBowOnBack(g, pal) {
    limb(g, -5, -17, -4, -10, 1, pal.bowS);
    limb(g, -4, -10, -5, -6, 1, pal.bowS);
    limb(g, -5, -17, -5, -6, 1, pal.string);
  }

  function drawSword(g, pal, hx, hy) {
    rr(g, hx, hy - 8, 1, 8, pal.blade);
    rr(g, hx, hy - 9, 1, 1, pal.bladeS);
    rr(g, hx + 1, hy - 7, 1, 5, pal.bladeS);
    rr(g, hx - 1, hy - 1, 3, 1, pal.gold);
    rr(g, hx, hy, 1, 1, pal.leather);
    rr(g, hx - 1, hy - 2, 3, 1, pal.goldL);
  }

  function drawBow(g, pal, hx, hy) {
    limb(g, hx + 1, hy - 7, hx + 2, hy - 4, 1, pal.bowL);
    limb(g, hx + 2, hy - 4, hx + 2, hy + 4, 1, pal.bow);
    limb(g, hx + 2, hy + 4, hx + 1, hy + 7, 1, pal.bowL);
    limb(g, hx, hy - 6, hx, hy + 6, 1, pal.string);
    rr(g, hx, hy, 2, 1, pal.blade);
  }

  function drawBaleog(g, pal, pose, st, f, t) {
    var by = -pose.bob, lean = pose.lean;
    drawLeg(g, pal, pose.legs[0], true);
    drawLeg(g, pal, pose.legs[1], false);
    drawArm(g, pal, pose.arms[0], true);
    if (st !== "act") drawBowOnBack(g, pal);
    /* torso */
    rr(g, -3, -15 + by, 6, 9, pal.tunic);
    rr(g, -3, -15 + by, 6, 1, pal.tunicL);
    rr(g, -3, -14 + by, 1, 8, pal.tunicS);
    rr(g, 1, -14 + by, 2, 1, pal.tunicL);
    /* leather harness (diagonal 1px) */
    rr(g, -2, -13 + by, 1, 2, pal.leather);
    rr(g, -1, -11 + by, 1, 2, pal.leather);
    rr(g, 0, -9 + by, 1, 2, pal.leather);
    rr(g, -3, -8 + by, 6, 1, pal.leather);
    rr(g, 1, -8 + by, 1, 1, pal.gold);
    /* shoulder pads */
    rr(g, -4, -15 + by, 2, 2, pal.leather);
    rr(g, 3, -15 + by, 2, 2, pal.leather);
    rr(g, -4, -15 + by, 2, 1, pal.leatherL);
    rr(g, 3, -15 + by, 2, 1, pal.leatherL);
    drawArm(g, pal, pose.arms[1], false);
    if (st !== "act") drawSword(g, pal, pose.arms[1].hand[0] - 1, pose.arms[1].hand[1] + by);
    if (st === "act") drawBow(g, pal, pose.arms[1].hand[0], pose.arms[1].hand[1] + by);
    /* head */
    var hx = lean * 2, hy = by;
    rr(g, -3 + hx, -19 + hy, 1, 2, pal.hairS);
    /* helmet dome + brim */
    rr(g, -2 + hx, -23 + hy, 4, 1, pal.metalL);
    rr(g, -3 + hx, -22 + hy, 6, 2, pal.metal);
    rr(g, -3 + hx, -20 + hy, 6, 1, pal.metalS);
    rr(g, -3 + hx, -19 + hy, 6, 1, pal.gold);
    rr(g, -3 + hx, -18 + hy, 6, 1, pal.metalD);
    /* nose guard */
    rr(g, 1 + hx, -19 + hy, 1, 3, pal.metalS);
    /* face */
    rr(g, -2 + hx, -18 + hy, 4, 3, pal.skin);
    rr(g, 1 + hx, -17 + hy, 1, 1, pal.white);
    rr(g, 2 + hx, -17 + hy, 1, 1, pal.eye);
    rr(g, 1 + hx, -18 + hy, 2, 1, pal.hairS);
    rr(g, 2 + hx, -16 + hy, 1, 1, pal.skinS);
    /* brown beard */
    rr(g, -3 + hx, -16 + hy, 6, 2, pal.hair);
    rr(g, -2 + hx, -14 + hy, 5, 2, pal.hair);
    rr(g, -1 + hx, -12 + hy, 3, 1, pal.hair);
    rr(g, -1 + hx, -16 + hy, 3, 1, pal.hairL);
    rr(g, 1 + hx, -15 + hy, 1, 1, "#3a1e08");
    rr(g, 2 + hx, -14 + hy, 1, 2, pal.hairS);
    rr(g, 2 + hx, -12 + hy, 1, 1, pal.gold);
    rr(g, -3 + hx, -16 + hy, 1, 2, pal.hairS);
    if (st === "act") {
      rr(g, 4 + hx, -15 + hy, 2, 1, pal.goldL);
    }
  }

  /* ── Olaf: stout, blue tunic, round shield ── */
  function drawOlafShieldOverhead(g, pal, by) {
    var y = -30;
    rr(g, -10, y, 20, 1, pal.woodL);
    rr(g, -10, y + 1, 20, 2, pal.wood);
    rr(g, -10, y + 3, 20, 1, pal.woodS);
    /* metal end caps + rim */
    rr(g, -10, y, 2, 4, pal.iron);
    rr(g, 8, y, 2, 4, pal.iron);
    rr(g, -10, y, 2, 1, shade(pal.iron, 1.25));
    rr(g, 8, y, 2, 1, shade(pal.iron, 1.25));
    rr(g, -10, y + 3, 2, 1, pal.ironS);
    rr(g, 8, y + 3, 2, 1, pal.ironS);
    /* planks + boss + straps */
    rr(g, -6, y + 1, 1, 2, pal.woodS);
    rr(g, -2, y + 1, 1, 2, pal.woodS);
    rr(g, 2, y + 1, 1, 2, pal.woodS);
    rr(g, 6, y + 1, 1, 2, pal.woodS);
    rr(g, -2, y + 1, 4, 2, pal.iron);
    rr(g, -1, y + 1, 2, 1, pal.ironS);
    rr(g, -6, y + 4, 2, 2, pal.leather);
    rr(g, 4, y + 4, 2, 2, pal.leather);
    /* rivets */
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
    /* torso — wide and round */
    rr(g, -4, -15 + by, 8, 10, pal.tunic);
    rr(g, -4, -15 + by, 8, 1, pal.tunicL);
    rr(g, -4, -14 + by, 1, 9, pal.tunicS);
    rr(g, -3, -11 + by, 6, 2, pal.tunicL);
    rr(g, -3, -10 + by, 6, 1, shade(pal.tunic, 1.12));
    rr(g, -4, -8 + by, 8, 1, pal.leather);
    rr(g, -1, -8 + by, 2, 1, pal.gold);
    /* fur collar */
    rr(g, -4, -15 + by, 8, 1, pal.fur);
    rr(g, -3, -16 + by, 6, 1, pal.furS);
    drawArm(g, pal, pose.arms[1], false, st === "brace");
    /* head */
    var hx = lean * 2, hy = by;
    /* helmet */
    rr(g, -2 + hx, -23 + hy, 4, 1, pal.metalL);
    rr(g, -4 + hx, -22 + hy, 8, 2, pal.metalS);
    rr(g, -4 + hx, -20 + hy, 8, 1, pal.metal);
    rr(g, -4 + hx, -19 + hy, 8, 1, pal.metalD);
    rr(g, -3 + hx, -22 + hy, 1, 1, pal.gold);
    rr(g, 2 + hx, -22 + hy, 1, 1, pal.gold);
    rr(g, 0 + hx, -19 + hy, 1, 1, pal.metalD);
    /* face */
    rr(g, -3 + hx, -18 + hy, 7, 5, pal.skin);
    rr(g, -3 + hx, -18 + hy, 7, 1, pal.skinS);
    rr(g, -2 + hx, -17 + hy, 1, 1, pal.white);
    rr(g, -2 + hx, -16 + hy, 2, 1, pal.eye);
    rr(g, 2 + hx, -17 + hy, 1, 1, pal.white);
    rr(g, 2 + hx, -16 + hy, 2, 1, pal.eye);
    rr(g, -3 + hx, -17 + hy, 1, 1, pal.hairS);
    rr(g, 3 + hx, -17 + hy, 1, 1, pal.hairS);
    rr(g, 0 + hx, -16 + hy, 2, 2, pal.skinS);
    rr(g, -3 + hx, -14 + hy, 1, 1, pal.blush);
    rr(g, 3 + hx, -14 + hy, 1, 1, pal.blush);
    /* big blond beard */
    rr(g, -4 + hx, -14 + hy, 9, 3, pal.hair);
    rr(g, -3 + hx, -11 + hy, 7, 2, pal.hair);
    rr(g, -2 + hx, -9 + hy, 5, 1, pal.hairS);
    rr(g, -1 + hx, -14 + hy, 4, 1, pal.hairL);
    rr(g, -1 + hx, -13 + hy, 2, 1, "#b08a5a");
    /* shield */
    if (st === "brace" || st === "act") drawOlafShieldOverhead(g, pal, by);
    else drawOlafShield(g, pal);
  }

  function drawDeadViking(g, pal, id) {
    /* sprawled on the ground, head toward +x */
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

  function drawViking(g, a, v) {
    var id = a.id;
    if (id !== "erik" && id !== "baleog" && id !== "olaf") id = "erik";
    var st = a.state || "idle";
    if (st === "gone") return;
    var active = !!a.active;
    var palBase = active ? CHARS[id] : dimPal(id);
    var x = Math.round(a.x), y = Math.round(a.y);
    var t = v.t || 0;
    var anim = a.anim || 0;
    var f;
    if (st === "run") f = Math.floor(anim * 7.5) % 4;
    else if (st === "idle") f = Math.floor(anim * 2.2) % 2;
    else if (st === "jump" || st === "fall") f = Math.floor(anim * 4) % 2;
    else f = Math.floor(anim * 6) % 3;
    /* shadow */
    rr(g, x - 5, y - 1, 10, 2, "rgba(0,0,0,0.36)");
    rr(g, x - 3, y - 1, 6, 1, "rgba(0,0,0,0.45)");
    if (active) rr(g, x - 6, y - 1, 12, 1, "rgba(255,214,110,0.14)");
    if (st === "dead") {
      g.save();
      g.translate(x, y);
      g.scale(a.dir < 0 ? -1 : 1, 1);
      drawDeadViking(g, palBase, id);
      g.restore();
    } else {
      var pose = pickPose(st, f);
      if (id === "olaf") {
        pose.legs[0].hip = -3; pose.legs[1].hip = 3;
        pose.arms[0].sh = -4; pose.arms[1].sh = 4;
        if (st === "idle" || st === "run") {
          pose.arms[0].el[0] = -4; pose.arms[0].hand[0] = -4;
          pose.arms[1].el[0] = 5; pose.arms[1].hand[0] = 5;
        }
      }
      g.save();
      g.translate(x, y);
      g.scale(a.dir < 0 ? -1 : 1, 1);
      if (id === "erik") drawErik(g, palBase, pose, st, f, t);
      else if (id === "baleog") drawBaleog(g, palBase, pose, st, f, t);
      else drawOlaf(g, palBase, pose, st, f, t);
      g.restore();
      if (a.shield && id === "olaf" && st !== "brace" && st !== "act") {
        rr(g, x - 10, y - 30, 20, 2, "rgba(220,230,240,0.30)");
      }
    }
    if (active) {
      var top = (id === "olaf" && (st === "brace" || st === "act")) ? 33 : 25;
      drawActiveMarker(g, x, y, top, t);
    }
  }

  /* ───────────────────────── enemies ───────────────────────── */

  function drawEnemy(g, e, v, theme) {
    var p = pal(theme);
    var x = Math.round(e.x), y = Math.round(e.y);
    var dir = e.dir < 0 ? -1 : 1;
    var f = Math.floor((e.anim || 0) * 5) % 2;
    var die = e.state === "die";
    if (!e.alive && !die) return;
    rr(g, x - 4, y - 1, 8, 2, "rgba(0,0,0,0.36)");
    g.save();
    g.translate(x, y);
    g.scale(dir, 1);
    if (die) {
      /* squashed carcass with X eyes */
      rr(g, -6, -5, 12, 5, "#4a3250");
      rr(g, -6, -5, 12, 1, "#6e4a72");
      rr(g, -5, -2, 3, 2, "#2e1c34");
      rr(g, 2, -2, 3, 2, "#2e1c34");
      rr(g, -1, -8, 6, 4, "#5a3a5e");
      rr(g, -1, -8, 6, 1, "#72507c");
      rr(g, 0, -7, 1, 1, "#ff7050");
      rr(g, 2, -6, 1, 1, "#ff7050");
      rr(g, 3, -7, 1, 1, "#ff7050");
      rr(g, 1, -6, 1, 1, "#ff7050");
    } else {
      var by = f ? 1 : 0;
      /* legs + feet */
      rr(g, -4, -6, 2, 6, "#2e1c34");
      rr(g, 2, -6, 2, 6, "#3a2742");
      rr(g, -5, -2, 3, 2, "#20141f");
      rr(g, 2, -2, 3, 2, "#20141f");
      rr(g, -5, -2, 3, 1, "#4a3250");
      rr(g, 2, -2, 3, 1, "#4a3250");
      /* hunched body */
      rr(g, -4, -16 + by, 8, 10, "#4a3250");
      rr(g, -4, -16 + by, 8, 1, "#6e4a72");
      rr(g, -4, -9 + by, 8, 1, "#2e1c34");
      rr(g, 2, -14 + by, 2, 5, "#33203a");
      rr(g, -2, -13 + by, 4, 4, "#5e4266");
      rr(g, -1, -12 + by, 2, 2, "#7a5484");
      /* arms + claws */
      rr(g, -5, -14 + by, 2, 5, "#4a3250");
      rr(g, 3, -14 + by, 2, 5, "#5a3a5e");
      rr(g, -6, -10 + by, 2, 2, "#c8b090");
      rr(g, 4, -10 + by, 2, 2, "#c8b090");
      rr(g, -6, -9 + by, 1, 1, "#20141f");
      rr(g, 5, -9 + by, 1, 1, "#20141f");
      /* head */
      rr(g, -3, -21 + by, 7, 6, "#5a3a5e");
      rr(g, -3, -21 + by, 7, 1, "#7a5484");
      rr(g, -3, -16 + by, 7, 1, "#3a2742");
      rr(g, -4, -22 + by, 2, 2, "#3a2742");
      rr(g, 3, -22 + by, 2, 2, "#3a2742");
      rr(g, -4, -23 + by, 1, 1, "#7a5484");
      rr(g, 4, -23 + by, 1, 1, "#7a5484");
      /* glowing eyes */
      var eye = p.accent;
      rr(g, -1, -19 + by, 2, 2, eye);
      rr(g, 3, -19 + by, 2, 2, eye);
      rr(g, -1, -19 + by, 1, 1, "#ffffff");
      rr(g, 3, -19 + by, 1, 1, "#ffffff");
      /* mouth + fangs */
      rr(g, 0, -17 + by, 4, 1, "#20141f");
      rr(g, 0, -17 + by, 1, 1, "#e8e0c8");
      rr(g, 3, -17 + by, 1, 1, "#e8e0c8");
      /* back spikes */
      rr(g, -5, -18 + by, 1, 2, "#2e1c34");
      rr(g, -6, -17 + by, 1, 1, "#2e1c34");
      rr(g, -5, -14 + by, 1, 1, "#2e1c34");
    }
    g.restore();
  }

  /* ───────────────────────── arrows ───────────────────────── */

  function drawArrows(g, v) {
    var list = v.arrows || [], i;
    for (i = 0; i < list.length; i++) {
      var a = list[i]; if (!a) continue;
      var dir = a.dir < 0 ? -1 : 1;
      var x = Math.round(a.x), y = Math.round(a.y);
      var shaft = a.hostile ? "#7a3020" : "#a07848";
      var head = a.hostile ? "#ff6040" : "#e8f0fa";
      var fletch = a.hostile ? "#c84030" : "#f2e6c8";
      rr(g, x - dir * 3, y, 6, 1, shaft);
      rr(g, x + dir * 3, y, 2, 1, head);
      rr(g, x + dir * 4, y - 1, 1, 1, head);
      rr(g, x + dir * 4, y + 1, 1, 1, head);
      rr(g, x + dir * 2, y, 1, 1, "#ffffff");
      rr(g, x - dir * 3, y - 1, 2, 1, fletch);
      rr(g, x - dir * 3, y + 1, 2, 1, fletch);
      rr(g, x - dir * 4, y, 1, 1, shaft);
    }
  }

  /* ───────────────────────── fx particles ───────────────────────── */

  function drawFx(g, v, theme) {
    var list = v.fx || [], i, k;
    var p = pal(theme);
    for (i = 0; i < list.length; i++) {
      var f = list[i]; if (!f) continue;
      var ttl = f.ttl > 0 ? f.ttl : 0.4;
      var age = f.age || 0;
      var k1 = clamp01(age / ttl);
      var a = 1 - k1;
      var x = f.x, y = f.y, j, ang, rad;
      var type = f.type;
      if (type === "dust") {
        g.globalAlpha = 0.55 * a;
        for (j = 0; j < 3; j++) {
          var dx = (hash2(i * 5 + j, 3) - 0.5) * 16 * k1;
          var dy = -4 - hash2(j, i) * 8 * k1;
          var s = 1 + ((k1 * 2.5 + hash2(i, j)) | 0);
          rr(g, x + dx - s / 2, y + dy, s, s, j === 1 ? "#e0d8c8" : "#b8b0a0");
        }
      } else if (type === "spark" || type === "hit") {
        g.globalAlpha = a;
        var len = 3 + k1 * 4;
        var col = type === "hit" ? (i % 2 ? "#ff7050" : "#ffffff") : p.accent;
        rr(g, x - len, y, len * 2 + 1, 1, col);
        rr(g, x, y - len, 1, len * 2 + 1, col);
        rr(g, x - 2, y - 2, 5, 1, col);
        rr(g, x - 2, y + 2, 5, 1, col);
        rr(g, x, y, 1, 1, "#ffffff");
      } else if (type === "break") {
        g.globalAlpha = 0.4 + 0.6 * a;
        for (j = 0; j < 5; j++) {
          var vx = (hash2(j + i, 9) - 0.5) * 70 * (f.dir < 0 ? -1 : 1);
          var vy = -30 - hash2(j, 4) * 60;
          var bx = x + vx * age;
          var byy = y + vy * age + 140 * age * age;
          var sz = j === 0 ? 3 : 2;
          rr(g, bx, byy, sz, sz, j % 2 ? p.brick.mid : p.brick.lo);
          if (j === 0) rr(g, bx, byy, sz, 1, p.brick.hi);
        }
      } else if (type === "pickup") {
        g.globalAlpha = a;
        for (j = 0; j < 4; j++) {
          ang = j * Math.PI / 2 + age * 2.5;
          rad = 4 + k1 * 8;
          rr(g, x + Math.cos(ang) * rad, y - 4 + Math.sin(ang) * rad - k1 * 8, 1, 1, j % 2 ? "#ffffff" : "#ffe9a0");
        }
        rr(g, x - 1, y - 4 - k1 * 10, 2, 2, "#f2c24a");
      } else if (type === "death") {
        g.globalAlpha = 0.7 * a;
        for (j = 0; j < 5; j++) {
          var dx2 = (hash2(j + i, 2) - 0.5) * 20 * k1;
          rr(g, x + dx2, y - j * 2 - k1 * 16, 2, 2, j % 2 ? "#8a5a9a" : "#5a3a6a");
        }
        g.globalAlpha = a * 0.8;
        rr(g, x - 1, y - 14 - k1 * 12, 1, 1, "#dfe8ff");
      } else if (type === "level") {
        g.globalAlpha = a;
        for (j = 0; j < 8; j++) {
          ang = j * Math.PI / 4;
          rad = 6 + k1 * 24;
          rr(g, x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 2, 2, j % 2 ? "#ffe9a0" : p.accent);
        }
        rr(g, x - 2, y - 2, 5, 5, "#fff6d0");
      }
      g.globalAlpha = 1;
    }
  }

  /* ───────────────────────── portraits (48×56) ───────────────────────── */

  function drawBustBackdrop(g, id) {
    var cc = CHAR_COLOR[id] || "#7a8a9a";
    rr(g, 0, 0, 48, 56, "#0b0e1c");
    rr(g, 0, 0, 48, 12, "#12162c");
    rr(g, 0, 12, 48, 12, "#0f1326");
    rr(g, 0, 24, 48, 20, "#0c0f20");
    rr(g, 0, 44, 48, 12, "#080a15");
    /* dithered seam */
    g.fillStyle = "#181d38";
    for (var x = 0; x < 48; x += 2) g.fillRect(x, 11, 1, 1);
    for (var x2 = 1; x2 < 48; x2 += 2) g.fillRect(x2, 23, 1, 1);
    /* medallion glow */
    g.globalAlpha = 0.13;
    fillCircle(g, 24, 28, 19, cc);
    g.globalAlpha = 1;
    /* stone frame */
    rr(g, 0, 0, 48, 2, "#2a3154");
    rr(g, 0, 54, 48, 2, "#05060e");
    rr(g, 0, 0, 2, 56, "#242a4a");
    rr(g, 46, 0, 2, 56, "#05060e");
    rr(g, 2, 0, 44, 1, "#3a4470");
    /* corner runes */
    rr(g, 3, 3, 1, 3, cc); rr(g, 4, 4, 1, 1, cc);
    rr(g, 44, 3, 1, 3, cc); rr(g, 43, 4, 1, 1, cc);
    rr(g, 3, 50, 1, 3, modeA(cc)); rr(g, 4, 51, 1, 1, modeA(cc));
    rr(g, 44, 50, 1, 3, modeA(cc)); rr(g, 43, 51, 1, 1, modeA(cc));
    /* bottom plaque */
    rr(g, 10, 51, 28, 2, "#161b34");
    rr(g, 10, 51, 28, 1, "#2c3458");
  }
  function modeA(c) { return mix(c, "#ffffff", 0.35); }

  function drawPortrait(canvas, id, t) {
    if (!canvas) return;
    if (id !== "erik" && id !== "baleog" && id !== "olaf") id = "erik";
    if (canvas.width !== 48 || canvas.height !== 56) { canvas.width = 48; canvas.height = 56; }
    var g = ctx2(canvas);
    if (!g) return;
    t = t || 0;
    g.clearRect(0, 0, 48, 56);
    drawBustBackdrop(g, id);
    var U = 2;
    var bob = Math.sin(t * 2.1 + (id === "erik" ? 0 : id === "baleog" ? 1.4 : 2.7)) > 0.55 ? 1 : 0;
    var blink = ((t * 1.1 + (id === "erik" ? 0.3 : id === "baleog" ? 0.7 : 0.1)) % 3.2) < 0.13;
    function P(x, y, w, h, c) { g.fillStyle = c; g.fillRect(x * U, (y + bob) * U, w * U, h * U); }
    var pal = CHARS[id];
    if (id === "erik") portraitErik(g, P, pal, blink, bob);
    else if (id === "baleog") portraitBaleog(g, P, pal, blink, bob);
    else portraitOlaf(g, P, pal, blink, bob, t);
    /* slow sparkle */
    var sp = (t * 0.8 + 0.35) % 2;
    if (sp < 0.4) {
      g.globalAlpha = 1 - sp / 0.4;
      rr(g, 38, 8, 1, 1, "#fff6c0"); rr(g, 39, 7, 1, 1, "#fff6c0"); rr(g, 37, 7, 1, 1, "#fff6c0");
      g.globalAlpha = 1;
    }
  }

  function portraitErik(g, P, pal, blink, bob) {
    /* horns */
    P(2, 5, 2, 3, pal.cream); P(1, 3, 2, 3, pal.cream); P(2, 2, 1, 2, pal.creamL);
    P(20, 5, 2, 3, pal.cream); P(21, 3, 2, 3, pal.cream); P(21, 2, 1, 2, pal.creamL);
    /* helmet */
    P(5, 2, 14, 2, pal.metalL);
    P(4, 4, 16, 5, pal.metal);
    P(4, 4, 16, 1, pal.metalL);
    P(4, 9, 16, 2, pal.metalS);
    P(4, 10, 16, 1, pal.metalD);
    P(7, 6, 1, 1, pal.gold); P(16, 6, 1, 1, pal.gold);
    /* face */
    P(6, 11, 12, 7, pal.skin);
    P(6, 11, 12, 1, pal.skinS);
    P(6, 11, 2, 4, pal.hairS); /* temples */
    P(16, 11, 2, 4, pal.hairS);
    /* brows + eyes */
    if (blink) {
      P(7, 13, 3, 1, pal.hairS); P(14, 13, 3, 1, pal.hairS);
      P(8, 14, 2, 1, pal.skinD); P(14, 14, 2, 1, pal.skinD);
    } else {
      P(7, 12, 3, 1, pal.hairS); P(14, 12, 3, 1, pal.hairS);
      P(7, 13, 2, 2, "#f4f7ff"); P(14, 13, 2, 2, "#f4f7ff");
      P(8, 14, 1, 1, "#231a2e"); P(15, 14, 1, 1, "#231a2e");
    }
    /* nose + grin */
    P(11, 13, 2, 3, pal.skinS);
    P(11, 15, 1, 1, pal.skinD);
    P(9, 17, 6, 1, "#7a3a20");
    P(10, 17, 4, 1, "#f4e6d0");
    P(7, 16, 1, 1, pal.blush || "#e8a070");
    P(16, 16, 1, 1, "#e8a070");
    /* big red beard */
    P(4, 15, 2, 4, pal.hair);
    P(18, 15, 2, 4, pal.hair);
    P(5, 18, 14, 4, pal.hair);
    P(6, 21, 12, 3, pal.hair);
    P(8, 23, 8, 2, pal.hair);
    P(10, 24, 4, 2, pal.hair);
    P(9, 17, 6, 1, pal.hairL);
    P(6, 19, 2, 1, pal.hairS); P(12, 22, 2, 1, pal.hairS); P(10, 20, 1, 2, pal.hairS);
    /* tunic shoulders */
    P(2, 25, 20, 3, pal.tunic);
    P(2, 25, 20, 1, pal.tunicL);
    P(2, 27, 20, 1, pal.tunicS);
    P(6, 25, 2, 3, pal.leather); P(16, 25, 2, 3, pal.leather);
    P(11, 26, 2, 2, pal.gold);
    P(9, 24, 6, 1, pal.leather);
  }

  function portraitBaleog(g, P, pal, blink, bob) {
    /* bow behind left shoulder */
    P(2, 9, 1, 3, pal.bowL); P(1, 12, 1, 8, pal.bow); P(2, 20, 1, 3, pal.bowL); P(0, 10, 1, 2, pal.bow);
    /* sheathed sword behind right shoulder */
    P(20, 3, 1, 10, pal.blade); P(21, 2, 1, 3, pal.bladeS);
    P(19, 12, 4, 1, pal.gold); P(20, 13, 2, 3, pal.leather); P(19, 16, 4, 1, pal.gold);
    /* helmet */
    P(5, 3, 14, 2, pal.metalL);
    P(4, 5, 16, 5, pal.metal);
    P(4, 5, 16, 1, pal.metalL);
    P(4, 10, 16, 2, pal.metalS);
    P(4, 11, 16, 1, pal.metalD);
    P(5, 10, 16, 1, pal.gold);
    /* nose guard */
    P(11, 11, 2, 8, pal.metalD);
    P(11, 11, 1, 7, pal.metalS);
    /* face */
    P(6, 12, 12, 6, pal.skin);
    P(6, 12, 12, 1, pal.skinS);
    P(6, 12, 1, 5, pal.hairS);
    if (blink) {
      P(7, 14, 3, 1, pal.hairS); P(14, 14, 3, 1, pal.hairS);
    } else {
      P(7, 13, 3, 1, pal.hairS); P(14, 13, 3, 1, pal.hairS);
      P(7, 14, 2, 2, "#f4f7ff"); P(15, 14, 2, 2, "#f4f7ff");
      P(8, 15, 1, 1, "#231a2e"); P(16, 15, 1, 1, "#231a2e");
    }
    P(10, 14, 2, 3, pal.skinS);
    /* moustache + huge brown beard */
    P(9, 17, 6, 1, pal.hairL);
    P(4, 17, 16, 4, pal.hair);
    P(5, 21, 14, 3, pal.hair);
    P(7, 23, 10, 2, pal.hair);
    P(9, 25, 6, 1, pal.hair);
    P(5, 19, 2, 1, pal.hairS); P(15, 20, 2, 1, pal.hairS); P(10, 21, 1, 2, pal.hairS);
    /* braids with gold beads */
    P(4, 20, 2, 4, pal.hair); P(18, 20, 2, 4, pal.hair);
    P(4, 24, 2, 2, pal.gold); P(18, 24, 2, 2, pal.gold);
    /* green tunic shoulders */
    P(2, 25, 20, 3, pal.tunic);
    P(2, 25, 20, 1, pal.tunicL);
    P(2, 27, 20, 1, pal.tunicS);
    P(3, 24, 18, 1, pal.leather);
    P(6, 25, 2, 3, pal.leather); P(16, 25, 2, 3, pal.leather);
    P(11, 25, 2, 2, pal.gold);
  }

  function portraitOlaf(g, P, pal, blink, bob, t) {
    var i, dy, w;
    /* round shield behind */
    for (dy = -11; dy <= 11; dy++) {
      w = Math.floor(Math.sqrt(121 - dy * dy));
      g.fillStyle = dy < 0 ? pal.ironS : shade(pal.ironS, 0.8);
      g.fillRect((12 - w) * 2, (23 + dy + bob) * 2, w * 2 * 2, 2);
    }
    for (dy = -9; dy <= 9; dy++) {
      w = Math.floor(Math.sqrt(81 - dy * dy));
      g.fillStyle = dy < -2 ? pal.woodL : pal.wood;
      g.fillRect((12 - w) * 2, (23 + dy + bob) * 2, w * 2 * 2, 2);
    }
    for (i = 0; i < 3; i++) P(3 + i * 7, 14 + i, 1, 13, shade(pal.wood, 0.7));
    fillCircle(g, 24, (23 + bob) * 2, 5, pal.iron);
    rr(g, 22, (22 + bob) * 2, 4, 2, pal.ironS);
    rr(g, 16, (15 + bob) * 2, 2, 2, pal.gold);
    rr(g, 30, (30 + bob) * 2, 2, 2, pal.gold);
    /* shoulders: blue, wide */
    P(1, 25, 22, 3, pal.tunic);
    P(1, 25, 22, 1, pal.tunicL);
    P(1, 27, 22, 1, pal.tunicS);
    P(4, 24, 16, 1, "#cfd8e4");
    /* helmet */
    P(5, 2, 14, 2, pal.metalL);
    P(4, 4, 16, 3, pal.metalS);
    P(4, 7, 16, 2, pal.metal);
    P(4, 9, 16, 1, pal.metalD);
    P(7, 5, 1, 1, pal.gold); P(16, 5, 1, 1, pal.gold);
    P(11, 7, 2, 5, pal.metalD); /* nose guard */
    /* face */
    P(6, 10, 12, 8, pal.skin);
    P(6, 10, 12, 1, pal.skinS);
    P(7, 16, 2, 1, pal.blush); P(15, 16, 2, 1, pal.blush);
    P(11, 14, 2, 3, pal.skinS);
    if (blink) {
      P(8, 12, 2, 1, pal.skinD); P(14, 12, 2, 1, pal.skinD);
    } else {
      P(7, 12, 2, 2, "#f4f7ff"); P(15, 12, 2, 2, "#f4f7ff");
      P(8, 13, 1, 1, "#231a2e"); P(16, 13, 1, 1, "#231a2e");
      P(7, 11, 3, 1, pal.hairS); P(14, 11, 3, 1, pal.hairS);
    }
    /* mighty light beard */
    P(4, 17, 16, 4, pal.hair);
    P(3, 19, 18, 3, pal.hair);
    P(5, 22, 14, 3, pal.hair);
    P(7, 24, 10, 2, pal.hair);
    P(9, 26, 6, 1, pal.hair);
    P(7, 18, 10, 1, pal.hairL);
    P(5, 21, 1, 2, pal.hairS); P(17, 22, 1, 2, pal.hairS); P(11, 23, 2, 2, pal.hairS);
    /* moustache */
    P(8, 18, 8, 1, pal.hairL);
    P(9, 19, 6, 1, pal.hair);
    /* warm breath in the cold */
    var puff = (t * 0.9) % 3;
    if (puff < 0.7) {
      g.globalAlpha = 1 - puff / 0.7;
      rr(g, 20, (19 + bob) * 2, 2, 1, "#cfe0f0");
      rr(g, 23, (18 + bob) * 2, 2, 1, "#cfe0f0");
      g.globalAlpha = 1;
    }
  }

  /* ───────────────────────── game frame ───────────────────────── */

  var gameCanvas = null, gameCtx = null;

  function draw(view) {
    if (!view || !gameCtx) return;
    var g = gameCtx;
    var t = +view.t || 0;
    var theme = PAL[view.theme] ? view.theme : "cave";
    var p = pal(theme), T = tiles(theme), B = backdrop(theme);
    var i, actors;

    rr(g, 0, 0, MW, MH, shade(p.sky[0], 0.85));
    var shake = clamp01(+view.shake || 0);
    var ox = 0, oy = 0;
    if (shake > 0) {
      var amp = shake * 3;
      ox = Math.round(Math.sin(t * 71) * amp);
      oy = Math.round(Math.cos(t * 57) * amp);
    }
    g.save();
    if (ox || oy) g.translate(ox, oy);

    g.drawImage(B, 0, 0);
    drawMotes(g, theme, p, t);
    drawTerrain(g, view, p, T, theme);
    drawPlates(g, view, p);
    drawLevers(g, view, p);
    drawTraps(g, view, p);
    drawGates(g, view, p, view.terrain || []);
    drawTreasures(g, view);
    drawExits(g, view, p);

    var enemies = view.enemies || [];
    for (i = 0; i < enemies.length; i++) if (enemies[i]) drawEnemy(g, enemies[i], view, theme);

    actors = view.actors || [];
    for (i = 0; i < actors.length; i++) if (actors[i] && !actors[i].active) drawViking(g, actors[i], view);
    for (i = 0; i < actors.length; i++) if (actors[i] && actors[i].active) drawViking(g, actors[i], view);

    drawArrows(g, view);
    drawFx(g, view, theme);
    g.restore();

    var flash = clamp01(+view.flash || 0);
    if (flash > 0) {
      g.globalAlpha = Math.min(0.6, flash * 0.65);
      rr(g, 0, 0, MW, MH, "#fff6e0");
      g.globalAlpha = 1;
    }
  }

  function init(canvas) {
    gameCanvas = canvas || (document.getElementById ? document.getElementById("cv-retro") : null);
    gameCtx = gameCanvas ? ctx2(gameCanvas) : null;
    if (gameCtx) gameCtx.imageSmoothingEnabled = false;
  }

  /* ───────────────────────── title screen backdrop (384×240) ───────────────────────── */

  var TITLE_SKY = ["#03040d", "#090a1e", "#120e30", "#201442"];

  function titleStars(g, t) {
    var i, x, y, s, tw;
    for (i = 0; i < 78; i++) {
      x = Math.floor(hash2(i, 11) * MW);
      y = Math.floor(hash2(i, 23) * 132) + 2;
      s = hash2(i, 37);
      tw = 0.45 + 0.55 * Math.sin(t * (0.8 + s * 1.6) + i * 1.7);
      if (tw < 0.08) continue;
      g.globalAlpha = 0.35 + tw * 0.65;
      var col = s > 0.85 ? "#ffe9a8" : s > 0.6 ? "#cfe0ff" : "#ffffff";
      rr(g, x, y, 1, 1, col);
      if (s > 0.9 && tw > 0.7) {
        rr(g, x - 1, y, 1, 1, "rgba(255,255,255,0.5)");
        rr(g, x + 1, y, 1, 1, "rgba(255,255,255,0.5)");
        rr(g, x, y - 1, 1, 1, "rgba(255,255,255,0.5)");
        rr(g, x, y + 1, 1, 1, "rgba(255,255,255,0.5)");
      }
    }
    g.globalAlpha = 1;
  }

  var AUR = ["#48e0a0", "#58c8ff", "#a06aff"];

  function titleAurora(g, t) {
    var r, x, k, y, a, yy;
    for (r = 0; r < 3; r++) {
      for (x = 0; x < MW; x += 2) {
        y = 38 + r * 21 + Math.sin(x * 0.021 + t * (0.5 + r * 0.17) + r * 2.1) * 12 + Math.sin(x * 0.055 - t * 0.35 + r) * 4;
        var shimmer = 0.72 + 0.28 * Math.sin(t * 1.3 + x * 0.013 + r * 1.7);
        /* soft dithered body */
        for (k = -12; k <= 12; k += 2) {
          if ((((x >> 1) + (k >> 1) + r) % 3) === 0) continue;
          a = (0.10 + 0.10 * (1 - Math.abs(k) / 12)) * shimmer;
          g.globalAlpha = a;
          rr(g, x, Math.round(y + k), 2, 2, AUR[r]);
        }
        /* hot core line */
        g.globalAlpha = 0.34 * shimmer;
        rr(g, x, Math.round(y), 2, 2, mix(AUR[r], "#ffffff", 0.45));
        g.globalAlpha = 0.20 * shimmer;
        rr(g, x, Math.round(y) + 2, 2, 1, AUR[r]);
        /* vertical rain streaks */
        if (((x >> 1) + r) % 7 === 0) {
          for (yy = 6; yy < 26; yy += 3) {
            g.globalAlpha = 0.10 * shimmer * (1 - yy / 30);
            rr(g, x, Math.round(y) + yy, 1, 2, AUR[r]);
          }
        }
      }
    }
    g.globalAlpha = 1;
  }

  function titleMountains(g) {
    var i, x, pts, far = "#0b0f28", near = "#06081a", snow = "#1e2a4e";
    /* far range */
    pts = [0, 240];
    for (i = 0; i <= 384; i += 24) {
      var h = 116 + Math.sin(i * 0.037) * 16 + hash2(i, 5) * 22;
      pts.push(i, Math.round(240 - h));
    }
    pts.push(384, 240);
    poly(g, pts, far);
    /* snow caps (far) */
    for (i = 24; i < 384; i += 24) {
      var hh = 116 + Math.sin(i * 0.037) * 16 + hash2(i, 5) * 22;
      poly(g, [i - 7, 240 - hh + 15, i, 240 - hh, i + 7, 240 - hh + 15], snow);
    }
    /* near range */
    pts = [0, 240];
    for (i = 0; i <= 384; i += 32) {
      var h2 = 70 + Math.sin(i * 0.05 + 1.2) * 12 + hash2(i, 9) * 18;
      pts.push(i, Math.round(240 - h2 + 34));
    }
    pts.push(384, 240);
    poly(g, pts, near);
    /* snow on near ridges */
    for (i = 32; i < 384; i += 32) {
      var hn = 70 + Math.sin(i * 0.05 + 1.2) * 12 + hash2(i, 9) * 18;
      var yy = Math.round(240 - hn + 34);
      poly(g, [i - 9, yy + 10, i, yy, i + 9, yy + 10], "#121c38");
    }
  }

  function drawPine(g, x, baseY, h, col, snowCol) {
    var trunkW = 3, i, w;
    rr(g, x - 1, baseY - h * 0.28, trunkW, h * 0.28, "#04050c");
    for (i = 0; i < 3; i++) {
      var ty = baseY - h * 0.22 - i * h * 0.26;
      w = h * (0.32 - i * 0.06);
      poly(g, [x, ty - h * 0.34, x - w, ty, x + w, ty], i === 0 ? col : shade(col, 1.18));
      /* snow on upper edges */
      poly(g, [x, ty - h * 0.34, x - w * 0.55, ty - h * 0.14, x, ty - h * 0.2], snowCol);
      poly(g, [x, ty - h * 0.34, x + w * 0.55, ty - h * 0.14, x, ty - h * 0.2], snowCol);
    }
  }

  function drawRunestone(g, x, baseY, t, accent) {
    rr(g, x - 9, baseY - 34, 18, 34, "#101426");
    rr(g, x - 9, baseY - 34, 18, 1, "#252c4a");
    rr(g, x - 10, baseY - 35, 20, 3, "#161b32");
    poly(g, [x - 9, baseY - 34, x, baseY - 44, x + 9, baseY - 34], "#161b32");
    poly(g, [x - 9, baseY - 34, x, baseY - 44, x + 9, baseY - 34], "rgba(255,255,255,0.06)");
    /* carved rune, 2×2 pixels per glyph pixel */
    var pulse = 0.5 + 0.5 * Math.sin(t * 2);
    var rc = mix(accent, "#ffffff", 0.25 + pulse * 0.4);
    var glyph = ["#.#", "###", "#.#", "###", "#.#", "#.#"];
    for (var gr = 0; gr < glyph.length; gr++) {
      for (var gc = 0; gc < 3; gc++) {
        if (glyph[gr].charAt(gc) === "#") rr(g, x - 3 + gc * 2, baseY - 27 + gr * 2, 2, 2, rc);
      }
    }
    g.globalAlpha = 0.16 + pulse * 0.16;
    fillCircle(g, x, baseY - 20, 7, accent);
    g.globalAlpha = 1;
    rr(g, x - 1, baseY - 10, 2, 2, mix(accent, "#ffffff", 0.5));
    /* snow cap */
    poly(g, [x - 10, baseY - 35, x, baseY - 45, x + 10, baseY - 35], "#2a3558");
    poly(g, [x - 6, baseY - 37, x, baseY - 43, x + 6, baseY - 37], "#3a4874");
  }

  function titleGround(g, t) {
    var i;
    poly(g, [0, 240, 0, 218, 52, 212, 110, 218, 168, 210, 232, 219, 300, 211, 350, 217, 384, 213, 384, 240], "#090b18");
    poly(g, [0, 240, 0, 222, 66, 217, 136, 223, 210, 216, 286, 223, 384, 217, 384, 240], "#0d1020");
    /* snow highlights */
    for (i = 0; i < 12; i++) {
      var sx = hash2(i, 41) * 384;
      rr(g, sx, 216 + hash2(i, 43) * 6, 3 + ((hash2(i, 47) * 8) | 0), 1, "#1e2748");
    }
    /* drifting snow */
    for (i = 0; i < 40; i++) {
      var s = hash2(i, 3);
      var x = (hash2(i, 1) * MW + t * (5 + s * 14) + Math.sin(t * 0.8 + i) * 5) % MW;
      var y = (hash2(i, 7) * 240 + t * (6 + s * 10)) % 240;
      g.globalAlpha = 0.25 + 0.55 * hash2(i, 9);
      rr(g, x | 0, y | 0, 1, 1, "#dce8ff");
    }
    g.globalAlpha = 1;
  }

  function drawTitle(canvas, t) {
    if (!canvas) return;
    if (canvas.width !== MW || canvas.height !== MH) { canvas.width = MW; canvas.height = MH; }
    var g = ctx2(canvas);
    if (!g) return;
    t = +t || 0;
    g.clearRect(0, 0, MW, MH);
    skyBands(g, TITLE_SKY);
    titleStars(g, t);
    titleAurora(g, t);
    /* crescent moon: pale disc bitten by the exact sky colour behind it */
    var moonSky = mix(TITLE_SKY[1], TITLE_SKY[2], 0.28);
    fillCircle(g, 320, 34, 12, "#efe9cf");
    fillCircle(g, 326, 30, 11, moonSky);
    /* dither halo + a couple of faint craters on the lit edge */
    g.globalAlpha = 0.12;
    fillCircle(g, 316, 37, 18, "#cfe0ff");
    g.globalAlpha = 1;
    for (var mh = 0; mh < 22; mh++) {
      var ma = mh * 2.1;
      var mx = Math.round(316 + Math.cos(ma) * (16 + (mh % 3)));
      var my = Math.round(36 + Math.sin(ma) * (13 + (mh % 2)));
      rr(g, mx, my, 1, 1, "#1b2140");
    }
    rr(g, 313, 27, 2, 2, "#d8d2b8");
    rr(g, 317, 40, 2, 1, "#d8d2b8");
    titleMountains(g);
    drawPine(g, 26, 224, 78, "#05070f", "#141c38");
    drawPine(g, 58, 228, 54, "#060810", "#101830");
    drawPine(g, 342, 226, 62, "#05070f", "#141c38");
    drawPine(g, 368, 230, 44, "#060810", "#101830");
    titleGround(g, t);
    drawRunestone(g, 108, 228, t, "#58c8ff");
    /* light haze over the ridge */
    g.globalAlpha = 0.06;
    rr(g, 0, 150, MW, 1, "#8fb8e0");
    rr(g, 0, 152, MW, 1, "#8fb8e0");
    g.globalAlpha = 1;
  }

  /* ───────────────────────── export ───────────────────────── */

  window.LV_RETRO = {
    init: init,
    draw: draw,
    drawPortrait: drawPortrait,
    drawTitle: drawTitle
  };
})();
