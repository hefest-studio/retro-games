/* ЮЗ · интерфейс: DOM-обвязка (подгонка канвы, подписи страницы, тема), общая геометрия трассы
   (полосы покрытий, реквизит «комнат»), сцена заезда (камера, слой следов, частицы, машинки)
   и элементы поверх — HUD, «башня» позиций, мини-карта, отсчёт, итоги заезда и чемпионата.
   Палитру и рисование спрайтов даёт активный рендерер (YUZ.modern / YUZ.classic), тексты — только через g.t(). YUZ.ui */
(function (global) {
  'use strict';
  var Y = global.YUZ = global.YUZ || {};
  var CW = 640, CH = 440, Z = CW / 512;   // канва и масштаб камеры (видимая область мира — logic.VIEW)
  function $(id) { return document.getElementById(id); }

  // ---------- DOM ----------
  function fit(g) {
    var c = g.canvas, wrap = c.parentElement;
    var pad = document.querySelector('.pad'), padH = pad && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 20 : 0;
    var availH = innerHeight - padH - 70;
    var w = Math.min(g.W * 1.6, (wrap && wrap.clientWidth) || g.W, availH * g.W / g.H);
    w = Math.max(240, Math.floor(w));
    c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function sync(g) {
    var lang = g.i18n.lang, theme = g.themeName;
    if (lang !== lastLang) {
      lastLang = lang; document.documentElement.lang = lang;
      var b = $('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = $('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
    }
    if (theme !== lastTheme) { lastTheme = theme; document.body.setAttribute('data-theme', theme); }
  }

  // ---------- Геометрия трассы ----------
  function at(T, s) {   // точка осевой по длине дуги
    s = ((s % T.len) + T.len) % T.len;
    var f = s / T.ds, i = Math.floor(f) % T.n, k = f - Math.floor(f), a = T.smp[i], b = T.smp[(i + 1) % T.n];
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, nx: a.nx + (b.nx - a.nx) * k, ny: a.ny + (b.ny - a.ny) * k, ang: a.ang };
  }
  function pt(T, s, lat) { var p = at(T, s); return [p.x + p.nx * lat, p.y + p.ny * lat]; }
  // полоса покрытия между дугами a..b и поперечными смещениями l0..l1 (px) → многоугольник
  function band(T, a, b, l0, l1) {
    if (b < a) b += T.len;
    var L = [], R = [];
    for (var s = a; s <= b + 0.01; s += T.ds) { L.push(pt(T, s, l0)); R.push(pt(T, s, l1)); }
    return L.concat(R.reverse());
  }
  function blob(T, P) {
    var len = ((P.b - P.a + T.len) % T.len) / 2, mid = P.a + len, out = [];
    for (var i = 0; i < 28; i++) { var th = i / 28 * Math.PI * 2; out.push(pt(T, mid + Math.cos(th) * len, (P.o + Math.sin(th) * P.w) * T.hw)); }
    return out;
  }
  function patchPoly(T, P) {
    if (P.jump) return band(T, P.a, P.a + 14, -T.hw, T.hw);
    if (P.round) return blob(T, P);
    return band(T, P.a, P.b, (P.o - P.w) * T.hw, (P.o + P.w) * T.hw);
  }
  function poly(ctx, pts) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); }
  function centerPath(ctx, T) { ctx.beginPath(); ctx.moveTo(T.smp[0].x, T.smp[0].y); for (var i = 1; i < T.n; i++) ctx.lineTo(T.smp[i].x, T.smp[i].y); ctx.closePath(); }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  var KINDS = { desk: ['bolt', 'nut', 'pencil', 'ruler', 'eraser', 'clip'], bench: ['nail', 'block', 'screw', 'chips', 'tape', 'nail'],
    kitchen: ['plate', 'cup', 'spoon', 'cookie', 'pepper', 'plate'], garden: ['flower', 'stone', 'leaf', 'mushroom', 'bush', 'flower'] };
  var SIZE = { bolt: 9, nut: 8, pencil: 34, ruler: 46, eraser: 13, clip: 11, nail: 16, block: 18, screw: 11, chips: 14, tape: 15,
    plate: 22, cup: 14, spoon: 22, cookie: 11, pepper: 9, flower: 10, stone: 11, leaf: 12, mushroom: 9, bush: 20 };
  var propCache = {};
  function props(T) {   // реквизит комнаты вне трассы: детерминированно по id трассы
    if (propCache[T.id]) return propCache[T.id];
    var rnd = mulberry32(hash(T.id)), kinds = KINDS[T.room], list = [], tries = Math.round(T.W * T.H / 2600);
    for (var k = 0; k < tries; k++) {
      var kind = kinds[(rnd() * kinds.length) | 0], r = SIZE[kind], x = rnd() * T.W, y = rnd() * T.H;
      var c = Math.floor(x / 8), q = Math.floor(y / 8); if (c < 0 || q < 0 || c >= T.cols || q >= T.rows) continue;
      if (T.depth[q * T.cols + c] < r + 12) continue;
      var ok = true; for (var i = 0; i < list.length; i++) if (Math.hypot(list[i].x - x, list[i].y - y) < list[i].r + r + 6) { ok = false; break; }
      if (ok) list.push({ x: x, y: y, r: r, kind: kind, rot: rnd() * Math.PI * 2, v: rnd() });
      if (list.length > 70) break;
    }
    return (propCache[T.id] = list);
  }

  // ---------- Сцена заезда ----------
  var live = { key: '', cv: null, marks: [], parts: [] };
  function liveLayer(R, T) {   // копия «запечённой» трассы — на неё ложатся следы шин
    var key = R.name + ':' + T.id;
    if (live.key !== key || !live.cv) {
      var base = R.bake(T), c = document.createElement('canvas'); c.width = base.width; c.height = base.height;
      c.getContext('2d').drawImage(base, 0, 0); live.cv = c; live.key = key; live.prev = {}; live.parts = [];
    }
    return live.cv;
  }
  function resetLive() { live.key = ''; }
  function fx(R, S, dt) {
    var T = S.track;
    if (!live.cv || live.key !== R.name + ':' + T.id) return;   // слой ещё не создан (до первого кадра)
    var lx = live.cv.getContext('2d');
    for (var i = 0; i < S.cars.length; i++) {
      var c = S.cars[i], p = live.prev[c.id];
      if (c.out) { live.prev[c.id] = null; continue; }
      var spd = Math.hypot(c.vx, c.vy), mark = c.air <= 0 && ((c.slip > 38 && spd > 50) || (c.inp && c.inp.brake && spd > 90));
      if (p && mark && Math.hypot(c.x - p.x, c.y - p.y) < 20) R.skid(lx, p, c);
      live.prev[c.id] = { x: c.x, y: c.y, a: c.a };
      // частицы: пыль на песке, брызги на воде, искры у стен
      if (c.air <= 0 && spd > 70 && Math.random() < dt * 30) {
        var s = c.surf, col = s === 2 ? R.P.sand[T.room] : s === 4 ? '#bfe6ff' : s === 3 ? '#e8fbff' : null;
        if (col) live.parts.push({ x: c.x - Math.cos(c.a) * 8, y: c.y - Math.sin(c.a) * 8, vx: -c.vx * 0.2 + (Math.random() - 0.5) * 40, vy: -c.vy * 0.2 + (Math.random() - 0.5) * 40, t: 0.45, l: 0.45, col: col, sz: R.P.pixel ? 3 : 2.5 });
      }
    }
    for (i = 0; i < live.parts.length; i++) { var q = live.parts[i]; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; q.t -= dt; }
    live.parts = live.parts.filter(function (q) { return q.t > 0; });
  }
  function burst(x, y, col, n, sp) {
    for (var i = 0; i < n; i++) { var a = Math.random() * 6.28, v = sp * (0.3 + Math.random()); live.parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0.6, l: 0.6, col: col, sz: 3 }); }
  }
  function world(g, ctx, S, R, opt) {
    var T = S.track, cv = liveLayer(R, T), cam = S.cam, vw = S.view.w, vh = S.view.h;
    var x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;
    ctx.save();
    ctx.scale(Z, Z); ctx.translate(-x0, -y0);
    var sx = Math.max(0, Math.floor(x0)), sy = Math.max(0, Math.floor(y0));
    ctx.drawImage(cv, sx, sy, Math.min(cv.width - sx, vw + 2), Math.min(cv.height - sy, vh + 2), sx, sy, Math.min(cv.width - sx, vw + 2), Math.min(cv.height - sy, vh + 2));
    for (var i = 0; i < S.items.length; i++) R.item(ctx, S.items[i], g.time);
    for (i = 0; i < live.parts.length; i++) { var q = live.parts[i]; ctx.globalAlpha = Math.max(0, q.t / q.l); ctx.fillStyle = q.col; ctx.fillRect(q.x - q.sz / 2, q.y - q.sz / 2, q.sz, q.sz); }
    ctx.globalAlpha = 1;
    var order = S.cars.filter(function (c) { return !c.out; }).sort(function (a, b) { return a.z - b.z; });
    for (i = 0; i < order.length; i++) R.car(ctx, order[i], g.time, opt && opt.labels);
    ctx.restore();
  }

  // ---------- Рисование интерфейса ----------
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function txt(g, s, x, y, o, P) { o = o || {}; if (P.font) o.font = P.font; g.text(s, x, y, o); }
  function up(P, s) { return P.pixel ? String(s).toUpperCase() : String(s); }
  function panel(ctx, x, y, w, h, P, edge, alpha) {
    if (P.pixel) {
      ctx.fillStyle = P.panel; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = edge || P.line; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
    } else {
      ctx.save(); ctx.globalAlpha = alpha == null ? 0.92 : alpha; ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 16;
      ctx.fillStyle = P.panel; roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.restore();
      ctx.strokeStyle = edge || P.line; ctx.lineWidth = 1.2; roundRect(ctx, x + 0.6, y + 0.6, w - 1.2, h - 1.2, 10); ctx.stroke();
    }
  }
  function name(g, c) { return c.human ? g.t(c.id) : g.t('bot_' + c.id); }
  function carById(S, id) { for (var i = 0; i < S.cars.length; i++) if (S.cars[i].id === id) return S.cars[i]; return null; }

  // Мини-карта: осевая + точки машинок + рамка камеры
  var mapCache = {};
  function minimap(g, ctx, S, R, x, y, w, h) {
    var T = S.track, P = R.P, k = Math.min((w - 12) / (T.W - 280), (h - 12) / (T.H - 280)), ox = x + w / 2 - T.W / 2 * k, oy = y + h / 2 - T.H / 2 * k;
    panel(ctx, x, y, w, h, P, null, 0.78);
    ctx.save(); ctx.lineJoin = 'round';
    ctx.strokeStyle = P.pixel ? '#5555ff' : 'rgba(255,255,255,.35)'; ctx.lineWidth = P.pixel ? 3 : 4;
    ctx.beginPath(); for (var i = 0; i < T.n; i += 3) { var s = T.smp[i]; if (i) ctx.lineTo(ox + s.x * k, oy + s.y * k); else ctx.moveTo(ox + s.x * k, oy + s.y * k); } ctx.closePath(); ctx.stroke();
    var s0 = T.smp[0]; ctx.fillStyle = P.ink; ctx.fillRect(ox + s0.x * k - 1, oy + s0.y * k - 4, 3, 8);
    ctx.strokeStyle = P.pixel ? '#ffff55' : 'rgba(255,255,255,.55)'; ctx.lineWidth = 1;
    ctx.strokeRect(ox + (S.cam.x - S.view.w / 2) * k, oy + (S.cam.y - S.view.h / 2) * k, S.view.w * k, S.view.h * k);
    for (i = S.cars.length - 1; i >= 0; i--) { var c = S.cars[i]; if (c.out) continue; ctx.fillStyle = c.color; var r = c.human ? 3.5 : 2.6; if (P.pixel) ctx.fillRect(ox + c.x * k - r, oy + c.y * k - r, r * 2, r * 2); else { ctx.beginPath(); ctx.arc(ox + c.x * k, oy + c.y * k, r, 0, 7); ctx.fill(); } }
    ctx.restore();
  }
  // «Башня» позиций слева
  function tower(g, ctx, S, R, x, y) {
    var P = R.P, list = S.cars.slice().sort(function (a, b) { return a.rank - b.rank; }), h = 18;
    panel(ctx, x, y, 128, list.length * h + 8, P, null, 0.78);
    for (var i = 0; i < list.length; i++) {
      var c = list[i], yy = y + 4 + i * h;
      ctx.globalAlpha = c.out ? 0.45 : 1;
      txt(g, String(i + 1), x + 12, yy + 13, { size: 11, align: 'center', color: P.muted, weight: 800 }, P);
      ctx.fillStyle = c.color; if (P.pixel) ctx.fillRect(x + 22, yy + 5, 8, 8); else { roundRect(ctx, x + 22, yy + 4, 10, 10, 3); ctx.fill(); }
      txt(g, up(P, name(g, c)), x + 37, yy + 13, { size: 11, color: c.human ? P.ink : P.muted, weight: c.human ? 800 : 600 }, P);
      var tag = c.finished ? '✓' : c.out ? '×' : (c.lap ? Math.min(c.lap, S.laps) + '/' + S.laps : '');
      txt(g, tag, x + 122, yy + 13, { size: 10, align: 'right', color: c.finished ? P.good : c.out ? P.bad : P.muted, weight: 700 }, P);
    }
    ctx.globalAlpha = 1;
  }
  function chip(g, ctx, S, R, c, x, y, right) {
    var P = R.P, w = 168, h = 40, X = right ? x - w : x;
    panel(ctx, X, y, w, h, P, c.color, 0.85);
    var lap = Math.max(1, Math.min(c.lap, S.laps));
    txt(g, up(P, g.t(c.id)), X + 12, y + 17, { size: 12, color: c.color, weight: 900 }, P);
    txt(g, c.out ? up(P, g.t('out')) : Y.ordinal(g.i18n.lang, c.rank), X + 12, y + 33, { size: 14, color: c.out ? P.bad : P.ink, weight: 900 }, P);
    txt(g, up(P, g.t('lap')) + ' ' + lap + '/' + S.laps, X + w - 12, y + 17, { size: 11, align: 'right', color: P.muted, weight: 700 }, P);
    var bx = X + w - 12;
    if (c.shield > 0) { R.badge(ctx, bx - 8, y + 29, 'shield', c.shield); bx -= 22; }
    if (c.boost > 0) R.badge(ctx, bx - 8, y + 29, 'boost', c.boost);
  }
  function hud(g, ctx, S, R) {
    var P = R.P, hum = S.cars.filter(function (c) { return c.human; });
    if (hum[0]) chip(g, ctx, S, R, hum[0], 8, 8, false);
    if (hum[1]) chip(g, ctx, S, R, hum[1], CW - 8, 8, true);
    var tn = (S.ti + 1) + '/' + S.ntracks + ' · ' + g.t('tr_' + S.track.id);
    if (!hum[1]) { panel(ctx, CW - 8 - 190, 8, 190, 40, P, null, 0.85); txt(g, up(P, g.t('track') + ' ' + tn), CW - 20, 24, { size: 12, align: 'right', color: P.ink, weight: 800 }, P); txt(g, up(P, g.t('room_' + S.track.room)), CW - 20, 39, { size: 10, align: 'right', color: P.muted, weight: 600 }, P); }
    else txt(g, up(P, tn), CW / 2, 22, { size: 11, align: 'center', color: P.ink, weight: 800 }, P);
    tower(g, ctx, S, R, 8, CH - 8 - (S.cars.length * 18 + 8));
    minimap(g, ctx, S, R, CW - 8 - 128, CH - 8 - 96, 128, 96);
    // предупреждение: отстаёшь (вне экрана)
    hum.forEach(function (c) {
      if (c.out || c.offT <= 0 || S.phase !== 'race') return;
      if (Math.floor(g.time * 6) % 2) return;
      ctx.strokeStyle = c.color; ctx.lineWidth = 6; ctx.strokeRect(3, 3, CW - 6, CH - 6);
      txt(g, up(P, g.t(c.id) + ' · ' + g.t('outWarn')), CW / 2, 78, { size: 18, align: 'center', color: P.bad, weight: 900 }, P);
    });
    // отсчёт
    if (S.phase === 'count') {
      var n = Math.ceil(2.4 - S.phaseT), f = 1 - ((2.4 - S.phaseT) % 0.8) / 0.8;
      ctx.save(); ctx.globalAlpha = 1 - f * 0.4;
      txt(g, String(n), CW / 2, CH / 2 - 10, { size: P.pixel ? 64 : 72 + f * 20, align: 'center', color: P.warn, weight: 900 }, P);
      ctx.restore();
      txt(g, up(P, g.t('track') + ' ' + tn), CW / 2, CH / 2 + 34, { size: 16, align: 'center', color: P.ink, weight: 800 }, P);
    } else if (S.phase === 'race' && S.phaseT < 0.9) {
      txt(g, up(P, g.t('go')), CW / 2, CH / 2, { size: 56, align: 'center', color: P.good, weight: 900 }, P);
    }
  }
  // всплывашки (круг, финиш, выбыл, бонус)
  function toasts(g, ctx, list, P) {
    for (var i = 0; i < list.length; i++) {
      var o = list[i], a = Math.min(1, o.t / 0.4);
      ctx.globalAlpha = a;
      txt(g, up(P, o.text), CW / 2, 112 + i * 26 - (1.6 - o.t) * 6, { size: P.pixel ? 16 : 18, align: 'center', color: o.color, weight: 900 }, P);
    }
    ctx.globalAlpha = 1;
  }
  // итоги заезда + таблица чемпионата
  function results(g, ctx, S, R, final) {
    var P = R.P, w = 520, h = 128 + S.cars.length * 34, x = (CW - w) / 2, y = (CH - h) / 2;
    ctx.fillStyle = P.pixel ? 'rgba(0,0,0,.6)' : 'rgba(8,10,16,.55)'; ctx.fillRect(0, 0, CW, CH);
    panel(ctx, x, y, w, h, P, P.accent, 0.96);
    var colW = w / 2;
    if (!final) {
      txt(g, up(P, g.t('results')), x + colW / 2 + 6, y + 30, { size: 15, align: 'center', color: P.accent, weight: 900 }, P);
      txt(g, up(P, g.t('tr_' + S.track.id)), x + colW / 2 + 6, y + 48, { size: 11, align: 'center', color: P.muted, weight: 600 }, P);
      S.results.forEach(function (r, i) {
        var c = carById(S, r.id), yy = y + 82 + i * 34;
        txt(g, Y.ordinal(g.i18n.lang, r.place), x + 26, yy, { size: 15, color: i === 0 ? P.warn : P.ink, weight: 900 }, P);
        ctx.fillStyle = c.color; ctx.fillRect(x + 66, yy - 11, 10, 12);
        txt(g, up(P, name(g, c)) + (r.out ? ' · ' + g.t('dnf') : ''), x + 84, yy, { size: 13, color: c.human ? P.ink : P.muted, weight: c.human ? 800 : 600 }, P);
        txt(g, '+' + r.pts, x + colW - 14, yy, { size: 13, align: 'right', color: P.good, weight: 900 }, P);
      });
      ctx.fillStyle = P.line; ctx.fillRect(x + colW, y + 20, 1, h - 60);
    }
    var cx0 = final ? x + w / 2 - colW / 2 : x + colW;
    txt(g, up(P, g.t('standings')), cx0 + colW / 2, y + 30, { size: 15, align: 'center', color: P.accent, weight: 900 }, P);
    txt(g, up(P, g.t('track')) + ' ' + Math.min(S.ti + 1, S.ntracks) + '/' + S.ntracks, cx0 + colW / 2, y + 48, { size: 11, align: 'center', color: P.muted, weight: 600 }, P);
    S.standings.forEach(function (r, i) {
      var c = carById(S, r.id), yy = y + 82 + i * 34;
      txt(g, String(r.place), cx0 + 22, yy, { size: 15, color: i === 0 ? P.warn : P.ink, weight: 900 }, P);
      ctx.fillStyle = c.color; ctx.fillRect(cx0 + 42, yy - 11, 10, 12);
      txt(g, up(P, name(g, c)), cx0 + 60, yy, { size: 13, color: c.human ? P.ink : P.muted, weight: c.human ? 800 : 600 }, P);
      txt(g, r.pts + ' ' + g.t('pts'), cx0 + colW - 18, yy, { size: 13, align: 'right', color: P.ink, weight: 900 }, P);
    });
    var hint = final ? null : (S.ti + 1 < S.ntracks ? g.t('next') : g.t('final'));
    if (hint && S.phaseT > 0.8 && Math.floor(g.time * 2.5) % 3) txt(g, up(P, hint), CW / 2, y + h - 18, { size: 12, align: 'center', color: P.muted, weight: 700 }, P);
  }

  Y.ui = {
    CW: CW, CH: CH, Z: Z,
    init: function (g) { fit(g); addEventListener('resize', function () { fit(g); }); sync(g); setInterval(function () { sync(g); }, 250); },
    fit: fit, sync: sync, at: at, pt: pt, band: band, patchPoly: patchPoly, poly: poly, centerPath: centerPath, props: props, mulberry32: mulberry32,
    world: world, fx: fx, burst: burst, resetLive: resetLive, roundRect: roundRect, txt: txt, up: up, panel: panel, hud: hud, toasts: toasts, results: results, name: name
  };
})(typeof window !== 'undefined' ? window : globalThis);
