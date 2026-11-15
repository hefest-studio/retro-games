/* ПРИИСК · js/campaign-ui.js — экраны и интерфейс кампании поверх движка Гефест Arcade:
   карта кампании (сцена 'camp'), брифинг ('brief': мини-карта + пиктограммы целей + 1–2 фразы), итог ('result': звёзды, время,
   потери, флаги, «Далее»), а в бою — цели, реплики героев, кнопки способностей (Q/E), подсказки обучения, ночь и метель.
   Логика миссий — в campaign.js (без DOM); здесь только рисование, ввод и сохранение прогресса в localStorage.
   Издание (js/edition.js): в демо играбельна только миссия 1, остальные узлы карты — под замком «В полной версии»,
   после победы в миссии 1 — экран 'edition' «Продолжение — в полной версии». Файлы миссий подключает js/missions/index.js. */
(function (global) {
  'use strict';
  var P = global.PRIISK, L = P.logic, C = P.campaign, R = P.render, LY = R.LAYOUT, T = R.TILE, E = P.Edition;
  var UI = P.campUI = {};
  var g = null, host = null, store = null, hot = [], hover = -1, sel = 0, briefId = null, lastRes = null, resetArm = 0, flakes = [];
  // Узлы карты кампании без файла миссии в этой сборке (или закрытые изданием) — заглушки с названиями миссий 2–10
  var LATER = [
    { n: 2, ru: 'Разведка в метели', en: 'Whiteout Recon' },
    { n: 3, ru: 'Удержать брод', en: 'Hold the Ford' }, { n: 4, ru: 'Обоз до станции', en: 'Convoy to the Station' },
    { n: 5, ru: 'Гонка за жилой', en: 'Race for the Lode' }, { n: 6, ru: 'Провал', en: 'The Sinkhole' },
    { n: 7, ru: 'Чужая беда', en: 'Another’s Trouble' }, { n: 8, ru: 'Паровая громада', en: 'Steam Colossus' },
    { n: 9, ru: 'Штольни', en: 'The Adits' }, { n: 10, ru: 'Сердце плато', en: 'Heart of the Plateau' }];
  var NODES = [[95, 432], [178, 352], [268, 404], [350, 322], [452, 362], [528, 280], [446, 204], [334, 218], [250, 142], [400, 112]];
  var WHO = { varvara: { col: 0, letter: { ru: 'В', en: 'V' } }, lunya: { col: 0, letter: { ru: 'Л', en: 'L' } }, sava: { col: 0, letter: { ru: 'С', en: 'S' } },
    korney: { col: 1, letter: { ru: 'К', en: 'K' } }, foe: { col: 1, letter: { ru: 'С', en: 'G' } } };

  function lang() { return g.i18n.lang; }
  function tx(o) { return C.txt(o, lang()); }
  function pal() { return R.PAL[g.themeName === 'retro' ? 'retro' : 'modern']; }
  function th() { return g.themeName === 'retro' ? 'retro' : 'modern'; }
  function font() { return pal().font; }
  function text(c, s, x, y, o) { o = o || {}; R.txt(c, s, x, y, { color: o.color || pal().ink, font: font(), size: o.size || 13, weight: o.weight || 700, align: o.align, base: o.base }); }
  function wrap(c, s, maxW, size, weight) { c.font = (weight || 600) + ' ' + size + 'px ' + font(); var words = String(s).split(' '), out = [], line = ''; words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }); if (line) out.push(line); return out; }
  function fmtTime(s) { s = Math.round(s || 0); var m = Math.floor(s / 60), r = s % 60; return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r; }
  function data() { return UI.data; }
  function persist() { C.save(store, UI.data); }

  // ---------- пиктограммы ----------
  function icon(c, kind, x, y, s, pl) {
    pl = pl || pal(); c.save(); c.translate(x, y);
    if (L.BLDS[kind]) { c.scale(s / 30, s / 30); R.drawIcon(c, 'bld', kind, 0, 0, pl); c.restore(); return; }
    if (L.UNITS[kind]) { c.scale(s / 30, s / 30); R.drawIcon(c, 'unit', kind, 0, 0, pl); c.restore(); return; }
    var k = s / 24; c.scale(k, k); c.lineWidth = 2; c.strokeStyle = pl.ink; c.fillStyle = pl.ink;
    if (kind === 'copper') { c.fillStyle = pl.ore; c.beginPath(); c.moveTo(3, 14); c.lineTo(8, 5); c.lineTo(18, 6); c.lineTo(21, 15); c.lineTo(12, 20); c.closePath(); c.fill(); c.fillStyle = pl.oreHi; c.fillRect(9, 8, 4, 3); }
    else if (kind === 'shield') { c.fillStyle = pl.own[0]; c.beginPath(); c.moveTo(12, 2); c.lineTo(21, 6); c.lineTo(19, 15); c.lineTo(12, 22); c.lineTo(5, 15); c.lineTo(3, 6); c.closePath(); c.fill(); c.strokeStyle = pl.ownDk[0]; c.stroke(); }
    else if (kind === 'eye') { c.strokeStyle = pl.ink; c.beginPath(); c.moveTo(2, 12); c.quadraticCurveTo(12, 2, 22, 12); c.quadraticCurveTo(12, 22, 2, 12); c.stroke(); c.fillStyle = pl.waterHi; c.beginPath(); c.arc(12, 12, 4, 0, 7); c.fill(); }
    else if (kind === 'home') { c.fillStyle = pl.own[0]; c.beginPath(); c.moveTo(3, 11); c.lineTo(12, 3); c.lineTo(21, 11); c.lineTo(19, 11); c.lineTo(19, 21); c.lineTo(5, 21); c.lineTo(5, 11); c.closePath(); c.fill(); c.fillStyle = pl.ownDk[0]; c.fillRect(10, 14, 4, 7); }
    else if (kind === 'clock') { c.strokeStyle = pl.ink; c.beginPath(); c.arc(12, 12, 9, 0, 7); c.stroke(); c.beginPath(); c.moveTo(12, 12); c.lineTo(12, 6); c.moveTo(12, 12); c.lineTo(16, 14); c.stroke(); }
    else if (kind === 'nobld') { c.fillStyle = pl.wall; c.fillRect(4, 9, 16, 12); c.fillStyle = pl.roof; c.beginPath(); c.moveTo(2, 10); c.lineTo(12, 3); c.lineTo(22, 10); c.closePath(); c.fill(); c.strokeStyle = pl.good; c.lineWidth = 3; c.beginPath(); c.moveTo(7, 15); c.lineTo(11, 19); c.lineTo(18, 11); c.stroke(); }
    else if (kind === 'convoy') { c.fillStyle = pl.own[1]; c.fillRect(3, 9, 15, 7); c.fillStyle = pl.ore; c.fillRect(5, 6, 10, 4); c.strokeStyle = pl.ink; c.beginPath(); c.moveTo(2, 19); c.lineTo(19, 19); c.quadraticCurveTo(23, 19, 22, 15); c.stroke(); }
    else if (kind === 'foe') { c.fillStyle = pl.own[1]; c.beginPath(); c.moveTo(12, 3); c.lineTo(21, 20); c.lineTo(3, 20); c.closePath(); c.fill(); c.fillStyle = pl.panel; c.fillRect(11, 8, 2, 7); c.fillRect(11, 16, 2, 2); }
    else if (kind === 'flag') { c.fillStyle = pl.own[0]; c.fillRect(6, 3, 2, 18); c.fillRect(8, 3, 11, 7); }
    c.restore();
  }
  function star(c, x, y, r, filled, pl) {
    pl = pl || pal(); c.beginPath();
    for (var k = 0; k < 10; k++) { var a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); if (filled) { c.fillStyle = pl.warn; c.fill(); } c.strokeStyle = filled ? pl.ownDk[0] : pl.muted; c.lineWidth = 1.5; c.stroke();
  }
  function portrait(c, who, x, y, r) {
    var pl = pal(), w = WHO[who] || WHO.foe;
    c.fillStyle = pl.ownDk[w.col]; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.fillStyle = pl.own[w.col]; c.beginPath(); c.arc(x, y, r - 3, 0, 7); c.fill();
    text(c, tx(w.letter), x, y + r * 0.38, { size: Math.round(r * 1.05), weight: 900, align: 'center', color: pl.panel });
  }

  // ---------- кнопки экранов ----------
  function button(c, x, y, w, h, label, fn, o) {
    o = o || {}; var pl = pal(), i = hot.length, on = hover === i || o.focus;
    hot.push({ x: x, y: y, w: w, h: h, fn: fn });
    c.fillStyle = o.primary ? (on ? pl.own[0] : pl.ownDk[0]) : (on ? pl.line : 'rgba(255,255,255,0.04)');
    if (pl.pixel) c.fillRect(x, y, w, h); else { R.roundRect(c, x, y, w, h, 6); c.fill(); }
    c.strokeStyle = o.primary ? pl.own[0] : pl.line; c.lineWidth = 1.5; if (pl.pixel) c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); else { R.roundRect(c, x + 0.5, y + 0.5, w - 1, h - 1, 6); c.stroke(); }
    text(c, label, x + w / 2, y + h / 2 + 5, { size: o.size || 14, weight: 800, align: 'center', color: o.primary ? (on ? pl.panel : pl.ink) : pl.ink });
  }
  function pt(e) { var r = g.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * g.W / r.width, y: (e.clientY - r.top) * g.H / r.height }; }
  function inScreens() { return g._sceneName === 'camp' || g._sceneName === 'brief' || g._sceneName === 'result' || g._sceneName === 'edition'; }
  function hitAt(p) { for (var i = hot.length - 1; i >= 0; i--) { var b = hot[i]; if (p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) return i; } return -1; }

  // ---------- карта кампании ----------
  function missionList() {
    var out = P.MISSIONS.filter(function (m) { return E.playable(P.EDITION, m.id); }).map(function (m) { return { n: m.n, id: m.id, def: m, title: m.title }; });
    LATER.forEach(function (l) { if (!out.some(function (m) { return m.n === l.n; })) out.push({ n: l.n, id: null, def: null, title: { ru: l.ru, en: l.en } }); });
    return out.sort(function (a, b) { return a.n - b.n; });
  }
  function nodeState(m) { var d = data(); if (!m.def) return 'later'; if (d.missions[m.id]) return 'done'; return m.n <= d.unlocked ? 'open' : 'closed'; }
  function drawPlateau(c, pl) {
    var x0 = 30, y0 = 78, w = 590, h = 420;
    c.fillStyle = pl.pixel ? '#2b2a12' : '#59604f'; if (pl.pixel) c.fillRect(x0, y0, w, h); else { R.roundRect(c, x0, y0, w, h, 14); c.fill(); }
    c.save(); c.beginPath(); c.rect(x0, y0, w, h); c.clip();
    // снежная северная часть
    c.fillStyle = pl.pixel ? '#555555' : 'rgba(220,228,234,0.35)'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + w, y0); c.lineTo(x0 + w, y0 + 150); c.quadraticCurveTo(x0 + 300, y0 + 230, x0, y0 + 120); c.closePath(); c.fill();
    // река
    c.strokeStyle = pl.water; c.lineWidth = 7; c.beginPath(); c.moveTo(x0 + 225, y0); c.bezierCurveTo(x0 + 180, y0 + 140, x0 + 330, y0 + 240, x0 + 300, y0 + h); c.stroke();
    // гряды
    c.strokeStyle = pl.rock; c.lineWidth = 9; c.lineCap = 'round';
    [[60, 210, 160, 170], [380, 120, 520, 160], [470, 300, 560, 420], [120, 300, 60, 380]].forEach(function (r) { c.beginPath(); c.moveTo(x0 + r[0], y0 + r[1]); c.lineTo(x0 + r[2], y0 + r[3]); c.stroke(); });
    c.lineCap = 'butt';
    // отвалы меди
    [[110, 370], [300, 300], [470, 230], [380, 60]].forEach(function (p) { c.fillStyle = pl.ore; c.beginPath(); c.arc(x0 + p[0], y0 + p[1], 5, 0, 7); c.fill(); c.fillStyle = pl.oreHi; c.fillRect(x0 + p[0] - 1, y0 + p[1] - 3, 3, 2); });
    c.restore();
  }
  function drawCamp(c) {
    var pl = pal(), d = data(), ms = missionList(), t = g.time || 0; hot = [];
    g.clear();
    text(c, g.t('campMap'), 30, 40, { size: 24, weight: 900, color: g.th().accent });
    text(c, g.t('campSub'), 30, 62, { size: 13, weight: 600, color: pl.muted });
    drawPlateau(c, pl);
    // дорога между узлами
    c.strokeStyle = pl.wall; c.lineWidth = 3; c.setLineDash([7, 6]); c.beginPath(); NODES.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); c.setLineDash([]);
    ms.forEach(function (m, i) {
      var p = NODES[i] || [0, 0], st = nodeState(m), on = i === sel, r = 17;
      hot.push({ x: p[0] - 22, y: p[1] - 22, w: 44, h: 44, fn: function () { if (sel === i) openBrief(m); sel = i; }, node: i });
      if (on) { c.strokeStyle = g.th().accent; c.lineWidth = 2; c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5); c.beginPath(); c.arc(p[0], p[1], r + 6, 0, 7); c.stroke(); c.globalAlpha = 1; }
      c.fillStyle = st === 'done' ? pl.own[0] : st === 'open' ? pl.ownDk[0] : pl.panel; c.beginPath(); c.arc(p[0], p[1], r, 0, 7); c.fill();
      c.strokeStyle = st === 'later' || st === 'closed' ? pl.line : pl.own[0]; c.lineWidth = 2; c.stroke();
      text(c, String(m.n), p[0], p[1] + 5, { size: 14, weight: 900, align: 'center', color: st === 'done' ? pl.panel : st === 'open' ? pl.ink : pl.muted });
      if (st === 'later' && E.stub(P.EDITION) === 'full') lock(c, p[0] + 12, p[1] - 13, pl);
      if (st === 'done') { var stars = d.missions[m.id].stars || []; for (var k = 0; k < 3; k++) star(c, p[0] - 13 + k * 13, p[1] + r + 9, 5, !!stars[k], pl); }
    });
    // карточка выбранной миссии
    var m = ms[sel] || ms[0], st = nodeState(m), cx = 640, cy = 78, cw = 300;
    c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(cx, cy, cw, 420); c.strokeStyle = pl.line; c.strokeRect(cx + 0.5, cy + 0.5, cw - 1, 419);
    text(c, (g.t('mission') + ' ' + m.n).toUpperCase(), cx + 16, cy + 28, { size: 12, color: pl.muted });
    wrap(c, tx(m.title), cw - 32, 20, 900).forEach(function (ln, k) { text(c, ln, cx + 16, cy + 56 + k * 24, { size: 20, weight: 900, color: st === 'later' ? pl.muted : pl.ink }); });
    var y = cy + 92;
    if (m.def) {
      text(c, tx(m.def.kind), cx + 16, y, { size: 12, weight: 600, color: pl.muted }); y += 24;
      var rec = d.missions[m.id];
      for (var k = 0; k < 3; k++) star(c, cx + 26 + k * 26, y, 9, !!(rec && rec.stars[k]), pl);
      if (rec) text(c, g.t('bestTime') + ' ' + fmtTime(rec.time), cx + 112, y + 5, { size: 12, color: pl.muted, weight: 600 });
      y += 28;
      (m.def.objectives || []).forEach(function (o) { if (y > cy + 330) return; icon(c, o.icon, cx + 16, y - 13, 18, pl); text(c, tx(o.text) + (o.kind === 'opt' ? ' · ' + g.t('optional') : ''), cx + 42, y, { size: 12, weight: 600, color: pl.ink }); y += 24; });
      if (m.id === 'm2' && d.flags.convoy && m.def.flagText) { y += 4; wrap(c, '◆ ' + tx(m.def.flagText.convoy[d.flags.convoy]), cw - 32, 11).forEach(function (ln) { text(c, ln, cx + 16, y, { size: 11, weight: 600, color: pl.warn }); y += 16; }); }
      if (st === 'closed') text(c, g.t('closed'), cx + 16, cy + 372, { size: 12, color: pl.muted, weight: 600 });
      else button(c, cx + 16, cy + 352, cw - 32, 40, '▶ ' + g.t('brief'), function () { openBrief(m); }, { primary: true });
    } else if (E.stub(P.EDITION) === 'full') {
      lock(c, cx + 24, y - 5, pl, 1.3); text(c, g.t('lockedFull'), cx + 40, y, { size: 14, color: pl.warn }); y += 24;
      wrap(c, g.t('lockedFullSub'), cw - 32, 12).forEach(function (ln) { text(c, ln, cx + 16, y, { size: 12, weight: 600, color: pl.muted }); y += 18; });
      button(c, cx + 16, cy + 352, cw - 32, 40, g.t('more') + ' ↗', openMore);
    } else {
      text(c, g.t('locked'), cx + 16, y, { size: 13, color: pl.warn }); y += 22;
      wrap(c, g.t('lockedSub'), cw - 32, 12).forEach(function (ln) { text(c, ln, cx + 16, y, { size: 12, weight: 600, color: pl.muted }); y += 18; });
    }
    button(c, 30, 506, 150, 28, '← ' + g.t('toMenu'), function () { g.goto('title'); }, { size: 13 });
    button(c, 470, 506, 150, 28, resetArm > t ? g.t('resetSure').slice(0, 18) + '…' : g.t('reset'), function () { if (resetArm > (g.time || 0)) { UI.data = C.reset(store); sel = 0; resetArm = 0; } else resetArm = (g.time || 0) + 3; }, { size: 11 });
    text(c, g.t('campHint'), 640, 524, { size: 10, weight: 600, color: pl.muted });
  }
  function lock(c, x, y, pl, k) {
    k = k || 1; c.save(); c.translate(x, y); c.scale(k, k);
    c.strokeStyle = pl.warn; c.lineWidth = 2; c.beginPath(); c.arc(0, -3, 4, Math.PI, 0); c.lineTo(4, 0); c.moveTo(-4, 0); c.lineTo(-4, -3); c.stroke();
    c.fillStyle = pl.warn; c.fillRect(-6, -1, 12, 9); c.fillStyle = pl.panel; c.fillRect(-1, 2, 2, 3);
    c.restore();
  }
  // новая вкладка (окно с 'noopener' всегда возвращает null — тогда не понять, открылась ли вкладка); не открылась — переход в этой же
  function openMore() { var url = E.MORE_URL, w = null; try { w = global.open(url, '_blank'); } catch (e) {} if (w) { try { w.opener = null; } catch (e) {} } else location.href = url; }
  function openBrief(m) { if (!m.def || nodeState(m) === 'closed') { g.audio.beep(180, 0.06, 'square'); return; } briefId = m.id; g.goto('brief'); }

  // ---------- брифинг ----------
  function drawMiniMap(c, def, x, y, maxW, maxH, pl) {
    var map = C.parseMap(def.map, def.legend), s = Math.floor(Math.min(maxW / map.w, maxH / map.h) * 10) / 10, gp = R.groundPal({ ground: def.ground }, th(), pl);
    var ox = x + (maxW - map.w * s) / 2, oy = y;
    for (var j = 0; j < map.h; j++) for (var i = 0; i < map.w; i++) {
      var k = j * map.w + i, t = map.t[k];
      c.fillStyle = t === L.ROCK ? pl.rock : t === L.WATER ? pl.water : t === L.ICE ? gp.ice : t === L.OPEN ? gp.open : map.ore[k] ? pl.ore : ((i + j) % 2 ? gp.g1 : gp.g2);
      c.fillRect(ox + i * s, oy + j * s, Math.ceil(s), Math.ceil(s));
    }
    c.strokeStyle = pl.line; c.lineWidth = 2; c.strokeRect(ox - 1, oy - 1, map.w * s + 2, map.h * s + 2);
    var MS = { points: map.points, def: def };
    (def.briefMarks || []).forEach(function (bm) {
      var p = C.pointOf(MS, bm.at), px = ox + p.x * s, py = oy + p.y * s;
      if (bm.r) { c.strokeStyle = pl.warn; c.setLineDash([5, 4]); c.lineWidth = 2; c.beginPath(); c.arc(px, py, bm.r * s, 0, 7); c.stroke(); c.setLineDash([]); }
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.beginPath(); c.arc(px, py, 13, 0, 7); c.fill();
      icon(c, bm.icon, px - 10, py - 10, 20, pl);
    });
    return { x: ox, y: oy, w: map.w * s, h: map.h * s };
  }
  function drawBrief(c) {
    var pl = pal(), def = C.byId(briefId), d = data(); hot = []; g.clear();
    text(c, (g.t('mission') + ' ' + def.n + ' · ' + tx(def.kind)).toUpperCase(), 30, 34, { size: 12, color: pl.muted });
    text(c, tx(def.title), 30, 64, { size: 26, weight: 900, color: g.th().accent });
    var mm = drawMiniMap(c, def, 30, 84, 470, 340, pl);
    var y = mm.y + mm.h + 30;
    wrap(c, tx(def.brief), 470, 14, 600).slice(0, 3).forEach(function (ln) { text(c, ln, 30, y, { size: 14, weight: 600 }); y += 20; });
    // правая колонка: цели, звёзды, отряд
    var x = 540; y = 100;
    text(c, g.t('objectives').toUpperCase(), x, y, { size: 12, color: pl.muted }); y += 10;
    def.objectives.forEach(function (o, i) {
      c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(x, y, 390, 28);
      icon(c, o.icon, x + 6, y + 3, 22, pl);
      text(c, (o.kind === 'opt' ? '◇ ' : (i + 1) + '. ') + tx(o.text), x + 38, y + 19, { size: 13, weight: 700, color: o.kind === 'opt' ? pl.warn : pl.ink });
      y += 31;
    });
    y += 12; text(c, g.t('starsT').toUpperCase(), x, y, { size: 12, color: pl.muted }); y += 22;
    var rec = d.missions[def.id], stars = [{ icon: 'flag', text: { ru: g.t('starDone'), en: g.t('starDone') } }].concat(def.stars || []);
    stars.forEach(function (s, i) { star(c, x + 10, y - 4, 8, !!(rec && rec.stars[i]), pl); icon(c, s.icon, x + 26, y - 15, 18, pl); text(c, tx(s.text), x + 52, y, { size: 12, weight: 600 }); y += 22; });
    y += 10; text(c, g.t('heroesT').toUpperCase(), x, y, { size: 12, color: pl.muted }); y += 24;
    var hx = x;
    (def.heroes || []).forEach(function (h) {
      portrait(c, h, hx + 14, y - 4, 14);
      var tag = (def.required || []).indexOf(h) >= 0 ? g.t('required') : (d.roster.heroes[h] && d.roster.heroes[h].wounded ? g.t('wounded') : '');
      text(c, g.t(h), hx + 34, y - 4, { size: 12, weight: 800 }); if (tag) text(c, tag, hx + 34, y + 11, { size: 11, weight: 700, color: tag === g.t('required') ? pl.warn : pl.bad });
      hx += (def.heroes.length > 2 ? 128 : 140);
    });
    var vets = (d.roster.vets || []).length; if (vets) { if (def.heroes && def.heroes.length > 2) text(c, '⌃ ' + g.t('vetsT') + ': ' + vets, x, y + 30, { size: 12, weight: 700, color: pl.oreHi }); else text(c, '⌃ ' + g.t('vetsT') + ': ' + vets, hx + 4, y, { size: 12, weight: 700, color: pl.oreHi }); }
    button(c, 540, 470, 240, 44, '▶ ' + g.t('start'), function () { host.startMission(def.id); }, { primary: true, size: 16 });
    button(c, 790, 470, 140, 44, '← ' + g.t('backBtn'), function () { g.goto('camp'); });
  }

  // ---------- итог ----------
  function drawResult(c) {
    var pl = pal(), r = lastRes, def = C.byId(r.id); hot = []; g.clear();
    text(c, (g.t('mission') + ' ' + def.n + ' · ' + tx(def.title)).toUpperCase(), g.W / 2, 70, { size: 13, color: pl.muted, align: 'center' });
    text(c, r.win ? g.t('resWin') : g.t('resLose'), g.W / 2, 116, { size: 36, weight: 900, align: 'center', color: r.win ? pl.good : pl.bad });
    if (!r.win) text(c, r.reason === 'hq' ? g.t('reasonHq') : tx(r.reason), g.W / 2, 146, { size: 15, weight: 600, align: 'center', color: pl.muted });
    var labels = [g.t('starDone')].concat((def.stars || []).map(function (s) { return tx(s.text); }));
    labels.forEach(function (lb, i) { var x = g.W / 2 + (i - 1) * 190; star(c, x, 200, 26, !!r.stars[i], pl); text(c, lb, x, 248, { size: 12, weight: 700, align: 'center', color: r.stars[i] ? pl.ink : pl.muted }); });
    var y = 300, rows = [[g.t('resTime'), fmtTime(r.time)], [g.t('resLost'), r.lostU + ' ' + g.t('resUnits') + (r.lostB ? ' · ' + r.lostB + ' ' + g.t('resBlds') : '')], [g.t('resKills'), String(r.kills)]];
    if (r.win && r.vets && r.vets.length) rows.push([g.t('resVets'), String(r.vets.length)]);
    rows.forEach(function (rw) { text(c, rw[0], g.W / 2 - 12, y, { size: 14, weight: 600, align: 'right', color: pl.muted }); text(c, rw[1], g.W / 2 + 12, y, { size: 15, weight: 800 }); y += 26; });
    if (r.win && def.flagText) Object.keys(def.flagText).forEach(function (k) { var v = r.flags[k]; if (v && def.flagText[k][v]) { text(c, '◆ ' + tx(def.flagText[k][v]), g.W / 2, y + 8, { size: 14, weight: 700, align: 'center', color: pl.warn }); y += 24; } });
    var next = r.win && P.MISSIONS.filter(function (m) { return m.n === def.n + 1 && E.playable(P.EDITION, m.id); })[0];
    var more = missionList().some(function (m) { return m.n > def.n && !m.def; }), after = E.afterWin(P.EDITION, !!next, more);
    var retry = function () { host.startMission(r.id); }, toMap = function () { g.goto('camp'); };
    if (r.win && after === 'demo') { button(c, g.W / 2 - 250, 456, 240, 44, g.t('next') + ' ▸', function () { g.goto('edition'); }, { primary: true, size: 16 }); button(c, g.W / 2 + 10, 456, 240, 44, g.t('toMap'), toMap); }
    else if (r.win && next) { button(c, g.W / 2 - 250, 456, 240, 44, g.t('next') + ' ▸', function () { briefId = next.id; g.goto('brief'); }, { primary: true, size: 16 }); button(c, g.W / 2 + 10, 456, 240, 44, g.t('toMap'), toMap); }
    else if (r.win) { button(c, g.W / 2 - 250, 456, 240, 44, g.t('toMap') + ' ▸', toMap, { primary: true, size: 16 }); button(c, g.W / 2 + 10, 456, 240, 44, '↻ ' + g.t('retry'), retry); }
    else { button(c, g.W / 2 - 250, 456, 240, 44, '↻ ' + g.t('retry'), retry, { primary: true, size: 16 }); button(c, g.W / 2 + 10, 456, 240, 44, g.t('toMap'), toMap); }
  }

  // ---------- экран издания: «Продолжение — в полной версии» (демо) / «Новые миссии — скоро» (полная) ----------
  function drawEdition(c) {
    var pl = pal(), fin = E.finale(P.EDITION), cx = g.W / 2; hot = []; g.clear();
    drawPlateau(c, pl); c.fillStyle = 'rgba(0,0,0,0.62)'; c.fillRect(0, 0, g.W, g.H);
    var pw = 620, x0 = cx - pw / 2, y0 = 110, ph = 320;
    c.fillStyle = pl.panel; c.fillRect(x0, y0, pw, ph); c.strokeStyle = pl.line; c.lineWidth = 1.5; c.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1);
    icon(c, fin.kind === 'demo' ? 'convoy' : 'flag', cx - 24, y0 + 24, 48, pl);
    var y = y0 + 112;
    wrap(c, g.t(fin.title), pw - 60, 26, 900).forEach(function (ln) { text(c, ln, cx, y, { size: 26, weight: 900, align: 'center', color: g.th().accent }); y += 32; });
    y += 4; wrap(c, g.t(fin.sub), pw - 90, 15, 600).forEach(function (ln) { text(c, ln, cx, y, { size: 15, weight: 600, align: 'center' }); y += 22; });
    var n = fin.items.length, bw = 240, gap = 20, bx = cx - (n * bw + (n - 1) * gap) / 2;
    fin.items.forEach(function (k, i) {
      var fn = k === 'more' ? openMore : function () { g.goto('camp'); };
      button(c, bx + i * (bw + gap), y0 + ph - 70, bw, 44, k === 'more' ? g.t('more') + ' ↗' : '← ' + g.t('toMap'), fn, { primary: i === 0, size: 15, focus: sel2 === i });
    });
  }
  var sel2 = 0;

  // ---------- ввод на экранах ----------
  function sceneKeys(name) {
    return function (a) {
      if (name === 'camp') {
        var n = missionList().length;
        if (a === 'right' || a === 'down') { sel = (sel + 1) % n; g.audio.beep(600, 0.03); }
        else if (a === 'left' || a === 'up') { sel = (sel - 1 + n) % n; g.audio.beep(600, 0.03); }
        else if (a === 'start' || a === 'action') openBrief(missionList()[sel]);
        else if (a === 'pause') g.goto('title');
      } else if (name === 'brief') {
        if (a === 'start' || a === 'action') host.startMission(briefId);
        else if (a === 'pause') g.goto('camp');
      } else if (name === 'edition') {
        var nb = E.finale(P.EDITION).items.length;
        if (a === 'right' || a === 'down') { sel2 = (sel2 + 1) % nb; g.audio.beep(600, 0.03); }
        else if (a === 'left' || a === 'up') { sel2 = (sel2 - 1 + nb) % nb; g.audio.beep(600, 0.03); }
        else if (a === 'start' || a === 'action') { if (hot[sel2]) hot[sel2].fn(); }
        else if (a === 'pause') g.goto('camp');
      } else if (name === 'result') {
        if (a === 'start' || a === 'action') { if (hot[0]) hot[0].fn(); }
        else if (a === 'pause') g.goto('camp');
      }
    };
  }

  // ---------- в бою ----------
  function heroUnit(W, type) { var MS = W.mission, id = MS && MS.heroes[type], u = id && W.byId[id]; return u && u.hp > 0 ? u : null; }
  var AB = [{ hero: 'varvara', key: 'Q', label: 'abCry' }, { hero: 'lunya', key: 'E', label: 'abFlare' }, { hero: 'sava', key: 'R', label: 'abFix' }];
  // кнопки способностей — в одну строку под выделением (до трёх героев делят 290 px)
  function abilityButtons(W) {
    var list = AB.filter(function (a) { return W.mission && W.mission.heroes[a.hero]; }), out = [], n = list.length, w = n > 2 ? 94 : 140, x = 160;
    list.forEach(function (a) { out.push({ x: x, y: LY.VIEW_H + 86, w: w, h: 22, ab: a }); x += w + 4; });
    return out;
  }
  function tipHeroes(MS) { var out = []; AB.forEach(function (a) { if (MS.heroes[a.hero]) out.push(a.key + ' — ' + g.t(a.label)); }); return out.join(' · '); }
  UI.panelAt = function (S, p) { if (!S.W || !S.W.mission) return null; var bs = abilityButtons(S.W); for (var i = 0; i < bs.length; i++) { var b = bs[i]; if (p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h) return b; } return null; };
  UI.useAbility = function (S, hero) {
    var W = S.W, u = W && W.mission && heroUnit(W, hero); if (!u) return false;
    if (u.abT > 0) { host.msg(g.t('msgCd') + ' · ' + Math.ceil(u.abT) + (lang() === 'ru' ? ' с' : ' s'), 'warn'); g.audio.beep(180, 0.06, 'square'); return false; }
    if (hero === 'lunya') { S.targeting = { hero: 'lunya' }; host.msg(g.t('tipFlare')); g.audio.beep(760, 0.04); return true; }
    if (L.ability(W, u) === 'ok') { g.audio.beep(520, 0.12, 'square'); g.audio.beep(780, 0.14, 'triangle'); return true; }
    return false;
  };
  UI.placeFlare = function (S, w) {
    var W = S.W, u = heroUnit(W, 'lunya'); S.targeting = null; if (!u) return;
    var r = L.ability(W, u, w.x, w.y);
    if (r === 'ok') { g.audio.beep(1200, 0.08, 'triangle'); g.audio.beep(900, 0.12, 'sine'); S.marks.push({ x: w.x, y: w.y, kind: 'harvest', life: 0.6 }); }
    else if (r === 'far') { host.msg(g.t('msgFar'), 'bad'); g.audio.beep(150, 0.08, 'square'); }
  };
  // реплики живут по игровому времени; устаревшие в очереди (старше 12 с) выбрасываются
  function sayLine(S, e) { S.say = { who: e.who, text: e.text, life: e.life || 5.5 }; g.audio.beep(e.who === 'foe' ? 260 : 620, 0.05, 'triangle'); }
  // события миссии → реплики, сообщения, звук
  UI.drain = function (S) {
    var W = S.W, MS = W.mission; if (!MS) return;
    MS.ui.forEach(function (e) {
      if (e.t === 'say') { e.at = W.time; if (S.say && S.say.life > 1.2) S.sayQ.push(e); else sayLine(S, e); }
      else if (e.t === 'msg') host.msg(tx(e.text), e.col);
      else if (e.t === 'obj') { var o = MS.byObj[e.id]; if (e.state === 'done') { host.msg('✓ ' + g.t('msgObjDone') + ': ' + tx(o.def.text), 'good'); g.audio.beep(880, 0.07, 'triangle'); g.audio.beep(1320, 0.1, 'triangle'); } else if (e.state === 'active' && W.time > 1) { host.msg(g.t('msgObj') + ': ' + tx(o.def.text), 'warn'); g.audio.beep(660, 0.06); } }
      else if (e.t === 'heroDown') host.msg(g.t(e.who) + ' — ' + g.t('msgHeroDown'), 'bad');
      else if (e.t === 'night') host.msg(g.t('msgNight'), 'warn');
      else if (e.t === 'halt' && MS.groups[e.tag] && MS.groups[e.tag].owner === 0) host.msg(g.t(e.on ? 'msgHalt' : 'msgGo'), e.on ? 'warn' : 'good');
    });
    MS.ui.length = 0;
    // метель: волна сильнее / слабее
    if (MS.weather) { var hi = MS.storm > 0.75, lo = MS.storm < 0.25; if (hi && S.stormWas !== 'hi') { if (S.stormWas) host.msg(g.t('msgStormUp'), 'warn'); S.stormWas = 'hi'; } else if (lo && S.stormWas !== 'lo') { if (S.stormWas) host.msg(g.t('msgStormDown')); S.stormWas = 'lo'; } }
    W.events.forEach(function (ev) { if (ev.t === 'vet' && ev.owner === 0) host.msg(g.t('msgVet') + ': ' + g.t(W.byId[ev.id] ? W.byId[ev.id].type : 'rifleman'), 'good'); });
  };
  UI.update = function (S) {
    var W = S.W, now = W.time, d = S.lastT == null ? 0 : Math.max(0, now - S.lastT); S.lastT = now;
    if (S.say) { S.say.life -= d; if (S.say.life <= 0) { S.say = null; while (S.sayQ.length && now - S.sayQ[0].at > 12) S.sayQ.shift(); if (S.sayQ.length) sayLine(S, S.sayQ.shift()); } }
  };
  function objLabel(W, ob) {
    var s = tx(ob.def.text), cnt = ob.def.count;
    if (cnt && ob.state === 'active' && cnt.t === 'trained') s += ' (' + Math.min(cnt.n, W.players[0].trained[cnt.type] || 0) + '/' + cnt.n + ')';
    return s;
  }
  function hintZone(W) { var ob = W.mission.objs.find(function (o) { return o.state === 'active' && o.def.hint && (o.def.hint.zone || o.def.hint.zones); }); return ob ? ob.def.hint.zone || ob.def.hint.zones : null; }
  function hintBtn(W) { var ob = W.mission.objs.find(function (o) { return o.state === 'active' && o.def.kind !== 'opt'; }); return ob && ob.def.hint && ob.def.hint.btn; }
  // слои поверх кадра (render.frame вызывает их, если заданы в S)
  function worldOverlay(c, pl, now) {
    var W = this.W, MS = W.mission;
    W.flares.forEach(function (f) { var k = f.t / f.max; c.strokeStyle = pl.warn; c.lineWidth = 2; c.globalAlpha = 0.25 + 0.5 * k; c.setLineDash([6, 5]); c.beginPath(); c.arc(f.x * T, f.y * T, f.r * T * (0.96 + 0.04 * Math.sin(now * 6)), 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = pl.warn; c.beginPath(); c.arc(f.x * T, f.y * T, 4 + 2 * Math.sin(now * 10), 0, 7); c.fill(); c.globalAlpha = 1; });
    // подсказка цели: круг (или несколько — развилка), у зоны может быть подпись zone.label {ru,en}
    var zs = hintZone(W); if (zs && !Array.isArray(zs)) zs = [zs];
    (zs || []).forEach(function (z) {
      var zd = MS.def.zones[z], p = C.zoneCenter(MS, z), r = (zd.r || Math.max(zd.w || 3, zd.h || 3) / 2) * T; c.strokeStyle = pl.warn; c.lineWidth = 2; c.globalAlpha = 0.55 + 0.3 * Math.sin(now * 4); c.setLineDash([8, 7]); c.lineDashOffset = -now * 20; c.beginPath(); c.arc(p.x * T, p.y * T, r, 0, 7); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0; c.globalAlpha = 1;
      if (zd.label) { var lt = tx(zd.label); c.font = '800 13px ' + pl.font; var lw = c.measureText(lt).width + 14; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(p.x * T - lw / 2, p.y * T - r - 24, lw, 19); R.txt(c, lt, p.x * T, p.y * T - r - 10, { color: pl.warn, font: pl.font, size: 13, weight: 800, align: 'center' }); }
    });
  }
  function viewOverlay(c, pl, now) {
    var MS = this.W.mission, VW = LY.W, VH = LY.VIEW_H;
    if (MS.night) {
      if (pl.pixel) { c.fillStyle = 'rgba(0,0,40,0.35)'; c.fillRect(0, 0, VW, VH); c.fillStyle = '#000'; for (var y = 0; y < VH; y += 4) for (var x = (y / 4) % 2 * 2; x < VW; x += 8) c.fillRect(x, y, 2, 2); }
      else { c.fillStyle = 'rgba(8,14,40,0.40)'; c.fillRect(0, 0, VW, VH); }
    }
    if (MS.weather && MS.weather.kind === 'snowstorm') {
      var s = MS.storm, n = Math.round(70 + 230 * s);
      c.fillStyle = pl.pixel ? 'rgba(255,255,255,' + (0.04 + 0.12 * s).toFixed(3) + ')' : 'rgba(232,238,245,' + (0.06 + 0.24 * s).toFixed(3) + ')'; c.fillRect(0, 0, VW, VH);
      c.fillStyle = '#ffffff';
      for (var i = 0; i < n; i++) {
        var sp = 140 + (i * 37 % 120), fx = ((i * 97.3 + now * sp * (1.2 + s)) % (VW + 40)) - 20, fy = ((i * 53.1 + now * sp * 0.55) % (VH + 20)) - 10, sz = 1 + (i % 3);
        c.globalAlpha = 0.45 + 0.4 * ((i % 5) / 5);
        if (pl.pixel) c.fillRect(fx | 0, fy | 0, 2, 2); else { c.beginPath(); c.ellipse(fx, fy, sz + s * 2.5, sz * 0.7, 0.35, 0, 7); c.fill(); }
      }
      c.globalAlpha = 1;
    }
  }
  function hudOverlay(c, pl, now) {
    var S = this, W = S.W, MS = W.mission, f = pl.font;
    // цели
    var rows = MS.objs.filter(function (o) { return o.state === 'active' || o.state === 'done'; });
    var done = rows.filter(function (o) { return o.state === 'done'; }); if (done.length > 2) rows = rows.filter(function (o) { return o.state !== 'done' || done.indexOf(o) >= done.length - 2; });
    if (rows.length) {
      c.font = '700 13px ' + f; var wMax = 0; rows.forEach(function (o) { wMax = Math.max(wMax, c.measureText(objLabel(W, o)).width); });
      var bx = 8, by = 30, bw = wMax + 48, bh = 22 + rows.length * 20;
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.fillRect(bx, by, bw, bh);
      R.txt(c, g.t('objectives').toUpperCase(), bx + 8, by + 14, { color: pl.muted, font: f, size: 10, weight: 800 });
      rows.forEach(function (o, i) {
        var y = by + 32 + i * 20, d = o.state === 'done';
        c.globalAlpha = d ? 0.55 : 1; icon(c, o.def.icon, bx + 6, y - 13, 16, pl);
        R.txt(c, (o.def.kind === 'opt' ? '◇ ' : '') + objLabel(W, o), bx + 28, y, { color: d ? pl.good : o.def.kind === 'opt' ? pl.warn : pl.ink, font: f, size: 13, weight: 700 });
        if (d) { c.strokeStyle = pl.good; c.lineWidth = 2; c.beginPath(); c.moveTo(bw - 8, y - 6); c.lineTo(bw - 4, y - 2); c.lineTo(bw + 4, y - 11); c.stroke(); }
        c.globalAlpha = 1;
      });
    }
    // реплика героя
    if (S.say) {
      var line = tx(S.say.text), name = S.say.who === 'foe' ? g.t('foeVoice') : g.t(S.say.who), a = Math.min(1, S.say.life * 2);
      c.font = '600 14px ' + f; var tw = Math.min(700, Math.max(c.measureText(line).width, 160)), lines = wrap(c, line, 700, 14, 600);
      var dw = Math.min(760, tw + 84), dh = 30 + lines.length * 18, dx = LY.W / 2 - dw / 2, dy = LY.VIEW_H - 40 - dh;
      c.globalAlpha = a; c.fillStyle = 'rgba(0,0,0,0.72)'; c.fillRect(dx, dy, dw, dh); c.fillStyle = pl.own[(WHO[S.say.who] || WHO.foe).col]; c.fillRect(dx, dy, 3, dh);
      portrait(c, S.say.who, dx + 30, dy + dh / 2, 18);
      R.txt(c, name, dx + 58, dy + 18, { color: pl.own[(WHO[S.say.who] || WHO.foe).col], font: f, size: 12, weight: 800 });
      lines.forEach(function (ln, k) { R.txt(c, ln, dx + 58, dy + 36 + k * 18, { color: pl.ink, font: f, size: 14, weight: 600 }); });
      c.globalAlpha = 1;
    }
    // подсветка нужной кнопки (обучение)
    var hb = hintBtn(W);
    if (hb) R.BTNS.forEach(function (b) { if (b.type === hb && !(W.players[0].build && b.kind === 'bld' && !W.players[0].build.ready)) { c.strokeStyle = pl.warn; c.lineWidth = 3; c.globalAlpha = 0.5 + 0.5 * Math.sin(now * 6); c.strokeRect(b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3); c.globalAlpha = 1; } });
    // кнопки способностей
    abilityButtons(W).forEach(function (b) {
      var u = heroUnit(W, b.ab.hero), cd = u ? u.abT || 0 : 0, hd = L.HEROES[b.ab.hero], ready = u && cd <= 0, act = S.targeting && b.ab.hero === 'lunya';
      c.fillStyle = act ? pl.ownDk[0] : 'rgba(255,255,255,0.05)'; c.fillRect(b.x, b.y, b.w, b.h);
      if (u && cd > 0) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(b.x, b.y, b.w * (1 - cd / hd.cd), b.h); }
      c.strokeStyle = ready ? pl.own[0] : pl.line; c.lineWidth = 1; c.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      R.txt(c, b.ab.key, b.x + 7, b.y + 16, { color: pl.warn, font: f, size: 12, weight: 900 });
      R.txt(c, g.t(b.ab.label), b.x + 21, b.y + 16, { color: u ? pl.ink : pl.muted, font: f, size: b.w < 120 ? 11 : 12, weight: 700 });
      R.txt(c, !u ? '✕' : ready ? (b.w < 120 ? '✓' : g.t('abReady')) : Math.ceil(cd) + (lang() === 'ru' ? 'с' : 's'), b.x + b.w - 6, b.y + 16, { color: ready ? pl.good : pl.muted, font: f, size: 11, weight: 700, align: 'right' });
    });
  }

  // ---------- установка ----------
  UI.attach = function (S) {
    S.worldOverlay = worldOverlay.bind(S); S.viewOverlay = viewOverlay.bind(S); S.hudOverlay = hudOverlay.bind(S);
    S.btnAllowed = function (b) { return C.allowed(S.W, b.type); };
    S.btnHidden = function (b) { var MS = S.W && S.W.mission; return !!MS && !Object.keys(MS.allow).length; };
    S.noEco = !Object.keys(S.W.mission.allow).length; // без базы — без строки меди и пара
    var def = S.W.mission.def; S.idleTitle = g.t('mission') + ' ' + def.n + ': ' + tx(def.title); S.idleSub = tipHeroes(S.W.mission) || '';
    S.say = null; S.sayQ = []; S.targeting = null; S.stormWas = null; S.lastT = null;
  };
  UI.detach = function (S) { ['worldOverlay', 'viewOverlay', 'hudOverlay', 'btnAllowed', 'btnHidden', 'noEco', 'idleTitle', 'idleSub', 'say', 'targeting'].forEach(function (k) { delete S[k]; }); };
  UI.finish = function (W) {
    var res = W.mission.result || C.result(W); lastRes = res;
    UI.data = C.applyResult(C.load(store), res); persist();
    g.goto('result');
  };
  UI.openBrief = function (id) { briefId = id; g.goto('brief'); };
  UI.install = function (game, h) {
    g = game; host = h;
    try { store = global.localStorage; } catch (e) { store = null; }
    UI.store = store; UI.data = C.load(store);
    g.menu.addItem({ key: 'campaign', after: 'play', label: function () { return g.t('campaign'); }, onSelect: function () { var d = data(); sel = Math.max(0, Math.min(d.unlocked, P.MISSIONS.length) - 1); g.goto('camp'); } });
    var draw = { camp: drawCamp, brief: drawBrief, result: drawResult, edition: drawEdition };
    ['camp', 'brief', 'result', 'edition'].forEach(function (name) {
      g.scene(name, { realtime: true, enter: function () { hover = -1; resetArm = 0; sel2 = 0; UI.data = C.load(store); g.audio.beep(520, 0.05); }, update: function () {}, draw: function (c) { draw[name](c); }, press: sceneKeys(name) });
    });
    g.canvas.addEventListener('pointerdown', function (e) { if (!inScreens()) return; var i = hitAt(pt(e)); if (i >= 0) { e.preventDefault(); var b = hot[i]; if (b.node != null && sel !== b.node) { sel = b.node; g.audio.beep(600, 0.03); return; } g.audio.beep(700, 0.03); b.fn(); } });
    g.canvas.addEventListener('pointermove', function (e) { if (!inScreens()) return; hover = hitAt(pt(e)); g.canvas.style.cursor = hover >= 0 ? 'pointer' : 'default'; });
    return UI;
  };
  UI._test = { missionList: missionList, nodeState: nodeState, nodes: NODES, hot: function () { return hot; } };
})(window);
