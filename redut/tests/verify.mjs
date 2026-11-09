/* РЕДУТ · verify.mjs — безбраузерная проверка загрузки и обоих рендереров.
   Грузит все 7 скриптов под шимом window/document/canvas (программный растр),
   запускает игру, прогоняет кадры в ретро и неон, провоцирует gameover/win и
   ловит любые исключения и console.error. Опционально пишет PNG кадра:
     node redut/tests/verify.mjs                 — только проверка
     node redut/tests/verify.mjs --png retro OUT — кадр ретро в OUT.png
     node redut/tests/verify.mjs --png modern OUT — кадр неон */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

// ---------- программный Canvas 2D ----------
function parseColor(s) {
  if (!s) return [0, 0, 0, 0];
  if (s.__grad) { const a = parseColor(s.stops[0][1]), b = parseColor(s.stops[s.stops.length - 1][1]); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, (a[3] + b[3]) / 2]; }
  s = String(s).trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s); if (m) { const h = m[1]; return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1]; }
  m = /^#([0-9a-f]{6})$/i.exec(s); if (m) { const h = m[1]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1]; }
  m = /^rgba?\(([^)]+)\)$/i.exec(s); if (m) { const p = m[1].split(',').map(x => parseFloat(x)); return [p[0] | 0, p[1] | 0, p[2] | 0, p[3] === undefined ? 1 : p[3]]; }
  return [200, 200, 200, 1];
}
function makeCtx(canvas) {
  function dims() {
    const W = canvas.width, H = canvas.height;
    if (!canvas._fb || canvas._fbW !== W || canvas._fbH !== H) { canvas._fb = new Uint8ClampedArray(W * H * 4); canvas._fbW = W; canvas._fbH = H; }
    return [W, H, canvas._fb];
  }
  const st = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, globalAlpha: 1 };
  const stack = [];
  function blend(x, y, col) {
    const d = dims(), W = d[0], H = d[1], fb = d[2];
    x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4, a = col[3] * st.globalAlpha;
    fb[i] = col[0] * a + fb[i] * (1 - a); fb[i + 1] = col[1] * a + fb[i + 1] * (1 - a);
    fb[i + 2] = col[2] * a + fb[i + 2] * (1 - a); fb[i + 3] = Math.max(fb[i + 3], a * 255);
  }
  function rect(x, y, w, h, col) {
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) blend(xx, yy, col);
  }
  const ctx = {
    canvas, set fillStyle(v) { st.fillStyle = v; }, get fillStyle() { return st.fillStyle; },
    set strokeStyle(v) { st.strokeStyle = v; }, get strokeStyle() { return st.strokeStyle; },
    set lineWidth(v) { st.lineWidth = v; }, get lineWidth() { return st.lineWidth; },
    font: '', textAlign: '', textBaseline: '', imageSmoothingEnabled: false, shadowColor: '', shadowBlur: 0, globalAlpha: 1,
    save() { stack.push(Object.assign({}, st)); }, restore() { const p = stack.pop(); if (p) Object.assign(st, p); },
    fillRect(x, y, w, h) { rect(x, y, w, h, parseColor(st.fillStyle)); },
    clearRect(x, y, w, h) { const d = dims(), W = d[0], H = d[1], fb = d[2]; x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h); for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) { if (xx >= 0 && yy >= 0 && xx < W && yy < H) { const i = (yy * W + xx) * 4; fb[i] = fb[i + 1] = fb[i + 2] = fb[i + 3] = 0; } } },
    strokeRect(x, y, w, h) { const c = parseColor(st.strokeStyle), lw = Math.max(1, st.lineWidth | 0); rect(x, y, w, lw, c); rect(x, y + h - lw, w, lw, c); rect(x, y, lw, h, c); rect(x + w - lw, y, lw, h, c); },
    fillText() {}, strokeText() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, stroke() {}, arc() {},
    createLinearGradient() { return { __grad: true, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }; },
    createRadialGradient() { return { __grad: true, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } }; },
    drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh) {
      if (arguments.length <= 5) { dx = sx; dy = sy; dw = sw === undefined ? src.width : sw; dh = sh === undefined ? src.height : sh; sx = 0; sy = 0; sw = src.width; sh = src.height; }
      const sfb = src._fb, sW = src.width; if (!sfb) return;
      for (let yy = 0; yy < dh; yy++) for (let xx = 0; xx < dw; xx++) {
        const u = Math.min(sw - 1, (xx / dw * sw) | 0), v = Math.min(sh - 1, (yy / dh * sh) | 0);
        const si = ((sy + v) * sW + (sx + u)) * 4;
        blend(dx + xx, dy + yy, [sfb[si], sfb[si + 1], sfb[si + 2], sfb[si + 3] / 255]);
      }
    }
  };
  return ctx;
}
function makeCanvas(w, h) { const c = { width: w || 300, height: h || 150, style: {} }; c.getContext = () => c._ctx || (c._ctx = makeCtx(c)); return c; }

