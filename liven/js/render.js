/* ЛИВЕНЬ · рендер обеих тем на canvas 640×600: поле 400×600 слева, панель справа.
   modern — грозовое небо с облаками в несколько слоёв, косым дождём и зарницами; раскалённые заклёпки со свечением,
   механические Звонари-колокола из бронзы с руками-молотами, искра-челнок (веретено с окошком-искрой). retro — поле в 200×300 и
   растягивается без сглаживания (крупный пиксель), 16-цветная палитра, плоские заливки, сканлайны.
   Спрайты пуль кэшируются по (тема, вид, цвет); пули рисуются из пула без аллокаций. LIVEN.render = { draw, fx, update, ... }. */
(function (global) {
  'use strict';
  var LV = global.LIVEN = global.LIVEN || {};
  var K = LV.logic.K, FW = K.FW, FH = K.FH, SBX = 400, TAU = Math.PI * 2;

  var PM = { retro: false, bg: '#0b0d16', panel: '#121522', line: '#2a2f45', ink: '#f1eef8', muted: '#9aa0b8', accent: '#ff7a3d', good: '#5ff0b0', bad: '#ff5d6c', warn: '#ffc34d', teal: '#5fe0d0',
    bc: ['#ff7a1a', '#ffe9c2', '#ff3b55', '#ffcf3a', '#45cfff', '#b98cff', '#5ff0b0', '#ff7ac8'],
    core: ['#fff1d0', '#ffffff', '#ffe0e4', '#fffbe0', '#e8fbff', '#f6eeff', '#eafff6', '#ffeef8'],
    sky: [
      ['#0a0f20', '#1d1830', '#3a2a40', '#ff8a3d', '#2e2c48', '#4a4466'],
      ['#0d141f', '#1f2a38', '#2e3a4c', '#ffb06a', '#3c4a5e', '#5d6e84'],
      ['#0e0a1e', '#1e1238', '#2c1a4c', '#c79bff', '#3a2a5e', '#5a4386'],
      ['#081621', '#14304a', '#1f4560', '#bfe8ff', '#2f5a76', '#6d97b0'],
      ['#160d18', '#2c1820', '#4a2a1c', '#ffc85a', '#5a3428', '#93603a']
    ],
    bronze: '#c98a4a', bronzeD: '#6e4422', bronzeL: '#f2c58a', steel: '#b8c4d4', steelD: '#4a5466', molten: '#ff8a2a', glowC: '#ffd38a' };
  var PR = { retro: true, bg: '#000000', panel: '#000000', line: '#5555ff', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55', good: '#55ff55', bad: '#ff5555', warn: '#ffff55', teal: '#55ffff',
    bc: ['#ffaa55', '#ffffff', '#ff5555', '#ffff55', '#55ffff', '#ff55ff', '#55ff55', '#ff55ff'],
    core: ['#ffffff', '#ffff55', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff'],
    sky: [
      ['#000000', '#000000', '#000055', '#aa5500', '#000040', '#000077'],
      ['#000000', '#000000', '#222222', '#ffaa55', '#222222', '#555555'],
      ['#000000', '#000000', '#220022', '#ff55ff', '#220022', '#550055'],
      ['#000000', '#000000', '#002222', '#55ffff', '#002222', '#005555'],
      ['#000000', '#000000', '#221100', '#ffff55', '#221100', '#552200']
    ],
    bronze: '#aa5500', bronzeD: '#550000', bronzeL: '#ffaa55', steel: '#aaaaaa', steelD: '#555555', molten: '#ffaa55', glowC: '#ffff55' };

  function mk(w, h) { var c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; }
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967296; }
  function rr(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  // ---------- спрайты пуль ----------
  // modern: рисуются в полном масштабе, капли и иглы — «носом» по +x (поворачиваются по скорости);
  // retro: пиксельные, в половинном масштабе, без поворота (иглы — 8 направлений).
  var VIS = [5, 6.5, 11, 7, 6.5];
  var sprM = {}, sprR = {};
  function spriteM(k, c) {
    var key = k * 8 + c; if (sprM[key]) return sprM[key];
    var v = VIS[k], pad = k === 2 ? 8 : 6, w = Math.ceil((v + pad) * 2) + (k === 1 || k === 3 ? 8 : 0), h = Math.ceil((v + pad) * 2);
    var cv = mk(w, h), x = cv.getContext('2d'), cx = w / 2, cy = h / 2, col = PM.bc[c], core = PM.core[c];
    var g = x.createRadialGradient(cx, cy, 0, cx, cy, v + pad); g.addColorStop(0, col); g.addColorStop(0.45, col + '88'); g.addColorStop(1, col + '00');
    x.fillStyle = g; x.globalAlpha = 0.55; x.beginPath(); x.arc(cx, cy, v + pad, 0, TAU); x.fill(); x.globalAlpha = 1;
    x.fillStyle = col; x.strokeStyle = core;
    if (k === 1) { // капля: круглый «нос» по +x, хвост назад
      x.beginPath(); x.arc(cx + 2, cy, v * 0.78, -Math.PI / 2, Math.PI / 2); x.quadraticCurveTo(cx - v * 0.6, cy + v * 0.5, cx - v * 1.5, cy); x.quadraticCurveTo(cx - v * 0.6, cy - v * 0.5, cx + 2, cy - v * 0.78); x.fill();
      x.fillStyle = core; x.beginPath(); x.ellipse(cx + 1.5, cy, v * 0.42, v * 0.36, 0, 0, TAU); x.fill();
    } else if (k === 3) { // игла
      x.beginPath(); x.ellipse(cx, cy, v * 1.25, v * 0.42, 0, 0, TAU); x.fill();
      x.fillStyle = core; x.beginPath(); x.ellipse(cx + 1, cy, v * 0.8, v * 0.2, 0, 0, TAU); x.fill();
    } else if (k === 4) { // шестерёнка: 6 зубцов и ступица
      x.beginPath(); for (var i = 0; i < 12; i++) { var a = i * Math.PI / 6, r = i % 2 ? v * 0.7 : v; x.lineTo(cx + Math.cos(a - 0.22) * r, cy + Math.sin(a - 0.22) * r); x.lineTo(cx + Math.cos(a + 0.22) * r, cy + Math.sin(a + 0.22) * r); } x.closePath(); x.fill();
      x.fillStyle = core; x.beginPath(); x.arc(cx, cy, v * 0.42, 0, TAU); x.fill();
    } else if (k === 2) { // заклёпка: раскалённая шляпка с ободом и бликом-прорезью
      x.beginPath(); x.arc(cx, cy, v, 0, TAU); x.fill();
      x.fillStyle = core; x.beginPath(); x.arc(cx, cy, v * 0.66, 0, TAU); x.fill();
      x.strokeStyle = col; x.lineWidth = 1.4; x.beginPath(); x.arc(cx, cy, v * 0.66, 0, TAU); x.stroke();
      x.fillStyle = 'rgba(255,255,255,.9)'; x.beginPath(); x.ellipse(cx - v * 0.2, cy - v * 0.24, v * 0.3, v * 0.14, -0.5, 0, TAU); x.fill();
    } else { // окалина-точка: ободок цвета + светлая сердцевина
      x.beginPath(); x.arc(cx, cy, v, 0, TAU); x.fill();
      x.fillStyle = core; x.beginPath(); x.arc(cx, cy, v * 0.55, 0, TAU); x.fill();
    }
    cv.hw = w / 2; cv.hh = h / 2; sprM[key] = cv; return cv;
  }
  function spriteR(k, c, dir) {
    var key = (k * 8 + c) * 8 + (dir || 0); if (sprR[key]) return sprR[key];
    var col = PR.bc[c], core = PR.core[c], cv, x, i, j;
    function px(xx, yy, cl) { x.fillStyle = cl; x.fillRect(xx, yy, 1, 1); }
    if (k === 3) {
      cv = mk(7, 7); x = cv.getContext('2d');
      var a = dir * Math.PI / 4, dx = Math.cos(a), dy = Math.sin(a);
      for (i = -3; i <= 3; i++) px(Math.round(3 + dx * i), Math.round(3 + dy * i), Math.abs(i) <= 1 ? core : col);
    } else {
      var R = k === 2 ? 5 : k === 0 ? 2 : 3, s = R * 2 + 1; cv = mk(s, s); x = cv.getContext('2d');
      for (j = -R; j <= R; j++) for (i = -R; i <= R; i++) {
        var d = k === 1 || k === 4 ? Math.abs(i) + Math.abs(j) : Math.sqrt(i * i + j * j);
        if (d <= R + (k === 1 || k === 4 ? 0 : 0.3)) px(i + R, j + R, d <= R * 0.45 ? core : col);
      }
    }
    cv.hw = cv.width / 2; cv.hh = cv.height / 2; sprR[key] = cv; return cv;
  }

  // ---------- облака (кэш по теме и этапу) ----------
  var cloudCache = {};
  function clouds(P, sky, layer) {
    var key = (P.retro ? 'r' : 'm') + sky + ':' + layer; if (cloudCache[key]) return cloudCache[key];
    var sc = P.retro ? 0.5 : 1, w = FW * sc, h = FH * sc, cv = mk(w, h), x = cv.getContext('2d'), S = P.sky[sky], seed = sky * 977 + layer * 131;
    var col = layer ? S[5] : S[4], n = layer ? 9 : 14;
    for (var i = 0; i < n; i++) {
      var cx = hash(seed + i * 3) * w, cy = hash(seed + i * 3 + 1) * h, r = (40 + hash(seed + i * 3 + 2) * 70) * sc * (layer ? 0.8 : 1.2);
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) { // бесшовно по краям
        var X = cx + dx * w, Y = cy + dy * h;
        if (X + r * 2 < 0 || X - r * 2 > w || Y + r < 0 || Y - r > h) continue;
        if (P.retro) {
          x.fillStyle = col;
          // редкий дизеринг (1 пиксель из 4) — облака не спорят с пулями по контрасту
          for (var yy = -r * 0.5; yy < r * 0.5; yy += 1) { var hw = Math.sqrt(Math.max(0, 1 - (yy / (r * 0.5)) * (yy / (r * 0.5)))) * r * 1.6; for (var xx = -hw; xx < hw; xx += 1) { var qx = (X + xx) | 0, qy = (Y + yy) | 0; if ((qx % 2 === 0 && qy % 2 === 0) || (Math.abs(xx) < hw * 0.3 && (qx + qy) % 2 === 0)) x.fillRect(qx, qy, 1, 1); } }
        } else {
          var g = x.createRadialGradient(X, Y, 0, X, Y, r * 1.6); g.addColorStop(0, col + (layer ? '66' : '88')); g.addColorStop(1, col + '00');
          x.fillStyle = g; x.save(); x.translate(X, Y); x.scale(1.6, 0.6); x.beginPath(); x.arc(0, 0, r, 0, TAU); x.restore(); x.fill();
        }
      }
    }
    cloudCache[key] = cv; return cv;
  }

  // ---------- FX: пул частиц и всплывающих надписей ----------
  var FXN = 900, fx = { n: 0, x: new Float32Array(FXN), y: new Float32Array(FXN), vx: new Float32Array(FXN), vy: new Float32Array(FXN), t: new Float32Array(FXN), life: new Float32Array(FXN), s: new Float32Array(FXN), c: new Uint8Array(FXN) };
  var FXCOL = ['#ffd38a', '#ff7a1a', '#ffffff', '#5fe0d0', '#ff5d6c', '#ffcf3a', '#b98cff', '#45cfff'];
  var FXCOLR = ['#ffff55', '#ffaa55', '#ffffff', '#55ffff', '#ff5555', '#ffff55', '#ff55ff', '#55ffff'];
  function spawn(x, y, n, c, sp, life, size) {
    for (var i = 0; i < n; i++) {
      if (fx.n >= FXN) return;
      var j = fx.n++, a = Math.random() * TAU, v = sp * (0.3 + Math.random() * 0.7);
      fx.x[j] = x; fx.y[j] = y; fx.vx[j] = Math.cos(a) * v; fx.vy[j] = Math.sin(a) * v; fx.t[j] = 0; fx.life[j] = life * (0.6 + Math.random() * 0.4); fx.s[j] = size; fx.c[j] = c;
    }
  }
  var pops = []; for (var pi = 0; pi < 28; pi++) pops.push({ on: false, x: 0, y: 0, t: 0, text: '', c: 0, big: false });
  function pop(x, y, text, c, big) { var o = null; for (var i = 0; i < pops.length; i++) if (!pops[i].on) { o = pops[i]; break; } if (!o) o = pops[0]; o.on = true; o.x = x; o.y = y; o.t = big ? 1.4 : 0.8; o.text = text; o.c = c; o.big = !!big; }
  var waves = []; for (var wi = 0; wi < 6; wi++) waves.push({ on: false, x: 0, y: 0, t: 0, life: 1, r: 0, c: 0 });
  function wave(x, y, r, life, c) { for (var i = 0; i < waves.length; i++) if (!waves[i].on) { var w = waves[i]; w.on = true; w.x = x; w.y = y; w.t = 0; w.life = life; w.r = r; w.c = c; return; } }
  var flash = 0, shake = 0;
  function update(dt) {
    for (var i = fx.n - 1; i >= 0; i--) {
      fx.t[i] += dt; if (fx.t[i] >= fx.life[i]) { var j = --fx.n; fx.x[i] = fx.x[j]; fx.y[i] = fx.y[j]; fx.vx[i] = fx.vx[j]; fx.vy[i] = fx.vy[j]; fx.t[i] = fx.t[j]; fx.life[i] = fx.life[j]; fx.s[i] = fx.s[j]; fx.c[i] = fx.c[j]; continue; }
      fx.x[i] += fx.vx[i] * dt; fx.y[i] += fx.vy[i] * dt; fx.vx[i] *= 0.94; fx.vy[i] *= 0.94;
    }
    for (i = 0; i < pops.length; i++) if (pops[i].on) { pops[i].t -= dt; pops[i].y -= 26 * dt; if (pops[i].t <= 0) pops[i].on = false; }
    for (i = 0; i < waves.length; i++) if (waves[i].on) { waves[i].t += dt; if (waves[i].t >= waves[i].life) waves[i].on = false; }
    if (flash > 0) flash -= dt; if (shake > 0) shake -= dt;
  }
  function clearFx() { fx.n = 0; for (var i = 0; i < pops.length; i++) pops[i].on = false; for (i = 0; i < waves.length; i++) waves[i].on = false; flash = 0; shake = 0; }

  // ---------- искра-челнок ----------
  // веретено из бронзы с окошком, где горит искра; веер — три коротких лопасти по бокам, клинок — стреловидные стальные кили
  function shuttle(ctx, P, h, t) {
    var fan = h.form === 'fan', blink = h.inv > 0 && Math.floor(t * 16) % 2 === 0;
    ctx.save(); ctx.translate(h.x, h.y);
    if (blink) ctx.globalAlpha = 0.45;
    // выхлоп-шлейф
    for (var i = 0; i < 5; i++) { var q = (t * 3 + i * 0.2) % 1; ctx.fillStyle = P.retro ? (i % 2 ? '#55ffff' : '#ffffff') : 'rgba(120,' + (220 - i * 12) + ',255,' + (0.55 * (1 - q)).toFixed(2) + ')'; ctx.fillRect(-1.5 + Math.sin(t * 9 + i) * 1.5, 12 + q * 14, 3, 3); }
    // боковые лопасти / кили
    for (var sd = -1; sd <= 1; sd += 2) {
      ctx.save(); ctx.scale(sd, 1);
      if (fan) {
        var sp = t * 10;
        for (var f = 0; f < 3; f++) { ctx.fillStyle = f === 1 ? P.steel : P.steelD; ctx.fillRect(6, -4 + f * 4, 7 + Math.abs(Math.sin(sp + f)) * 3, 2.4); }
      } else {
        ctx.fillStyle = P.steel; ctx.beginPath(); ctx.moveTo(4, -2); ctx.lineTo(14, 9); ctx.lineTo(12, 11); ctx.lineTo(4, 7); ctx.closePath(); ctx.fill();
        ctx.fillStyle = P.teal; ctx.fillRect(11, 8, 3, 3);
      }
      ctx.restore();
    }
    if (!P.retro) { var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 16); g.addColorStop(0, 'rgba(120,230,255,.35)'); g.addColorStop(1, 'rgba(60,160,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 16, 0, TAU); ctx.fill(); }
    // корпус-веретено
    ctx.fillStyle = P.bronzeD; ctx.beginPath(); ctx.moveTo(0, -15); ctx.quadraticCurveTo(8, -4, 6.5, 6); ctx.quadraticCurveTo(4, 12, 0, 14); ctx.quadraticCurveTo(-4, 12, -6.5, 6); ctx.quadraticCurveTo(-8, -4, 0, -15); ctx.fill();
    ctx.fillStyle = P.bronzeL; ctx.beginPath(); ctx.moveTo(0, -13); ctx.quadraticCurveTo(5.5, -4, 4.5, 5); ctx.quadraticCurveTo(2.5, 10, 0, 11); ctx.quadraticCurveTo(-1, 0, 0, -13); ctx.fill();
    // окошко с искрой
    ctx.fillStyle = P.retro ? '#000000' : '#1a1020'; rr(ctx, -2.6, -6, 5.2, 10, 2.5); ctx.fill();
    ctx.fillStyle = P.retro ? '#55ffff' : '#9ff4ff'; ctx.beginPath(); ctx.arc(0, -1, 1.9 + Math.sin(t * 20) * 0.4, 0, TAU); ctx.fill();
    // заклёпки на корпусе
    ctx.fillStyle = P.steel; ctx.fillRect(-0.8, 7, 1.6, 1.6); ctx.fillRect(-0.8, -11, 1.6, 1.6);
    ctx.restore();
  }
  function focusMark(ctx, P, h, t) {
    ctx.save(); ctx.translate(h.x, h.y);
    ctx.strokeStyle = P.retro ? '#55ffff' : 'rgba(95,224,208,.75)'; ctx.lineWidth = P.retro ? 2 : 1.4;
    ctx.rotate(t * 1.8); ctx.beginPath();
    for (var i = 0; i < 12; i++) { var a = i * TAU / 12; ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15); ctx.lineTo(Math.cos(a) * 19, Math.sin(a) * 19); }
    ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 15, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function hitDot(ctx, P, h) {
    ctx.fillStyle = P.retro ? '#ff5555' : '#ff3b55'; ctx.beginPath(); ctx.arc(h.x, h.y, K.HB + 1.6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(h.x, h.y, K.HB, 0, TAU); ctx.fill();
  }

  // ---------- механические Звонари-колокола ----------
  function gear(ctx, r, teeth, rot, col) {
    ctx.save(); ctx.rotate(rot); ctx.fillStyle = col; ctx.beginPath();
    for (var i = 0; i < teeth * 2; i++) { var a = i * Math.PI / teeth, rad = i % 2 ? r * 0.82 : r; ctx.lineTo(Math.cos(a - 0.12) * rad, Math.sin(a - 0.12) * rad); ctx.lineTo(Math.cos(a + 0.12) * rad, Math.sin(a + 0.12) * rad); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function glow(ctx, P, r, col) { if (P.retro) return; var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); }
  function bellPath(ctx, w, h) {
    var y0 = -h * 0.5, y1 = h * 0.42;
    ctx.beginPath(); ctx.moveTo(-w * 0.24, y0);
    ctx.bezierCurveTo(-w * 0.3, y0 + h * 0.38, -w * 0.32, y1 - h * 0.22, -w * 0.5, y1);
    ctx.lineTo(w * 0.5, y1);
    ctx.bezierCurveTo(w * 0.32, y1 - h * 0.22, w * 0.3, y0 + h * 0.38, w * 0.24, y0);
    ctx.quadraticCurveTo(0, y0 - h * 0.14, -w * 0.24, y0); ctx.closePath();
  }
  // колокол: тело, губа, язык-маятник, смотровая щель; hit — вспышка попадания
  function bell(ctx, P, w, h, t, hit, body, dark) {
    // попадание — лёгкий отсвет (боссу попадают почти непрерывно, белая заливка «съела» бы облик)
    var br = hit > 0 ? P.bronzeL : body || P.bronze, brd = hit > 0 ? P.bronze : dark || P.bronzeD;
    var sw = Math.sin(t * 3.2) * w * 0.12;
    ctx.fillStyle = P.steelD; ctx.fillRect(-1.2 + sw * 0.5, h * 0.3, 2.4, h * 0.26);
    ctx.fillStyle = P.molten; ctx.beginPath(); ctx.arc(sw, h * 0.58, w * 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = brd; bellPath(ctx, w + 3, h + 3); ctx.fill();
    ctx.fillStyle = br; bellPath(ctx, w, h); ctx.fill();
    if (!P.retro) { ctx.fillStyle = 'rgba(255,240,210,.28)'; ctx.beginPath(); ctx.ellipse(-w * 0.12, -h * 0.12, w * 0.07, h * 0.28, 0.12, 0, TAU); ctx.fill(); }
    ctx.fillStyle = brd; ctx.fillRect(-w * 0.54, h * 0.38, w * 1.08, Math.max(2, h * 0.09));
    ctx.fillStyle = P.bronzeL; ctx.fillRect(-w * 0.3, h * 0.04, w * 0.6, Math.max(1, h * 0.04));
    ctx.fillStyle = P.retro ? '#000000' : '#1a1020'; ctx.fillRect(-w * 0.2, -h * 0.2, w * 0.4, Math.max(2, h * 0.09));
    ctx.fillStyle = P.retro ? '#ff5555' : '#ff4a3a'; ctx.fillRect(-w * 0.2 + ((Math.sin(t * 1.7) + 1) / 2) * w * 0.3, -h * 0.2, w * 0.1, Math.max(2, h * 0.09));
  }
  // рука-молот: плечо от бока колокола, молоток бьёт по губе в такт
  function arm(ctx, P, sd, w, h, t, ph) {
    var hitA = Math.max(0, Math.sin(t * 4 + ph)) * 0.7;
    ctx.save(); ctx.scale(sd, 1); ctx.translate(w * 0.3, -h * 0.05); ctx.rotate(-0.4 + hitA);
    ctx.fillStyle = P.steelD; ctx.fillRect(0, -1.6, w * 0.45, 3.2);
    gear(ctx, 3.5, 6, t * 2, P.steel);
    ctx.translate(w * 0.45, 0); ctx.fillStyle = P.steel; ctx.fillRect(-1.5, -1.5, 3, h * 0.35);
    ctx.fillStyle = P.bronzeD; ctx.fillRect(-w * 0.1, h * 0.3, w * 0.2, h * 0.14);
    ctx.restore();
  }
  function ringer(ctx, P, look, x, y, s, t, hit) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    var W = 40, H = 40, body = P.bronze, dark = P.bronzeD, arms = 2;
    if (look === 'gale') { body = P.steel; dark = P.steelD; }
    else if (look === 'boil') { body = P.retro ? '#555555' : '#5c4a44'; dark = P.retro ? '#000055' : '#2a1d1c'; }
    else if (look === 'great') { body = P.retro ? '#ffaa55' : '#d9a441'; arms = 4; W = 44; H = 44; }
    else if (look === 'bell') { arms = 0; W = 30; H = 30; }
    glow(ctx, P, 36, look === 'boil' ? 'rgba(255,90,40,.45)' : 'rgba(255,170,80,.3)');
    // корона-шестерня и ушко подвеса
    ctx.save(); ctx.translate(0, -H * 0.56); gear(ctx, look === 'great' ? 10 : 7, look === 'great' ? 12 : 8, t * 0.9, P.retro ? '#ffff55' : '#e8b54a'); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); ctx.restore();
    if (arms) { arm(ctx, P, -1, W, H, t, 0); arm(ctx, P, 1, W, H, t, Math.PI); }
    if (arms > 2) { ctx.save(); ctx.translate(0, H * 0.18); arm(ctx, P, -1, W * 0.8, H * 0.8, t * 1.3, 1.5); arm(ctx, P, 1, W * 0.8, H * 0.8, t * 1.3, 4.6); ctx.restore(); }
    if (look === 'gale') { // боковые меха-воздуходувы
      for (var sd = -1; sd <= 1; sd += 2) { ctx.fillStyle = P.bronzeD; for (var i = 0; i < 4; i++) ctx.fillRect(sd * (W * 0.32 + i * 3) - 1.5, -6 + i * 0.5, 3, 12 - i); }
    }
    if (look === 'twin') { // два малых колокола на цепях (точки вылета узоров ±46)
      for (var sd2 = -1; sd2 <= 1; sd2 += 2) {
        ctx.strokeStyle = P.steelD; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sd2 * 10, -H * 0.4); ctx.lineTo(sd2 * 46 / s, 6 / s - 8); ctx.stroke();
        ctx.save(); ctx.translate(sd2 * 46 / s, 6 / s); bell(ctx, P, 16, 16, t * 1.3 + sd2, hit, P.bronzeL, P.bronzeD); ctx.restore();
      }
    }
    bell(ctx, P, W, H, t, hit, body, dark);
    if (look === 'boil') { ctx.fillStyle = P.molten; for (var b = 0; b < 4; b++) { var q = (t * 0.8 + b * 0.25) % 1; ctx.beginPath(); ctx.arc(-12 + b * 8, H * 0.42 - q * 8, 1.5 + (1 - q) * 1.5, 0, TAU); ctx.fill(); } }
    ctx.restore();
  }
  function enemy(ctx, P, e, t) {
    var hit = e.flash > 0;
    switch (e.type) {
      case 'mote':
        ctx.save(); ctx.translate(e.x, e.y); gear(ctx, 9, 7, t * 3 + e.x, hit ? '#ffffff' : P.bronzeD);
        glow(ctx, P, 12, 'rgba(255,140,60,.5)'); ctx.fillStyle = hit ? '#ffffff' : P.molten; ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(5, 0, 0, -6); ctx.quadraticCurveTo(-5, 0, 0, 6); ctx.fill(); ctx.restore(); break;
      case 'chime':
        ctx.save(); ctx.translate(e.x, e.y); glow(ctx, P, 16, 'rgba(70,200,255,.5)');
        ctx.strokeStyle = hit ? '#ffffff' : P.steel; ctx.lineWidth = 2; ctx.beginPath(); for (var i = 0; i < 6; i++) { var a = i * TAU / 6 + Math.PI / 6; ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10); } ctx.closePath(); ctx.stroke();
        ctx.fillStyle = P.retro ? '#55ffff' : '#8fe6ff'; ctx.beginPath(); ctx.arc(0, 0, 4.5 + Math.sin(t * 8 + e.x) * 1, 0, TAU); ctx.fill();
        ctx.save(); ctx.translate(0, -14); bell(ctx, P, 9, 8, t * 2 + e.x, hit ? 1 : 0); ctx.restore(); ctx.restore(); break;
      case 'bell': ringer(ctx, P, 'bell', e.x, e.y, 0.78, t + e.x, hit ? 1 : 0); break;
      case 'rotor':
        ctx.save(); ctx.translate(e.x, e.y); glow(ctx, P, 22, 'rgba(185,140,255,.45)');
        ctx.rotate(t * 5); ctx.fillStyle = hit ? '#ffffff' : P.steel; for (var b = 0; b < 3; b++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.ellipse(10, 0, 10, 3.5, 0, 0, TAU); ctx.fill(); }
        ctx.rotate(-t * 5); gear(ctx, 8, 8, -t * 2, P.bronzeD); ctx.fillStyle = P.retro ? '#ff55ff' : '#c9a2ff'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill(); ctx.restore(); break;
      case 'gong': // гонг в раме на двух винтах
        ctx.save(); ctx.translate(e.x, e.y); glow(ctx, P, 28, 'rgba(255,180,80,.35)');
        ctx.fillStyle = P.steelD; ctx.fillRect(-20, -18, 3, 34); ctx.fillRect(17, -18, 3, 34); ctx.fillRect(-20, -18, 40, 3);
        for (var pr = -1; pr <= 1; pr += 2) { ctx.save(); ctx.translate(pr * 18, -20); ctx.scale(1, 0.3); ctx.rotate(t * 12); ctx.fillStyle = P.steel; ctx.fillRect(-9, -1.5, 18, 3); ctx.restore(); }
        ctx.fillStyle = hit ? '#ffffff' : P.bronzeD; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill();
        ctx.fillStyle = hit ? '#ffffff' : P.bronze; ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = P.bronzeL; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, 7 + Math.sin(t * 6 + e.x) * 1.5, 0, TAU); ctx.stroke();
        ctx.fillStyle = P.molten; ctx.beginPath(); ctx.arc(0, 0, 3, 0, TAU); ctx.fill(); ctx.restore(); break;
    }
  }
  function bossDraw(ctx, P, b, t) {
    var look = b.def.look, big = b.mid ? 1.05 : 1.45;
    // кольцо перезвона: зубчатый обод вокруг
    if (b.ci >= 0 && b.gap <= 0 && b.enter <= 0 && !b.dead) {
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(t * 0.6);
      ctx.strokeStyle = P.retro ? '#aa00aa' : 'rgba(255,170,90,.35)'; ctx.lineWidth = 2;
      var R = 54 + Math.sin(t * 2) * 3; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
      ctx.beginPath(); for (var i = 0; i < 24; i++) { var a = i * TAU / 24; ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a) * (R + 6), Math.sin(a) * (R + 6)); } ctx.stroke();
      ctx.rotate(-t * 1.4); ctx.strokeStyle = P.retro ? '#5555ff' : 'rgba(95,224,208,.3)'; ctx.beginPath(); for (i = 0; i < 6; i++) { var a2 = i * TAU / 6; ctx.lineTo(Math.cos(a2) * (R - 10), Math.sin(a2) * (R - 10)); } ctx.closePath(); ctx.stroke();
      ctx.restore();
    }
    if (look === 'chime') { ctx.save(); var e = { type: 'chime', x: 0, y: 0, flash: b.flash }; ctx.translate(b.x, b.y); ctx.scale(2.2, 2.2); enemy(ctx, P, e, t); ctx.restore(); }
    else if (look === 'rotor') { ctx.save(); var e2 = { type: 'rotor', x: 0, y: 0, flash: b.flash }; ctx.translate(b.x, b.y); ctx.scale(1.9, 1.9); enemy(ctx, P, e2, t); ctx.restore(); }
    else ringer(ctx, P, look, b.x, b.y, look === 'bell' ? 1.5 : big, t, b.flash);
  }

  // ---------- фон ----------
  function sky(ctx, P, S, t) {
    var st = (LV.STAGES[S.stage - 1] || LV.STAGES[0]).sky, C = P.sky[st];
    if (P.retro) { ctx.fillStyle = C[1]; ctx.fillRect(0, 0, FW, FH); ctx.fillStyle = C[2]; for (var y = FH * 0.55; y < FH; y += 4) ctx.fillRect(0, y, FW, (y - FH * 0.55) / 50 + 1); }
    else {
      var g = ctx.createLinearGradient(0, 0, 0, FH); g.addColorStop(0, C[0]); g.addColorStop(0.6, C[1]); g.addColorStop(1, C[2]); ctx.fillStyle = g; ctx.fillRect(0, 0, FW, FH);
      // далёкое зарево горна снизу
      var g2 = ctx.createRadialGradient(FW / 2, FH + 80, 10, FW / 2, FH + 80, 380); g2.addColorStop(0, C[3] + '55'); g2.addColorStop(1, C[3] + '00'); ctx.fillStyle = g2; ctx.fillRect(0, 0, FW, FH);
    }
    // облака — подъём сквозь грозу (слои едут вниз с разной скоростью)
    for (var l = 0; l < 2; l++) {
      var cv = clouds(P, st, l), sp = l ? 70 : 28, off = (t * sp) % FH;
      ctx.drawImage(cv, 0, off - FH, FW, FH); ctx.drawImage(cv, 0, off, FW, FH);
    }
    // зарницы
    var k = Math.floor(t * 0.6), fr = t * 0.6 - k, hs = hash(k * 7 + st);
    if (hs < 0.35 && fr < 0.09) {
      var a = (0.09 - fr) / 0.09;
      ctx.fillStyle = P.retro ? '#ffffff' : 'rgba(200,220,255,' + (0.18 * a).toFixed(3) + ')'; if (!P.retro || fr < 0.03) { if (P.retro) ctx.globalAlpha = 0.25; ctx.fillRect(0, 0, FW, FH); ctx.globalAlpha = 1; }
      ctx.strokeStyle = P.retro ? '#ffffff' : 'rgba(220,235,255,' + (0.7 * a).toFixed(3) + ')'; ctx.lineWidth = P.retro ? 2 : 1.6;
      ctx.beginPath(); var bx = 40 + hash(k * 13) * (FW - 80), by = 0; ctx.moveTo(bx, by);
      for (var s = 1; s < 9; s++) { bx += (hash(k * 31 + s) - 0.5) * 44; by += 26 + hash(k * 17 + s) * 20; ctx.lineTo(bx, by); }
      ctx.stroke();
    }
    // косой дождь (фон)
    ctx.strokeStyle = P.retro ? C[5] : 'rgba(170,190,230,.16)'; ctx.lineWidth = 1; ctx.beginPath();
    for (var i = 0; i < 46; i++) { var rx = (hash(i * 5 + 1) * (FW + 60) + t * 60) % (FW + 60) - 30, ry = (hash(i * 5 + 2) * FH + t * (420 + hash(i) * 200)) % (FH + 30) - 30; ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 16); }
    ctx.stroke();
  }

  // ---------- пули ----------
  function bullets(ctx, P, Bl, ox, oy, lowres) {
    var n = Bl.n, i, s, k;
    if (lowres) {
      for (i = 0; i < n; i++) {
        k = Bl.k[i];
        s = k === 3 ? spriteR(3, Bl.c[i], ((Math.round(Bl.a[i] / (Math.PI / 4)) % 8) + 8) % 8) : spriteR(k, Bl.c[i], 0);
        ctx.drawImage(s, Math.round(Bl.x[i] * 0.5 - s.hw), Math.round(Bl.y[i] * 0.5 - s.hh));
      }
      return;
    }
    // большие снизу, мелкие сверху (порядок пула не меняем — два прохода)
    for (var pass = 0; pass < 2; pass++) for (i = 0; i < n; i++) {
      k = Bl.k[i]; if ((k === 2) !== (pass === 0)) continue;
      s = spriteM(k, Bl.c[i]);
      if (k === 1 || k === 3) { var a = Bl.a[i], c = Math.cos(a), sn = Math.sin(a); ctx.setTransform(c, sn, -sn, c, Bl.x[i] + ox, Bl.y[i] + oy); ctx.drawImage(s, -s.hw, -s.hh); }
      else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(s, Bl.x[i] + ox - s.hw, Bl.y[i] + oy - s.hh); }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  function items(ctx, P, IT, t) {
    for (var i = 0; i < IT.n; i++) {
      var x = IT.x[i], y = IT.y[i], k = IT.k[i];
      if (k === 0) { // искра — ромбик, растит множитель
        ctx.fillStyle = P.retro ? '#ffff55' : '#ffe27a'; ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4 + t * 3); ctx.fillRect(-3.5, -3.5, 7, 7); ctx.fillStyle = '#ffffff'; ctx.fillRect(-1.5, -1.5, 3, 3); ctx.restore();
      }
      else { ctx.fillStyle = P.retro ? '#ffff55' : 'rgba(255,230,160,.9)'; ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
    }
  }
  function fxDraw(ctx, P) {
    var cols = P.retro ? FXCOLR : FXCOL;
    for (var i = 0; i < fx.n; i++) { var a = 1 - fx.t[i] / fx.life[i], s = fx.s[i]; ctx.globalAlpha = P.retro ? 1 : a; ctx.fillStyle = cols[fx.c[i]]; ctx.fillRect(fx.x[i] - s / 2, fx.y[i] - s / 2, s, s); }
    ctx.globalAlpha = 1;
    for (i = 0; i < waves.length; i++) {
      var w = waves[i]; if (!w.on) continue; var u = w.t / w.life;
      ctx.strokeStyle = cols[w.c]; ctx.globalAlpha = P.retro ? 1 : 1 - u; ctx.lineWidth = P.retro ? 3 : 4 * (1 - u) + 1;
      ctx.beginPath(); ctx.arc(w.x, w.y, w.r * (0.15 + u), 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- кадр поля ----------
  var low = null, lowCtx = null;
  function field(ctx, g, S, opts) {
    var P = g.themeName === 'retro' ? PR : PM, t = opts.t != null ? opts.t : g.time, sx = 0, sy = 0, ox = opts.ox || 0;
    if (shake > 0 && !P.retro) { sx = (Math.random() - 0.5) * 8 * Math.min(1, shake * 3); sy = (Math.random() - 0.5) * 8 * Math.min(1, shake * 3); }
    var c = ctx;
    if (P.retro) {
      if (!low) { low = mk(FW / 2, FH / 2); lowCtx = low.getContext('2d'); }
      c = lowCtx; c.imageSmoothingEnabled = false; c.setTransform(0.5, 0, 0, 0.5, 0, 0);
    } else { ctx.save(); ctx.translate(ox, 0); ctx.beginPath(); ctx.rect(0, 0, FW, FH); ctx.clip(); ctx.translate(sx, sy); }
    sky(c, P, S, t);
    var h = S.P, i;
    items(c, P, S.IT, t);
    for (i = 0; i < S.E.length; i++) if (S.E[i].on) enemy(c, P, S.E[i], t);
    if (S.boss.on) bossDraw(c, P, S.boss, t);
    // выстрелы челнока
    c.fillStyle = P.retro ? '#55ffff' : 'rgba(150,255,235,.85)';
    for (i = 0; i < S.PS.n; i++) { if (S.PS.k[i]) c.fillRect(S.PS.x[i] - 2, S.PS.y[i] - 9, 4, 14); else c.fillRect(S.PS.x[i] - 1.5, S.PS.y[i] - 7, 3, 11); }
    if (h.dead <= 0 && S.phase !== 'over' && S.phase !== 'cont' && !opts.noHero) { shuttle(c, P, h, t); if (h.focus) focusMark(c, P, h, t); }
    fxDraw(c, P);
    if (P.retro) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      bullets(c, P, S.B, 0, 0, true);
      if (h.dead <= 0 && h.focus && !opts.noHero) { c.fillStyle = '#ffffff'; c.fillRect(Math.round(h.x / 2) - 1, Math.round(h.y / 2) - 1, 2, 2); }
      ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(low, ox, 0, FW, FH);
      ctx.fillStyle = 'rgba(0,0,0,.22)'; for (var y = 0; y < FH; y += 2) ctx.fillRect(ox, y, FW, 1);
      ctx.restore();
    } else {
      bullets(ctx, P, S.B, sx + ox, sy, false);
      ctx.translate(ox + sx, sy);
      if (h.dead <= 0 && h.focus && !opts.noHero) hitDot(ctx, P, h);
      if (S.P.bombT > K.BOMB_T - 0.5) { ctx.fillStyle = 'rgba(255,240,210,' + ((S.P.bombT - (K.BOMB_T - 0.5)) * 1.2).toFixed(2) + ')'; ctx.fillRect(0, 0, FW, FH); }
      ctx.restore();
    }
    if (flash > 0) { ctx.fillStyle = P.retro ? '#ffffff' : 'rgba(255,255,255,' + Math.min(0.7, flash * 2).toFixed(2) + ')'; if (!P.retro || flash > 0.15) ctx.fillRect(ox, 0, FW, FH); }
    return P;
  }

  // ---------- надписи поля ----------
  function txt(g, s, x, y, o, P) { o = o || {}; if (P.retro && o.upper !== false) s = String(s).toUpperCase(); g.text(s, x, y, o); }
  function overlayField(g, ctx, S, P, opts) {
    var b = S.boss, L = g.i18n.lang, i;
    for (i = 0; i < pops.length; i++) { var p = pops[i]; if (!p.on) continue; ctx.globalAlpha = Math.min(1, p.t * 3); txt(g, p.text, p.x, p.y, { size: p.big ? (P.retro ? 12 : 15) : (P.retro ? 9 : 11), align: 'center', color: [P.ink, P.accent, P.good, P.bad, P.warn, P.teal][p.c] || P.ink, weight: 900 }, P); }
    ctx.globalAlpha = 1;
    if (b.on && !b.dead && b.enter <= 0 && b.ci >= 0) {
      var card = b.def.cards[b.ci], frac = Math.max(0, b.hp / b.mhp);
      ctx.fillStyle = P.retro ? '#000000' : 'rgba(0,0,0,.45)'; ctx.fillRect(6, 6, FW - 12, 6);
      ctx.fillStyle = b.mid ? P.teal : P.accent; ctx.fillRect(6, 6, (FW - 12) * (b.gap > 0 ? 1 : frac), 6);
      // оставшиеся перезвоны — ромбики
      for (i = 0; i < b.def.cards.length - b.ci - 1; i++) { ctx.fillStyle = P.warn; ctx.save(); ctx.translate(12 + i * 12, 22); ctx.rotate(Math.PI / 4); ctx.fillRect(-3, -3, 6, 6); ctx.restore(); }
      txt(g, b.def.n[L], 12 + Math.max(0, b.def.cards.length - b.ci - 1) * 12, 26, { size: P.retro ? 9 : 11, color: P.muted, weight: 700 }, P);
      var left = Math.max(0, card.time - b.t);
      txt(g, left.toFixed(left < 10 ? 1 : 0), FW - 10, 28, { size: P.retro ? 12 : 15, align: 'right', color: left < 6 ? P.bad : P.ink, weight: 900 }, P);
    }
    if (opts.banner) {
      var bn = opts.banner, a = Math.min(1, bn.a / 0.3), by = bn.y || 250;
      ctx.globalAlpha = a; ctx.fillStyle = P.retro ? '#000000' : 'rgba(10,10,20,.7)'; ctx.fillRect(20, by - 30, FW - 40, bn.sub ? 58 : 42);
      if (P.retro) { ctx.fillStyle = '#5555ff'; ctx.fillRect(20, by - 30, FW - 40, 2); ctx.fillRect(20, by + (bn.sub ? 26 : 10), FW - 40, 2); }
      txt(g, bn.title, FW / 2, by - 2, { size: P.retro ? 14 : 20, align: 'center', color: bn.col || P.accent, weight: 900 }, P);
      if (bn.sub) txt(g, bn.sub, FW / 2, by + 18, { size: P.retro ? 9 : 12, align: 'center', color: P.ink, weight: 700 }, P);
      ctx.globalAlpha = 1;
    }
    if (S.phase === 'cont') {
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, 0, FW, FH);
      txt(g, g.t('contQ'), FW / 2, 250, { size: P.retro ? 16 : 24, align: 'center', color: P.accent, weight: 900 }, P);
      txt(g, String(Math.ceil(S.contT)), FW / 2, 320, { size: P.retro ? 40 : 56, align: 'center', color: P.ink, weight: 900 }, P);
      txt(g, g.t('contHint'), FW / 2, 360, { size: P.retro ? 9 : 12, align: 'center', color: P.muted, weight: 700 }, P);
      txt(g, g.t('contLeft') + ': ' + (K.CONTS - S.conts), FW / 2, 382, { size: P.retro ? 9 : 12, align: 'center', color: P.muted, weight: 700 }, P);
    }
  }

  // ---------- панель ----------
  function panel(g, ctx, S, P, opts) {
    var x0 = SBX, w = g.W - SBX, L = g.i18n.lang, cx = x0 + 18;
    ctx.fillStyle = P.retro ? '#000000' : P.panel; ctx.fillRect(x0, 0, w, g.H);
    if (P.retro) { ctx.fillStyle = '#5555ff'; ctx.fillRect(x0, 0, 3, g.H); } else { var gr = ctx.createLinearGradient(x0, 0, x0 + 12, 0); gr.addColorStop(0, 'rgba(255,122,61,.35)'); gr.addColorStop(1, 'rgba(255,122,61,0)'); ctx.fillStyle = gr; ctx.fillRect(x0, 0, 12, g.H); }
    txt(g, g.t('title'), cx, 40, { size: P.retro ? 22 : 28, color: P.accent, weight: 900 }, P);
    txt(g, g.t('d_' + S.diff) + ' · ' + g.t('f_' + S.P.form), cx, 60, { size: P.retro ? 9 : 11, color: P.muted, weight: 700 }, P);
    var row = function (label, value, y, col, big) {
      txt(g, label, cx, y, { size: P.retro ? 9 : 11, color: P.muted, weight: 700 }, P);
      txt(g, value, g.W - 16, y + (big ? 22 : 0), { size: big ? (P.retro ? 16 : 22) : (P.retro ? 11 : 14), align: 'right', color: col || P.ink, weight: 900 }, P);
    };
    row(g.t('best'), String(Math.max(opts.best || 0, S.score)), 92, P.muted);
    row(g.t('score'), String(S.score), 118, P.ink, true);
    // жизни и разряды значками
    txt(g, g.t('lives'), cx, 176, { size: P.retro ? 9 : 11, color: P.muted, weight: 700 }, P);
    for (var i = 0; i < Math.min(8, S.lives); i++) { var lx = g.W - 22 - i * 18, ly = 172; ctx.fillStyle = P.retro ? '#ff5555' : '#ff5a2a'; ctx.beginPath(); ctx.moveTo(lx, ly - 8); ctx.quadraticCurveTo(lx + 6, ly, lx, ly + 6); ctx.quadraticCurveTo(lx - 6, ly, lx, ly - 8); ctx.fill(); ctx.fillStyle = P.retro ? '#ffff55' : '#ffb347'; ctx.fillRect(lx - 1.5, ly - 1, 3, 4); }
    txt(g, g.t('bombs'), cx, 204, { size: P.retro ? 9 : 11, color: P.muted, weight: 700 }, P);
    for (i = 0; i < S.bombs; i++) { var bx = g.W - 22 - i * 18, by = 200; ctx.fillStyle = P.retro ? '#55ffff' : P.teal; ctx.beginPath(); ctx.moveTo(bx + 2, by - 9); ctx.lineTo(bx - 4, by + 1); ctx.lineTo(bx, by + 1); ctx.lineTo(bx - 2, by + 8); ctx.lineTo(bx + 5, by - 2); ctx.lineTo(bx + 1, by - 2); ctx.closePath(); ctx.fill(); }
    row(g.t('graze'), String(S.graze), 236, P.teal);
    row(g.t('mult'), '×' + S.mult.toFixed(2), 262, S.mult > 1 ? P.warn : P.muted);
    ctx.fillStyle = P.retro ? '#555555' : 'rgba(255,255,255,.08)'; ctx.fillRect(cx, 270, w - 36, 4);
    ctx.fillStyle = P.warn; ctx.fillRect(cx, 270, (w - 36) * Math.min(1, (S.mult - 1) / (K.MULT_MAX - 1)), 4);
    row(g.t('sparks'), String(S.sparks), 296, P.warn);
    var st = LV.STAGES[S.stage - 1];
    txt(g, g.t('stage') + ' ' + S.stage + '/' + LV.STAGES.length, cx, 334, { size: P.retro ? 9 : 11, color: P.muted, weight: 700 }, P);
    if (st) txt(g, st.n[L], cx, 354, { size: P.retro ? 11 : 14, color: P.ink, weight: 800 }, P);
    if (S.conts) txt(g, g.t('conts') + ': ' + S.conts, cx, 376, { size: P.retro ? 9 : 11, color: P.muted, weight: 700 }, P);
    // карта босса — на панели (название, номер, бонус)
    var bs = S.boss;
    if (bs.on && !bs.dead && bs.ci >= 0 && bs.enter <= 0) {
      var cd = bs.def.cards[bs.ci], nm = cd.n[L], q = nm.indexOf(': '), l1 = q > 0 ? nm.slice(0, q + 1) : nm, l2 = q > 0 ? nm.slice(q + 2) : '';
      ctx.fillStyle = P.retro ? '#0000aa' : 'rgba(255,122,61,.08)'; ctx.fillRect(x0 + 10, 392, w - 20, 98);
      ctx.fillStyle = bs.capture ? P.accent : P.muted; ctx.fillRect(x0 + 10, 392, 3, 98);
      txt(g, g.t('card') + ' ' + (bs.ci + 1) + '/' + bs.def.cards.length + ' · ' + bs.def.n[L], cx, 410, { size: P.retro ? 8 : 10, color: P.muted, weight: 700 }, P);
      txt(g, l1, cx, 432, { size: P.retro ? 10 : 13, color: l2 ? P.ink : P.accent, weight: 900 }, P);
      if (l2) txt(g, l2, cx, 451, { size: P.retro ? 10 : 13, color: P.accent, weight: 900 }, P);
      txt(g, g.t('bonus') + ': ' + (bs.capture ? Math.round(cd.bonus * S.D.bonus) : g.t('lost')), cx, 476, { size: P.retro ? 9 : 11, color: bs.capture ? P.warn : P.muted, weight: 700 }, P);
    }
    // подсказка управления
    var hint = opts.touch ? g.t('hintTouch') : g.t('hintKeys'), lines = hint.split('\n');
    for (i = 0; i < lines.length; i++) txt(g, lines[i], cx, g.H - 70 + i * 16, { size: P.retro ? 8 : 10, color: P.muted, weight: 600, upper: false }, P);
    if (opts.fps) txt(g, opts.fps, g.W - 16, g.H - 8, { size: 9, align: 'right', color: P.muted, weight: 600 }, P);
  }

  function draw(ctx, g, S, opts) {
    opts = opts || {};
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, g.W, g.H);
    var P = field(ctx, g, S, opts);
    overlayField(g, ctx, S, P, opts);
    if (!opts.noPanel) panel(g, ctx, S, P, opts);
  }

  LV.render = { draw: draw, field: field, update: update, spawn: spawn, pop: pop, wave: wave, clearFx: clearFx, PM: PM, PR: PR, ringer: ringer, shuttle: shuttle, txt: txt,
    flash: function (v) { flash = Math.max(flash, v); }, shake: function (v) { shake = Math.max(shake, v); }, spriteM: spriteM, spriteR: spriteR, fxCount: function () { return fx.n; } };
})(typeof window !== 'undefined' ? window : globalThis);
