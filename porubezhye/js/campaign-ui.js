/* ПОРУБЕЖЬЕ · js/campaign-ui.js — экраны и интерфейс кампании поверх движка Гефест Arcade (логика миссий — js/campaign.js):
   карта кампании ('camp': вкладки трёх родов, узлы миссий — открыта / пройдена / закрыта / «в работе»), брифинг ('brief': мини-карта
   с отметками, цели пиктограммами, звёзды, герои, 1–3 фразы), итог ('result': звёзды, время, потери, решения, «Дальше»), а в бою —
   цели со счётчиками, таймер миссии, мороз, реплики героев, отметки зон и знамён, снег; места сборки (кольцо с прогрессом), Зимний вал
   (ледяная кромка), экран итога кампании ('finale': по def.finale последней миссии — решения по флагам, звёзды, реплики героев,
   «Продолжение — в кампании …»). Прогресс — localStorage (try/catch).
   Подключается, только если в сборке есть играбельные миссии (полная версия); в демо пункт «Кампания» ведёт на экран издания.
   Встраивание: main.js зовёт UI.install(g, host); host = { startMission(id), centerOn(x, y), note(text, col), VIEW, TOP, PY }. */
(function (global) {
  'use strict';
  var P = global.PORUB, C = P.campaign, R = P.render, T = P.T;
  var UI = P.campUI = {};
  var g = null, host = null, store = null, camp = 'wright', sel = 0, briefId = null, lastRes = null, finId = null, hot = [], hover = -1, resetArm = 0, say = null, flakes = [];
  var W = 1280, H = 720;
  // узлы карты кампании: снизу (острог у южной границы) — к Зимнему валу на севере
  var NODES = [[150, 520], [262, 450], [380, 492], [470, 400], [372, 318], [500, 236], [380, 160]];
  var WHO = { yarina: { col: 'copper', ru: 'Я', en: 'Y', name: 'u_yarina' }, tikhon: { col: 'brass', ru: 'Т', en: 'T', name: 'u_tikhon' },
    thicket: { col: 'moss', ru: 'Ч', en: 'T', name: 'r_thicket' }, envoy: { col: 'lichen', ru: 'П', en: 'E', name: 'u_envoy' }, stomper: { col: 'brass', ru: '⚙', en: '⚙', name: 'u_stomper' }, tale: { col: 'muted', ru: '✶', en: '✶', name: null }, worker: { col: 'cloth', ru: 'П', en: 'A', name: 'u_worker' } };
  var RACE_OF = { wright: 'r_wright', thicket: 'r_thicket', barrow: 'r_barrow' };

  function lang() { return g.i18n.lang; }
  function tx(o) { return C.txt(o, lang()); }
  function pal() { return R.pal(g.themeName); }
  function ret() { return g.themeName === 'retro'; }
  function text(s, x, y, o) { g.text(String(s), x, y, Object.assign({ size: 14, weight: 700 }, o || {})); }
  function wrap(c, s, maxW, size, weight) { c.font = (weight || 600) + ' ' + size + 'px ' + g.th().font; var out = [], line = ''; String(s).split(' ').forEach(function (w) { var t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; }
  function fmt(s) { s = Math.max(0, Math.round(s || 0)); var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
  function persist() { C.save(store, camp, UI.data); }
  function missions(k) { return C.list(k || camp); }
  function playableHere(def) { var E = P.Edition; return C.playable(def) && (!E.playable || E.playable(P.EDITION, def.id)); }
  function state(def) { if (!playableHere(def)) return 'later'; return C.nodeState(def, UI.data); }
  function campTitle(k) { var m = missions(k)[0]; return m && m.campTitle ? tx(m.campTitle) : ''; }

  // ---------- пиктограммы ----------
  function icon(c, kind, x, y, s) {
    var p = pal(), rt = ret(), O = R.prims; c.save(); c.translate(x, y); var k = s / 24; c.scale(k, k);
    var probe = UI._probe || (UI._probe = new P.Game({ seed: 1, noAI: true }));
    if (P.RACES.wright.buildings[kind]) { c.restore(); c.save(); R.icon(c, probe, 0, 'b', kind, x - 2, y - 2, s + 4, g.themeName); c.restore(); return; }
    if (P.RACES.wright.units[kind]) { c.restore(); c.save(); R.icon(c, probe, 0, 'u', kind, x - 2, y - 4, s + 6, g.themeName); c.restore(); return; }
    if (P.RACES.thicket.units[kind]) { var pt = UI._probe2 || (UI._probe2 = new P.Game({ seed: 1, noAI: true, playerRace: 'thicket' })); c.restore(); c.save(); R.icon(c, pt, 0, 'u', kind, x - 2, y - 4, s + 6, g.themeName); c.restore(); return; }
    if (kind === 'amber') { O.tri(c, 12, 2, 4, 20, 20, 20, p.amber, rt); O.tri(c, 12, 2, 10, 20, 15, 20, p.amberHi, rt); }
    else if (kind === 'resin') { O.oval(c, 12, 15, 9, 6, p.resin, rt); O.oval(c, 10, 13, 4, 2, p.resinHi, rt); }
    else if (kind === 'timber') { O.box(c, 2, 12, 18, 5, p.trunk, rt, 2); O.box(c, 4, 6, 18, 5, p.plankHi, rt, 2); O.oval(c, 21, 8, 2, 2, p.wood2, rt); }
    else if (kind === 'shield') { O.box(c, 4, 3, 16, 11, p.copper, rt, 3); O.tri(c, 12, 22, 4, 13, 20, 13, p.copper, rt); O.box(c, 11, 4, 2, 15, p.copperHi, rt); O.box(c, 5, 8, 14, 2, p.copperHi, rt); }
    else if (kind === 'clock') { c.strokeStyle = p.ink; c.lineWidth = 2; c.beginPath(); c.arc(12, 12, 9, 0, 7); c.moveTo(12, 12); c.lineTo(12, 6); c.moveTo(12, 12); c.lineTo(16, 14); c.stroke(); }
    else if (kind === 'nobld') { O.box(c, 4, 10, 16, 11, p.wood2, rt); O.tri(c, 12, 2, 2, 11, 22, 11, p.copper, rt); c.strokeStyle = p.hpGood; c.lineWidth = 3; c.beginPath(); c.moveTo(7, 16); c.lineTo(11, 20); c.lineTo(18, 12); c.stroke(); }
    else if (kind === 'heart') { O.oval(c, 8, 9, 5, 5, p.hpBad, rt); O.oval(c, 16, 9, 5, 5, p.hpBad, rt); O.tri(c, 12, 22, 3, 11, 21, 11, p.hpBad, rt); }
    else if (kind === 'tree') { O.tri(c, 12, 1, 3, 14, 21, 14, p.pine[1], rt); O.tri(c, 12, 6, 2, 20, 22, 20, p.pine[0], rt); O.box(c, 10, 19, 4, 4, p.trunk, rt); }
    else if (kind === 'frost') { c.strokeStyle = p.iceHi; c.lineWidth = 2; for (var a = 0; a < 3; a++) { c.beginPath(); var an = a * Math.PI / 3; c.moveTo(12 - Math.cos(an) * 10, 12 - Math.sin(an) * 10); c.lineTo(12 + Math.cos(an) * 10, 12 + Math.sin(an) * 10); c.stroke(); } }
    else if (kind === 'bridge') { O.box(c, 1, 8, 22, 8, p.plankHi, rt, 2); O.box(c, 3, 16, 3, 6, p.trunk, rt); O.box(c, 18, 16, 3, 6, p.trunk, rt); O.box(c, 0, 20, 24, 3, p.water, rt); }
    else if (kind === 'foe') { O.oval(c, 12, 13, 9, 8, p.moss, rt); O.box(c, 15, 10, 3, 3, p.eye, rt); O.box(c, 15, 15, 3, 2, p.eye, rt); }
    else if (kind === 'home') { O.tri(c, 12, 2, 2, 11, 22, 11, p.copper, rt); O.box(c, 5, 11, 14, 11, p.woodHi, rt); O.box(c, 10, 15, 4, 7, '#2a1a0c', rt); }
    else if (kind === 'flag') { O.box(c, 6, 3, 2, 18, p.iron, rt); O.box(c, 8, 3, 11, 7, p.copper, rt); }
    else if (kind === 'eye') { O.oval(c, 12, 12, 10, 6, p.ink, rt); O.oval(c, 12, 12, 4, 4, p.water, rt); }
    c.restore();
  }
  function star(c, x, y, r, filled) {
    var p = pal(); c.beginPath();
    for (var k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); if (filled) { c.fillStyle = p.amberHi; c.fill(); } c.strokeStyle = filled ? p.copper : p.muted; c.lineWidth = 1.5; c.stroke();
  }
  function portrait(c, who, x, y, r) {
    var p = pal(), w = WHO[who] || WHO.tale, col = p[w.col] || p.muted;
    R.prims.oval(c, x, y, r, r, 'rgba(0,0,0,0.5)', ret()); R.prims.oval(c, x, y, r - 3, r - 3, col, ret());
    text(lang() === 'ru' ? w.ru : w.en, x, y + r * 0.4, { size: Math.round(r * 1.05), weight: 900, align: 'center', color: '#15110c' });
  }
  function button(c, x, y, w, h, label, fn, o) {
    o = o || {}; var p = pal(), i = hot.length, on = hover === i || o.focus;
    hot.push({ x: x, y: y, w: w, h: h, fn: fn });
    R.prims.box(c, x, y, w, h, o.primary ? (on ? p.copperHi : p.copper) : (on ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'), ret(), 7);
    c.strokeStyle = o.primary ? p.copperHi : p.line; c.lineWidth = 1.5; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    text(label, x + w / 2, y + h / 2 + 5, { size: o.size || 15, weight: 800, align: 'center', color: o.primary ? '#1a120a' : p.ink });
  }
  function panel(c, x, y, w, h) { var p = pal(); R.prims.box(c, x, y, w, h, ret() ? '#1a1520' : 'rgba(12,15,20,0.88)', ret(), 12); c.strokeStyle = p.line; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2); }
  function lock(c, x, y) { var p = pal(); c.strokeStyle = p.muted; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y - 4, 5, Math.PI, 0); c.stroke(); R.prims.box(c, x - 7, y - 4, 14, 11, p.muted, ret(), 2); }

  // ---------- карта кампании ----------
  function drawRegion(c, x0, y0, w, h) {
    var p = pal(), rt = ret(), O = R.prims;
    O.box(c, x0, y0, w, h, rt ? '#2e4a28' : '#3b5537', rt, 14);
    c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
    // Зимний вал на севере: ледяная гряда и снег
    O.box(c, x0, y0, w, 110, p.snow[1], rt); for (var i = 0; i < 14; i++) O.tri(c, x0 + 20 + i * 46, y0 + 6 + (i % 3) * 8, x0 + i * 46 - 6, y0 + 96, x0 + 46 + i * 46, y0 + 96, i % 2 ? p.ice : p.iceHi, rt);
    O.box(c, x0, y0 + 96, w, 60, rt ? '#c8d0e0' : 'rgba(220,230,238,0.55)', rt);
    // река Студёная
    c.strokeStyle = p.water; c.lineWidth = 16; c.beginPath(); c.moveTo(x0, y0 + 380); c.bezierCurveTo(x0 + 200, y0 + 330, x0 + 340, y0 + 440, x0 + w, y0 + 360); c.stroke();
    c.strokeStyle = p.waterHi; c.lineWidth = 3; c.stroke();
    // боры
    for (var b = 0; b < 26; b++) { var bx = x0 + 30 + ((b * 97) % (w - 60)), by = y0 + 150 + ((b * 53) % (h - 190)); O.tri(c, bx, by - 16, bx - 10, by + 4, bx + 10, by + 4, p.pine[b % 3], rt); }
    // острог у южной границы
    O.box(c, x0 + 70, y0 + h - 70, 40, 26, p.woodHi, rt, 3); O.tri(c, x0 + 90, y0 + h - 92, x0 + 64, y0 + h - 68, x0 + 116, y0 + h - 68, p.copper, rt);
    c.restore();
  }
  function drawCamp(c) {
    var p = pal(), t = g.time || 0; hot = [];
    text(g.t('chooseCamp').toUpperCase(), 40, 50, { size: 26, weight: 900, color: g.th().accent });
    // вкладки родов
    ['wright', 'thicket', 'barrow'].forEach(function (k, i) {
      var has = missions(k).some(playableHere), x = 330 + i * 300, on = camp === k, ttl = g.t(RACE_OF[k]) + (campTitle(k) ? ' · ' + campTitle(k) : '') + (has ? '' : ' · ' + g.t('comingCamp'));
      R.prims.box(c, x, 22, 290, 38, on ? 'rgba(232,145,58,0.28)' : 'rgba(255,255,255,0.05)', ret(), 8);
      text(ttl, x + 145, 47, { size: 13, align: 'center', weight: 800, color: has ? p.ink : p.muted, maxWidth: 270 });
      hot.push({ x: x, y: 22, w: 290, h: 38, fn: function () { if (has) setCamp(k); else g.audio.beep(180, 0.05, 'square'); } });
    });
    var x0 = 40, y0 = 78, mw = 660, mh = 540; drawRegion(c, x0, y0, mw, mh);
    var ms = missions(), d = UI.data;
    // тропа
    c.strokeStyle = p.woodHi; c.lineWidth = 3; c.setLineDash([8, 7]); c.beginPath(); NODES.slice(0, Math.max(1, ms.length)).forEach(function (q, i) { if (i) c.lineTo(x0 + q[0], y0 + q[1]); else c.moveTo(x0 + q[0], y0 + q[1]); }); c.stroke(); c.setLineDash([]);
    ms.forEach(function (m, i) {
      var q = NODES[i] || NODES[NODES.length - 1], nx = x0 + q[0], ny = y0 + q[1], st = state(m), on = i === sel;
      var col = st === 'done' ? p.hpGood : st === 'open' ? p.copper : 'rgba(120,120,120,0.85)';
      if (on) { c.strokeStyle = p.amberHi; c.lineWidth = 3; c.beginPath(); c.arc(nx, ny, 26 + Math.sin(t * 4) * 2, 0, 7); c.stroke(); }
      R.prims.oval(c, nx, ny, 20, 20, 'rgba(0,0,0,0.55)', ret()); R.prims.oval(c, nx, ny, 17, 17, col, ret());
      if (st === 'later' || st === 'closed') lock(c, nx, ny + 2); else text(String(m.n), nx, ny + 7, { size: 18, weight: 900, align: 'center', color: '#15110c' });
      var rec = d.missions[m.id]; if (rec) for (var s = 0; s < 3; s++) star(c, nx - 16 + s * 16, ny + 30, 6, !!rec.stars[s]);
      hot.push({ x: nx - 24, y: ny - 24, w: 48, h: 48, fn: function () { if (sel === i) openBrief(m); sel = i; }, node: i });
    });
    // карточка выбранной миссии
    var cx = 730, cy = 78, cw = 510, ch = 540; panel(c, cx, cy, cw, ch);
    var m = ms[sel];
    if (m) {
      var st2 = state(m), y = cy + 40;
      text(g.t('missionN') + ' ' + m.n + (m.kind ? ' · ' + tx(m.kind) : ''), cx + 24, y, { size: 13, color: p.muted, weight: 700 }); y += 34;
      wrap(c, tx(m.title), cw - 48, 26, 900).forEach(function (ln) { text(ln, cx + 24, y, { size: 26, weight: 900, color: st2 === 'later' ? p.muted : p.ink }); y += 32; });
      y += 6;
      if (st2 === 'later') { text(g.t('work'), cx + 24, y, { size: 16, color: p.amberHi }); y += 24; wrap(c, g.t('workSub'), cw - 48, 14).forEach(function (ln) { text(ln, cx + 24, y, { size: 14, weight: 600, color: p.muted }); y += 20; }); }
      else {
        wrap(c, tx(m.brief), cw - 48, 15).slice(0, 5).forEach(function (ln) { text(ln, cx + 24, y, { size: 15, weight: 600 }); y += 22; });
        y += 12; text(g.t('objectives'), cx + 24, y, { size: 13, color: p.muted }); y += 8;
        (m.objectives || []).filter(function (o) { return !o.hidden && !o.secret; }).slice(0, 5).forEach(function (o) { y += 26; icon(c, o.icon || 'flag', cx + 24, y - 18, 20); text(tx(o.text), cx + 54, y - 2, { size: 13, weight: 600, maxWidth: cw - 80 }); });
        var rec2 = UI.data.missions[m.id]; y += 30; for (var s2 = 0; s2 < 3; s2++) star(c, cx + 34 + s2 * 30, y, 11, !!(rec2 && rec2.stars[s2]));
        if (rec2) text(g.t('campDone') + ' · ' + fmt(rec2.time), cx + 140, y + 5, { size: 13, color: p.hpGood });
        if (st2 === 'closed') { text(g.t('locked'), cx + 24, cy + ch - 70, { size: 15, color: p.muted }); text(g.t('lockedSub'), cx + 24, cy + ch - 48, { size: 13, color: p.muted, weight: 600 }); }
        else button(c, cx + 24, cy + ch - 70, cw - 48, 46, '▶ ' + g.t('brief'), function () { openBrief(m); }, { primary: true, size: 17 });
      }
    }
    button(c, 40, 640, 220, 40, '← ' + g.t('toMenu'), function () { g.goto('title'); });
    var fin = ms.filter(function (m) { return m.finale && d.missions[m.id]; })[0];
    if (fin) button(c, 270, 640, 200, 40, '✶ ' + g.t('finBtn'), function () { finId = fin.id; g.goto('finale'); }, { size: 13 });
    button(c, 480, 640, 220, 40, resetArm > t ? g.t('resetSure') : g.t('reset'), function () { if (resetArm > (g.time || 0)) { UI.data = C.reset(store, camp); resetArm = 0; sel = 0; } else resetArm = (g.time || 0) + 3; }, { size: 13 });
    text(g.t('playHint'), 970, 668, { size: 12, color: p.muted, align: 'center', weight: 600 });
  }
  function setCamp(k) { if (k === camp) return; camp = k; UI.camp = k; UI.data = C.load(store, k); sel = firstOpen(); }
  function firstOpen() { var ms = missions(), i = 0; ms.forEach(function (m, k) { var s = state(m); if (s === 'open') i = k; else if (s === 'done' && i <= k) i = Math.min(ms.length - 1, k); }); return i; }
  function openBrief(m) { var s = state(m); if (s !== 'open' && s !== 'done') { g.audio.beep(180, 0.06, 'square'); return; } briefId = m.id; g.goto('brief'); }

  // ---------- брифинг ----------
  function miniOf(def) {
    UI._minis = UI._minis || {}; var key = def.id + ':' + g.themeName; if (UI._minis[key]) return UI._minis[key];
    var mp = C.parseMap(def), cv = document.createElement('canvas'); cv.width = mp.w; cv.height = mp.h;
    var cx = cv.getContext('2d'), img = cx.createImageData(mp.w, mp.h), p = pal();
    var hex = function (s) { var n = parseInt(s.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }, cols = [p.grass[0], p.wood, p.water, p.rock, p.heath[0], p.snow[0], p.ice, p.plank].map(hex);
    for (var i = 0; i < mp.w * mp.h; i++) { var q = cols[mp.terr[i]]; img.data[i * 4] = q[0]; img.data[i * 4 + 1] = q[1]; img.data[i * 4 + 2] = q[2]; img.data[i * 4 + 3] = 255; }
    mp.nodes.forEach(function (n) { var q = hex(n.type === 'amber' ? p.amber : n.type === 'timber' ? p.plankHi : p.resinHi); for (var s = 0; s < (n.type === 'resin' ? 2 : 1); s++) for (var r = 0; r < (n.type === 'resin' ? 2 : 1); r++) { var k = (n.ty + s) * mp.w + n.tx + r; img.data[k * 4] = q[0]; img.data[k * 4 + 1] = q[1]; img.data[k * 4 + 2] = q[2]; } });
    cx.putImageData(img, 0, 0); UI._minis[key] = { cv: cv, mp: mp }; return UI._minis[key];
  }
  function drawBrief(c) {
    var def = C.byId(briefId), p = pal(); hot = []; if (!def) { g.goto('camp'); return; }
    panel(c, 30, 30, 1220, 660);
    text(g.t('missionN') + ' ' + def.n + (def.kind ? ' · ' + tx(def.kind) : ''), 60, 72, { size: 14, color: p.muted });
    text(tx(def.title), 60, 110, { size: 32, weight: 900, color: g.th().accent });
    var y = 146; wrap(c, tx(def.brief), 560, 16).slice(0, 4).forEach(function (ln) { text(ln, 60, y, { size: 16, weight: 600 }); y += 24; });
    // мини-карта с отметками
    var mm = miniOf(def), mw = 560, mh = Math.round(mw * mm.mp.h / mm.mp.w), mx = 60, my = 250; if (mh > 400) { mh = 400; mw = Math.round(mh * mm.mp.w / mm.mp.h); }
    c.save(); c.imageSmoothingEnabled = false; c.drawImage(mm.cv, mx, my, mw, mh); c.restore(); c.strokeStyle = p.line; c.lineWidth = 2; c.strokeRect(mx - 1, my - 1, mw + 2, mh + 2);
    var MSp = { points: mm.mp.points, def: def }, kx = mw / mm.mp.w, ky = mh / mm.mp.h;
    (def.briefMarks || []).forEach(function (bm) { var q = C.pointOf(MSp, bm.at); R.prims.oval(c, mx + q.x * kx, my + q.y * ky, 15, 15, 'rgba(0,0,0,0.55)', ret()); icon(c, bm.icon, mx + q.x * kx - 11, my + q.y * ky - 11, 22); });
    // цели
    var x = 680; y = 170; text(g.t('objectives'), x, y, { size: 14, color: p.muted }); y += 6;
    (def.objectives || []).filter(function (o) { return !o.hidden && !o.secret; }).forEach(function (o) { y += 30; icon(c, o.icon || 'flag', x, y - 20, 22); text(tx(o.text) + (o.kind === 'opt' ? ' (' + g.t('optional') + ')' : ''), x + 32, y - 3, { size: 14, weight: 600, maxWidth: 520 }); });
    y += 44; text(g.t('starsT'), x, y, { size: 14, color: p.muted }); y += 4;
    var rec = UI.data.missions[def.id], stars = [{ icon: 'flag', text: g.t('starDone') }].concat(def.stars || []);
    stars.forEach(function (s, i) { y += 28; star(c, x + 10, y - 7, 9, !!(rec && rec.stars[i])); icon(c, s.icon || 'flag', x + 26, y - 19, 20); text(typeof s.text === 'string' ? s.text : tx(s.text), x + 54, y - 2, { size: 13, weight: 600, maxWidth: 500 }); });
    var heroes = def.heroes || [];
    if (heroes.length) { y += 44; text(g.t('heroesT'), x, y, { size: 14, color: p.muted });
      heroes.forEach(function (h, i) { var hx = x + 20 + i * 200, wd = UI.data.roster.heroes[h] && UI.data.roster.heroes[h].wounded; portrait(c, h, hx, y + 30, 18); text(g.t('u_' + h), hx + 26, y + 30, { size: 14 }); if (wd) text(g.t('wounded'), hx + 26, y + 47, { size: 12, color: p.hpBad, weight: 600 }); }); }
    button(c, 680, 620, 300, 50, '▶ ' + g.t('start'), function () { host.startMission(def.id); }, { primary: true, size: 18 });
    button(c, 1000, 620, 220, 50, '← ' + g.t('backBtn'), function () { g.goto('camp'); });
  }

  // ---------- итог ----------
  function drawResult(c) {
    var r = lastRes, p = pal(); hot = []; if (!r) { g.goto('camp'); return; }
    var def = C.byId(r.id); panel(c, 190, 60, 900, 600);
    text(tx(def.title), W / 2, 112, { size: 18, align: 'center', color: p.muted });
    text(g.t(r.win ? 'winT' : 'loseT'), W / 2, 158, { size: 36, weight: 900, align: 'center', color: r.win ? g.th().accent : p.hpBad });
    var labels = [g.t('starDone')].concat((def.stars || []).map(function (s) { return tx(s.text); }));
    if (r.win) labels.forEach(function (lb, i) { var sx = W / 2 + (i - 1) * 250; star(c, sx, 222, 26, !!r.stars[i]); wrap(c, lb, 220, 13, 700).slice(0, 2).forEach(function (ln, k) { text(ln, sx, 270 + k * 17, { size: 13, align: 'center', color: r.stars[i] ? p.ink : p.muted }); }); });
    else { var rs = def.reasons && def.reasons[r.reason] ? tx(def.reasons[r.reason]) : g.t('reason0'); wrap(c, rs, 760, 17).forEach(function (ln, k) { text(ln, W / 2, 222 + k * 24, { size: 17, align: 'center', weight: 600 }); }); }
    var rows = [[g.t('resTime'), fmt(r.time)], [g.t('resLostU'), String(r.lostU)], [g.t('resLostB'), String(r.lostB)], [g.t('resKills'), String(r.kills)]];
    if (r.wood) rows.push([g.t('wood'), String(r.wood)]);
    var y = 340; rows.forEach(function (rw) { text(rw[0], W / 2 - 14, y, { size: 15, align: 'right', color: p.muted, weight: 600 }); text(rw[1], W / 2 + 14, y, { size: 16 }); y += 26; });
    if (r.win && def.flagText) Object.keys(def.flagText).forEach(function (k) { var v = r.flags[k]; if (v != null && def.flagText[k][v]) { y += 8; wrap(c, '◆ ' + tx(def.flagText[k][v]), 760, 14).forEach(function (ln) { text(ln, W / 2, y, { size: 14, align: 'center', color: p.amberHi, weight: 600 }); y += 20; }); } });
    var next = r.win && missions(C.campOf(def)).filter(function (m) { return m.n === def.n + 1 && playableHere(m); })[0];
    if (r.win && def.finale) { button(c, W / 2 - 330, 586, 240, 48, g.t('finBtn') + ' ▸', function () { finId = def.id; g.goto('finale'); }, { primary: true, size: 17 }); button(c, W / 2 - 80, 586, 190, 48, g.t('toMap'), function () { g.goto('camp'); }); button(c, W / 2 + 120, 586, 190, 48, g.t('retry'), function () { host.startMission(r.id); }); }
    else if (r.win && next) { button(c, W / 2 - 330, 586, 240, 48, g.t('next') + ' ▸', function () { briefId = next.id; g.goto('brief'); }, { primary: true, size: 17 }); button(c, W / 2 - 80, 586, 190, 48, g.t('toMap'), function () { g.goto('camp'); }); button(c, W / 2 + 120, 586, 190, 48, g.t('retry'), function () { host.startMission(r.id); }); }
    else if (r.win) { button(c, W / 2 - 220, 586, 220, 48, g.t('toMap'), function () { g.goto('camp'); }, { primary: true, size: 17 }); button(c, W / 2 + 10, 586, 200, 48, g.t('retry'), function () { host.startMission(r.id); }); }
    else { button(c, W / 2 - 220, 586, 220, 48, g.t('retry'), function () { host.startMission(r.id); }, { primary: true, size: 17 }); button(c, W / 2 + 10, 586, 200, 48, g.t('toMap'), function () { g.goto('camp'); }); }
  }

  // ---------- итог кампании (def.finale последней миссии) ----------
  // def.finale = { title, rows: [{ icon, label, flag, values: { v: текст } }], lines: [{ who, when, text }], epilogue, cont }
  // when — по флагам кампании: { t: 'flag', key, value } | all/any/not { of }
  function fcond(w, flags) {
    if (!w) return true;
    if (w.t === 'flag') return w.value == null ? !!flags[w.key] : flags[w.key] === w.value;
    if (w.t === 'all') return w.of.every(function (x) { return fcond(x, flags); });
    if (w.t === 'any') return w.of.some(function (x) { return fcond(x, flags); });
    if (w.t === 'not') return !fcond(w.of, flags);
    if (w.t === 'stars') return UI.finStars().got >= (w.gte || 0);
    return false;
  }
  UI.finStars = function () { var ms = missions(), got = 0; ms.forEach(function (m) { var rc = UI.data.missions[m.id]; if (rc) rc.stars.forEach(function (x) { if (x) got++; }); }); return { got: got, all: ms.length * 3 }; };
  UI.finLines = function (def) { var F = def.finale, fl = UI.data.flags || {}, out = []; ['yarina', 'tikhon'].forEach(function (who) { var ln = (F.lines || []).filter(function (l) { return l.who === who && fcond(l.when, fl); })[0]; if (ln) out.push(ln); }); return out; };
  function drawFinale(c) {
    var def = C.byId(finId), p = pal(); hot = []; if (!def || !def.finale) { g.goto('camp'); return; }
    var F = def.finale, fl = UI.data.flags || {}, x0 = 110, y0 = 34, pw = 1060, ph = 652; panel(c, x0, y0, pw, ph);
    text(g.t('finT').toUpperCase() + (campTitle(C.campOf(def)) ? ' · ' + campTitle(C.campOf(def)) : ''), W / 2, y0 + 40, { size: 14, align: 'center', color: p.muted });
    text(tx(F.title), W / 2, y0 + 82, { size: 32, weight: 900, align: 'center', color: g.th().accent });
    var fs = UI.finStars(); star(c, W / 2 - 70, y0 + 116, 14, fs.got > 0); text(g.t('finStars') + ': ' + fs.got + ' / ' + fs.all, W / 2 - 48, y0 + 122, { size: 16 });
    // решения по флагам
    var y = y0 + 160; text(g.t('finChoices'), x0 + 40, y, { size: 14, color: p.muted }); y += 4;
    (F.rows || []).forEach(function (rw) { var v = fl[rw.flag], tv = rw.values && (rw.values[v] || rw.values['*']); if (!tv) return; y += 29; icon(c, rw.icon || 'flag', x0 + 40, y - 21, 24); text(tx(rw.label) + ':', x0 + 76, y - 3, { size: 14, color: p.muted, weight: 700 }); text(tx(tv), x0 + 300, y - 3, { size: 15, weight: 700, color: p.amberHi, maxWidth: pw - 340 }); });
    // реплики героев
    y += 18;
    UI.finLines(def).forEach(function (ln) { var lines = wrap(c, tx(ln.text), pw - 190, 15); portrait(c, ln.who, x0 + 66, y + 22, 22); text(g.t(WHO[ln.who].name), x0 + 104, y + 10, { size: 12, color: p.accent });
      lines.slice(0, 3).forEach(function (l, k) { text(l, x0 + 104, y + 30 + k * 20, { size: 15, weight: 600 }); }); y += 28 + Math.min(3, lines.length) * 20; });
    if (F.epilogue) { y += 14; wrap(c, tx(F.epilogue), pw - 120, 14).slice(0, 3).forEach(function (l) { text(l, W / 2, y, { size: 14, align: 'center', color: p.muted, weight: 600 }); y += 19; }); }
    var cy = Math.min(y + 2, y0 + ph - 116), ct = '✶ ' + (F.cont ? tx(F.cont) : g.t('finCont')) + ' ✶'; c.font = '800 17px ' + g.th().font; var cw = Math.min(pw - 60, c.measureText(ct).width + 48);
    R.prims.box(c, W / 2 - cw / 2, cy, cw, 36, ret() ? '#2a3a20' : 'rgba(111,154,58,0.22)', ret(), 8);
    text(ct, W / 2, cy + 24, { size: 17, weight: 800, align: 'center', color: p.mossHi });
    button(c, W / 2 - 230, y0 + ph - 70, 220, 46, g.t('toMap'), function () { g.goto('camp'); }, { primary: true, size: 16 });
    button(c, W / 2 + 10, y0 + ph - 70, 220, 46, g.t('toMenu'), function () { g.goto('title'); });
  }

  // ---------- в бою ----------
  // счётчик цели: def.count = условие (gathered / res / trained / spans / units / killed / zone) + n — показывается «(сейчас/n)»
  function countOf(G, MS, cn) {
    switch (cn.t) {
      case 'gathered': return MS.gath[cn.type || '*'] || 0;
      case 'res': return Math.floor(G.res[cn.owner || 0][cn.k]);
      case 'trained': return MS.trained[cn.type] || 0;
      case 'spans': return G.decks(0).filter(function (b) { return b.done; }).length;
      case 'units': return G.ents.filter(function (e) { return !e.dead && e.kind === 'u' && e.owner === (cn.owner || 0) && (!cn.type || e.type === cn.type) && (!cn.tag || e.tag === cn.tag); }).length;
      case 'killed': return MS.killed[cn.tag] || 0;
      case 'escaped': return MS.escaped[cn.tag] || 0;
      case 'site': return Math.floor(((MS.sites[cn.id] || {}).prog || 0) * 100);
      case 'alive': return G.ents.filter(function (e) { return !e.dead && e.tag === cn.tag; }).length;
      case 'built': return G.count(cn.owner || 0, 'b', cn.type, function (b) { return b.done; });
      case 'zone': return G.ents.filter(function (u) { return !u.dead && u.kind === 'u' && u.owner === (cn.owner || 0) && (!cn.who || u.type === cn.who || u.tag === cn.who) && C.inZone(MS, cn.zone, u.x / T, u.y / T); }).length;
    }
    return 0;
  }
  function objLabel(G, MS, ob) {
    var s = tx(ob.def.text), cn = ob.def.count; if (!cn || ob.state !== 'active') return s;
    if (cn.t === 'site') { var st = MS.sites[cn.id] || {}; return s + ' (' + countOf(G, MS, cn) + '% · ' + (st.hot ? g.t('siteHot') : st.busy ? g.t('siteBusy') : st.idle ? tx(st.idle) : g.t('siteIdle')) + ')'; }
    return s + ' (' + Math.min(cn.n, countOf(G, MS, cn)) + '/' + cn.n + ')';
  }
  UI.drain = function (G) {
    var MS = G.mission; if (!MS) return;
    MS.ui.forEach(function (e) {
      if (e.t === 'say') { say = { who: e.who, text: tx(e.text), until: g.time + (e.life || 6) }; g.audio.beep(e.who === 'thicket' ? 300 : 640, 0.05, 'triangle'); }
      else if (e.t === 'msg') host.note(tx(e.text), e.col || 'warn');
      else if (e.t === 'obj') { var ob = MS.byObj[e.id]; if (!ob) return; if (e.state === 'done') { host.note(g.t('objDone') + ': ' + tx(ob.def.text), 'good'); g.audio.beep(990, 0.1, 'triangle'); } else if (e.state === 'active' && ob.t > 0.5) host.note(g.t('objNew') + ': ' + tx(ob.def.text), 'warn'); else if (e.state === 'failed') host.note(g.t('objFail') + ': ' + tx(ob.def.text), 'bad'); }
      else if (e.t === 'heroDown') host.note(g.t('u_' + e.who) + ' — ' + g.t('heroDown'), 'bad');
      else if (e.t === 'spanLost') { host.note(g.t('spanLost'), 'bad'); g.audio.beep(110, 0.25, 'sawtooth', 0.5); }
      else if (e.t === 'alert') host.note(g.t('alertN'), 'warn');
      else if (e.t === 'siteDone') { host.note(g.t('siteDone'), 'good'); g.audio.beep(660, 0.1, 'triangle'); g.audio.beep(990, 0.14, 'triangle'); }
      else if (e.t === 'convoyStop') { host.note(g.t('convoyStop'), 'warn'); g.audio.beep(300, 0.08, 'square'); }
      else if (e.t === 'convoyGo') host.note(g.t('convoyGo'), 'good');
      else if (e.t === 'camera') host.centerOn(e.x, e.y);
      else if (e.t === 'ping') host.ping(e.x, e.y);
    });
    MS.ui.length = 0;
  };
  // в координатах мира: отметки зоны активной цели, знамёна
  UI.under = function (G) {
    return function (c, p, rt) {
      var MS = G.mission, t = g.time;
      G.banners.forEach(function (b) { var k = Math.max(0, (b.until - G.t) / 30); c.strokeStyle = p.copperHi; c.globalAlpha = 0.35 + 0.4 * k; c.lineWidth = 2; if (!rt) c.setLineDash([8, 6]); c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.stroke(); c.setLineDash([]); c.globalAlpha = 0.12; c.fillStyle = p.copper; c.fill(); c.globalAlpha = 1;
        R.prims.box(c, b.x - 1, b.y - 34, 3, 34, p.iron, rt); R.prims.box(c, b.x + 2, b.y - 34 + Math.sin(t * 4) * 1.5, 16, 10, p.copper, rt); });
      if (!MS) return;
      drawWall(c, G, p, rt, t);
      Object.keys(MS.sites || {}).forEach(function (id) { var st = MS.sites[id]; if (!st.on) return; var q = C.pointOf(MS, st.at), x = q.x * T, y = q.y * T, r = (st.r || 2.5) * T;
        c.globalAlpha = 0.85; c.strokeStyle = 'rgba(0,0,0,0.5)'; c.lineWidth = 6; c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
        c.strokeStyle = st.hot ? p.hpBad : st.prog >= 1 ? p.hpGood : p.brass; c.lineWidth = 4; c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, st.prog)); c.stroke(); c.globalAlpha = 1;
        if (!rt) c.setLineDash([4, 6]); c.strokeStyle = p.brass; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r - 6, 0, 7); c.stroke(); c.setLineDash([]);
        if (st.prog < 1) text(Math.floor(st.prog * 100) + '%', x, y - r - 6, { size: 13, align: 'center', color: st.hot ? p.hpBad : p.brass, weight: 800 }); });
      var ob = MS.objs.filter(function (o) { return o.state === 'active' && o.def.hint && o.def.hint.zone; })[0]; if (!ob) return;
      var z = ob.def.hint.zone, zc = C.zoneCenter(MS, z), zr = C.zoneRadius(MS, z), pulse = 1 + Math.sin(t * 3) * 0.04;
      c.strokeStyle = p.amberHi; c.lineWidth = 2.5; c.globalAlpha = 0.8; if (!rt) c.setLineDash([10, 8]); c.beginPath(); c.arc(zc.x * T, zc.y * T, zr * T * pulse, 0, 7); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
    };
  };
  // Зимний вал: за кромкой — белёсая пелена, по кромке — ледяные зубцы (в координатах мира)
  function drawWall(c, G, p, rt, t) {
    var w = G.wall; if (!w) return; var MWp = G.MW * T, MHp = G.MH * T, pos = w.pos * T, horiz = w.dir === 's' || w.dir === 'n', fwd = w.dir === 's' || w.dir === 'e';
    c.save(); c.fillStyle = rt ? 'rgba(200,224,248,0.35)' : 'rgba(225,240,252,0.32)';
    if (horiz) c.fillRect(0, fwd ? 0 : pos, MWp, fwd ? pos : MHp - pos); else c.fillRect(fwd ? 0 : pos, 0, fwd ? pos : MWp - pos, MHp);
    var L = horiz ? MWp : MHp, step = rt ? 24 : 20, sg = fwd ? 1 : -1;
    for (var k = 0; k < L; k += step) { var hh = 10 + ((k * 7919) % 17) + Math.sin(t * 2 + k * 0.05) * 2, a = k, b = pos, col = (k / step) % 2 ? p.iceHi : p.ice;
      c.fillStyle = col; c.beginPath();
      if (horiz) { c.moveTo(a + step / 2, b + sg * hh); c.lineTo(a, b); c.lineTo(a + step, b); } else { c.moveTo(b + sg * hh, a + step / 2); c.lineTo(b, a); c.lineTo(b, a + step); }
      c.closePath(); c.fill(); }
    c.strokeStyle = rt ? '#e0f8ff' : 'rgba(240,250,255,0.9)'; c.lineWidth = 2; c.beginPath(); if (horiz) { c.moveTo(0, pos); c.lineTo(MWp, pos); } else { c.moveTo(pos, 0); c.lineTo(pos, MHp); } c.stroke();
    c.restore();
  }
  // снег — в координатах мира поверх сущностей, но ПОД туманом (в неразведанном его не видно); cam — камера main.js
  UI.over = function (G, cam, V) {
    return function (c) {
      var n = Math.round(G.cold * 160); if (n <= 0) return;
      while (flakes.length < n) flakes.push({ x: Math.random() * V.w, y: Math.random() * V.h, s: 0.6 + Math.random() * 1.6, v: 30 + Math.random() * 50, ph: Math.random() * 6 });
      var t = g.time, rt = ret(); c.fillStyle = 'rgba(240,246,255,0.75)';
      for (var i = 0; i < n; i++) { var f = flakes[i], y = (f.y + t * f.v) % V.h, x = (f.x + Math.sin(t + f.ph) * 14 + t * 12) % V.w; var sz = rt ? 3 : f.s * 1.6; c.fillRect(Math.round(cam.x) + x, Math.round(cam.y) + y, sz, sz); }
    };
  };
  function snow(c, G, V) {
    if (G.cold <= 0.01 || ret()) return;
    // иней по верхнему краю вида
    var gr = c.createLinearGradient(0, V.sy, 0, V.sy + 60); gr.addColorStop(0, pal().frost + (0.35 * G.cold) + ')'); gr.addColorStop(1, pal().frost + '0)'); c.fillStyle = gr; c.fillRect(V.sx, V.sy, V.w, 60);
  }
  UI.hud = function (c, G, V) {
    var MS = G.mission; if (!MS) return; var p = pal(), rt = ret();
    snow(c, G, V);
    // цели
    var rows = MS.objs.filter(function (o) { return o.state === 'active' || (o.state === 'done' && G.t - o.t < 8); });
    UI.hudBottom = rows.length ? V.sy + 8 + 12 + rows.length * 22 : 0;   // main.js ставит уведомления ниже панели целей
    if (rows.length) {
      c.font = '700 13px ' + g.th().font; var wm = 0; rows.forEach(function (o) { wm = Math.max(wm, c.measureText(objLabel(G, MS, o)).width); });
      var bw = Math.min(520, wm + 50), bh = 12 + rows.length * 22, bx = V.sx + 8, by = V.sy + 8;
      R.prims.box(c, bx, by, bw, bh, 'rgba(0,0,0,0.55)', rt, 8);
      rows.forEach(function (o, i) { var yy = by + 22 + i * 22, dn = o.state === 'done';
        R.prims.box(c, bx + 10, yy - 11, 12, 12, dn ? p.hpGood : 'rgba(255,255,255,0.15)', rt, 3); if (o.def.kind === 'opt') text('◇', bx + 16, yy, { size: 11, align: 'center', color: p.ink });
        text(objLabel(G, MS, o), bx + 30, yy, { size: 13, color: dn ? p.hpGood : p.ink, maxWidth: bw - 40 }); });
    }
    // таймер миссии (def.timer = { at, text })
    var tm = MS.def.timer; if (tm && !(tm.until && C.cond(G, tm.until))) { var left = tm.at - G.t; if (left > 0) { var lb = tx(tm.text) + ' ' + fmt(left); c.font = '800 15px ' + g.th().font; var tw = c.measureText(lb).width + 30;
      var tx0 = V.sx + V.w - tw - 10; R.prims.box(c, tx0, V.sy + 8, tw, 26, left < 60 ? 'rgba(120,20,20,0.7)' : 'rgba(0,0,0,0.55)', rt, 7); text(lb, tx0 + tw / 2, V.sy + 26, { size: 15, align: 'center', weight: 800, color: left < 60 ? '#ffd0d0' : p.iceHi }); } }
    // реплика героя
    if (say && g.time < say.until) {
      var lines = wrap(c, say.text, 560, 15), sh = 26 + lines.length * 20, sx = W / 2 - 330, sy = V.sy + V.h - sh - 12;
      R.prims.box(c, sx, sy, 660, sh, 'rgba(8,10,14,0.82)', rt, 10); c.strokeStyle = p.line; c.lineWidth = 1.5; c.strokeRect(sx + 0.5, sy + 0.5, 659, sh - 1);
      portrait(c, say.who, sx + 34, sy + sh / 2, 22); var wn = WHO[say.who]; if (wn && wn.name) text(g.t(wn.name), sx + 68, sy + 18, { size: 12, color: p.accent });
      lines.forEach(function (ln, k) { text(ln, sx + 68, sy + 36 + k * 20 - (wn && wn.name ? 0 : 12), { size: 15, weight: 600 }); });
    }
  };
  // верхняя строка: мороз и дрова (main.js зовёт после своей строки)
  UI.topbar = function (c, G, txt) {
    var p = pal(), rt = ret();
    if (G.cold > 0.01) { icon(c, 'frost', 236, 4, 18); txt(g.t('cold'), 258, 19, { color: p.iceHi, size: 12 }); R.prims.box(c, 306, 10, 50, 9, 'rgba(255,255,255,0.12)', rt, 3); R.prims.box(c, 306, 10, 50 * G.cold, 9, G.cold > 0.66 ? p.hpBad : p.iceHi, rt, 3); }
    if (G.mission && G.mission.def.wood) { var rx = W - 680; icon(c, 'timber', rx - 4, 4, 18); txt(Math.floor(G.res[0].w), rx + 18, 19, { color: p.plankHi }); txt(g.t('wood'), rx + 62, 19, { color: g.th().muted, size: 11, weight: 600 }); }
  };
  UI.finish = function (G) {
    var res = G.mission.result || C.result(G.mission, G.winner === 0);
    camp = C.campOf(G.mission.def); UI.camp = camp;
    UI.data = C.load(store, camp); if (res.win) { UI.data = C.applyResult(UI.data, res); persist(); }
    lastRes = res; say = null; g.goto('result');
  };
  UI.makeGame = function (id, onEvent) { var def = C.byId(id); camp = C.campOf(def); UI.camp = camp; UI.data = C.load(store, camp); say = null; flakes = []; return C.build(def, { save: UI.data, onEvent: onEvent }); };
  UI.available = function () { return ['wright', 'thicket', 'barrow'].some(function (k) { return missions(k).some(playableHere); }); };
  UI.openCamp = function () { UI.data = C.load(store, camp); sel = firstOpen(); g.goto('camp'); };
  UI.openBrief = function (id) { var d = C.byId(id); if (!d || !playableHere(d)) return false; camp = C.campOf(d); UI.camp = camp; UI.data = C.load(store, camp); briefId = id; g.goto('brief'); return true; };

  function inScreens() { return g._sceneName === 'camp' || g._sceneName === 'brief' || g._sceneName === 'result' || g._sceneName === 'finale'; }
  function hitAt(q) { for (var i = hot.length - 1; i >= 0; i--) { var b = hot[i]; if (q.x >= b.x && q.x < b.x + b.w && q.y >= b.y && q.y < b.y + b.h) return i; } return -1; }
  function pt(e) { var r = g.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height }; }
  UI.install = function (game, h) {
    g = game; host = h;
    try { store = global.localStorage; } catch (e) { store = null; }
    UI.store = store; UI.camp = camp; UI.data = C.load(store, camp);
    var draws = { camp: drawCamp, brief: drawBrief, result: drawResult, finale: drawFinale };
    ['camp', 'brief', 'result', 'finale'].forEach(function (name) {
      g.scene(name, { realtime: true,
        enter: function () { hover = -1; resetArm = 0; UI.data = C.load(store, camp); g.audio.beep(520, 0.04); },
        update: function () {},
        draw: function (c) { this.clear(); draws[name](c); },
        press: function (a) {
          if (name === 'camp') { var n = missions().length;
            if (a === 'left' || a === 'up') sel = (sel + n - 1) % Math.max(1, n); else if (a === 'right' || a === 'down') sel = (sel + 1) % Math.max(1, n);
            else if (a === 'start' || a === 'action') { var m = missions()[sel]; if (m) openBrief(m); } else if (a === 'pause') g.goto('title'); }
          else if (name === 'brief') { if (a === 'start' || a === 'action') host.startMission(briefId); else if (a === 'pause') g.goto('camp'); }
          else { if (a === 'start' || a === 'action') { if (hot[0]) hot[0].fn(); } else if (a === 'pause') g.goto('camp'); }
        } });
    });
    g.canvas.addEventListener('pointerdown', function (e) { if (!inScreens()) return; var i = hitAt(pt(e)); if (i >= 0) { e.preventDefault(); var b = hot[i]; g.audio.beep(700, 0.03, 'triangle'); b.fn(); } });
    g.canvas.addEventListener('pointermove', function (e) { if (!inScreens()) return; hover = hitAt(pt(e)); g.canvas.style.cursor = hover >= 0 ? 'pointer' : 'default'; });
  };
  UI.openFinale = function (id) { var d = C.byId(id); if (!d || !d.finale) return false; camp = C.campOf(d); UI.camp = camp; UI.data = C.load(store, camp); finId = id; g.goto('finale'); return true; };
  UI._test = { missions: missions, state: state, nodes: NODES, hot: function () { return hot; }, sel: function () { return sel; }, setSel: function (i) { sel = i; }, last: function () { return lastRes; }, fcond: fcond };
})(typeof window !== 'undefined' ? window : globalThis);