// ---------- шим DOM ----------
const noopEl = () => { const e = { style: {}, width: 960, height: 600, textContent: '', innerHTML: '', onclick: null, setAttribute() {}, getAttribute() { return null; }, addEventListener() {}, getContext: null, _ctx: null }; e.getContext = () => e._ctx || (e._ctx = makeCtx({ width: 960, height: 600, _fb: null, get _fbRef() {} }) ) ; return e; };
const mainCanvas = makeCanvas(960, 600);
const elements = { game: mainCanvas };
let errors = [];
const sandbox = {
  console: { log() {}, warn() {}, error(...a) { errors.push(a.join(' ')); } },
  Math, Array, Object, Date, JSON, String, Number, parseInt, parseFloat, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
  requestAnimationFrame: () => 0, cancelAnimationFrame() {},
  localStorage: { _d: {}, getItem(k) { return k in this._d ? this._d[k] : null; }, setItem(k, v) { this._d[k] = String(v); } },
  AudioContext: undefined, webkitAudioContext: undefined
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.document = {
  readyState: 'complete',
  documentElement: { setAttribute() {}, getAttribute() { return 'retro'; } },
  getElementById(id) { return elements[id] || (elements[id] = noopEl()); },
  createElement(tag) { return tag === 'canvas' ? makeCanvas(300, 150) : noopEl(); },
  addEventListener() {}
};
vm.createContext(sandbox);

// ---------- загрузка модулей ----------
const FILES = ['js/i18n.js', 'js/audio.js', 'js/game.js', 'js/classic.js', 'js/modern.js', 'js/ui.js', 'js/main.js'];
for (const f of FILES) {
  try { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), sandbox, { filename: f }); }
  catch (e) { console.log('FAIL load ' + f + ': ' + e.message); process.exit(1); }
}
const dbg = sandbox.__REDUT;
if (!dbg) { console.log('FAIL: boot не выполнился, нет window.__REDUT'); process.exit(1); }

// ---------- прогон ----------
function run(scenario) {
  errors = [];
  dbg.startGame();
  const g = dbg.game(); const s = g.state();
  dbg.setGfx(scenario);
  // немного боя: движение, стрельба, спаун врагов
  s.intro = 0;
  for (let i = 0; i < 240; i++) {
    g.setHeld(0, ['up', 'right', 'down', 'left'][(i / 20 | 0) % 4], true);
    if (i % 7 === 0) g.fire(0);
    if (i % 90 === 45) { s.powerups.push({ kind: ['shield', 'freeze', 'life', 'upgrade'][i % 4], x: 200, y: 200, t: 0, life: 10 }); }
    dbg.tick(1 / 60);
  }
  return s;
}
let ok = true;
for (const sc of ['retro', 'modern']) {
  const s = run(sc);
  if (errors.length) { ok = false; console.log('FAIL [' + sc + '] console.error: ' + errors.join(' | ')); }
  else console.log('ok   рендер [' + sc + '] — 240 кадров боя без ошибок');
}
// gameover и win кадры
try {
  dbg.startGame(); const g = dbg.game(); const s = g.state(); s.intro = 0;
  s.base.alive = false; s.phase = 'gameover'; dbg.setGfx('retro'); dbg.tick(0.016); dbg.setGfx('modern'); dbg.tick(0.016);
  s.phase = 'win'; dbg.tick(0.016);
  if (errors.length) { ok = false; console.log('FAIL финальные экраны: ' + errors.join(' | ')); }
  else console.log('ok   экраны gameover/win рисуются без ошибок');
} catch (e) { ok = false; console.log('FAIL финальные экраны: ' + e.message); }

// ---------- PNG (для превью) ----------
function writePng(canvas, out) {
  const W = canvas.width, H = canvas.height, fb = canvas._fb;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; for (let x = 0; x < W * 4; x++) raw[y * (W * 4 + 1) + 1 + x] = fb[y * W * 4 + x]; }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type); const body = Buffer.concat([t, data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(body)); return Buffer.concat([len, body, cr]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
  fs.writeFileSync(out, png);
}

const argi = process.argv.indexOf('--png');
if (argi > -1) {
  const mode = process.argv[argi + 1], out = process.argv[argi + 2];
  dbg.startGame(); const g = dbg.game(); const s = g.state(); s.intro = 0;
  dbg.setGfx(mode);
  // живописный кадр: спауним врагов, двигаем, бьём кирпич
  for (let i = 0; i < 70; i++) { g.setHeld(0, ['right','up','left'][(i/18|0)%3], true); if (i % 5 === 0) g.fire(0); dbg.tick(1 / 60); }
  s.powerups.push({ kind: 'shield', x: 360, y: 420, t: 0, life: 10 });
  s.powerups.push({ kind: 'upgrade', x: 160, y: 300, t: 0, life: 10 });
  dbg.tick(1 / 60);
  writePng(mainCanvas, out);
  console.log('PNG ' + mode + ' → ' + out);
}

console.log('\n' + (ok ? 'OK' : 'НЕУСПЕХ') + ' проверка рендера');
process.exit(ok ? 0 : 1);
