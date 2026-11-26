/* ПРИИСК · js/campaign-ui.js — экраны и интерфейс кампании поверх движка Гефест Arcade:
   карта кампании (сцена 'camp'), брифинг ('brief': мини-карта + пиктограммы целей + 1–2 фразы), итог ('result': звёзды, время,
   потери, флаги, «Далее»), а в бою — цели, реплики героев, кнопки способностей (Q/E), подсказки обучения, ночь и метель.
   Логика миссий — в campaign.js (без DOM); здесь только рисование, ввод и сохранение прогресса в localStorage.
   Издание (js/edition.js): в демо играбельна только миссия 1, остальные узлы карты — под замком «В полной версии»,
   после победы в миссии 1 — экран 'edition' «Продолжение — в полной версии». Файлы миссий подключает js/missions/index.js. */
(function (global) {
  'use strict';
  var P = global.PRIISK, L = P.logic, C = P.campaign, R = P.render, LY = R.LAYOUT, T = R.TILE, E = P.Edition, KU = global.HefestCampaignUI;   // KU — общий кит экранов кампании (_shared/)
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
  // «Долг перевала» (Артель Сизого Перевала): путь с перевала на северо-востоке вниз, на плато; миссии 6–9 — заготовки «в работе»
  var LATER_S = [
    { n: 1, ru: 'Пустой рудник', en: 'The Empty Mine' }, { n: 2, ru: 'Долговая расписка', en: 'The Promissory Note' },
    { n: 3, ru: 'Тропа на плато', en: 'Trail to the Plateau' }, { n: 4, ru: 'Ночная проверка', en: 'The Night Probe' },
    { n: 5, ru: 'Ветер с перевала', en: 'Wind off the Pass' }, { n: 6, ru: 'Горящий рудник', en: 'The Burning Mine' },
    { n: 7, ru: 'Заводчик', en: 'The Foundryman' }, { n: 8, ru: 'Канатка над пропастью', en: 'Cableway over the Abyss' },
    { n: 9, ru: 'Последний перевал', en: 'The Last Pass' }];
  var NODES_S = [[566, 118], [492, 176], [418, 128], [350, 196], [282, 252], [370, 300], [470, 330], [380, 420], [252, 396]];
  var camp = 'copper', campBack = 'copper'; // какая кампания открыта: 'copper' | 'sizye' | 'both' (эпилог — только брифинг/итог, на карте — вкладка, откуда пришли)
  // эпилог «Общий посёлок» (миссия с camp 'both'): узел-отметка на карте кампаний, когда пройдены обе и выбор в них совместим
  var EP_NODE = [560, 448];
  function nodes() { return camp === 'sizye' ? NODES_S : NODES; }
  function setCamp(k) {
    k = k === 'sizye' || k === 'both' ? k : 'copper'; if (k === camp || (k !== 'both' && E.hidden && !missionList(k).length)) return;
    if (camp !== 'both') campBack = camp; camp = k; UI.camp = k; UI.data = C.load(store, k); if (k !== 'both') sel = 0;
  }
  function backFromBoth() { if (camp === 'both') { camp = campBack; UI.camp = camp; } }
  function epi() { var d = C.epilogue && C.epilogue(); return d && E.playable(P.EDITION, d.id) ? d : null; }
  function epiState() { var d = epi(); return d ? C.epilogueState(d) : null; }
  var WHO = { varvara: { col: 0, letter: { ru: 'В', en: 'V' } }, lunya: { col: 0, letter: { ru: 'Л', en: 'L' } }, sava: { col: 0, letter: { ru: 'С', en: 'S' } },
    korney: { col: 1, letter: { ru: 'К', en: 'K' } }, foe: { col: 1, letter: { ru: 'С', en: 'G' } }, zavod: { col: 3, letter: { ru: 'З', en: 'M' } },
    agafya: { col: 1, letter: { ru: 'А', en: 'A' } }, mityay: { col: 1, letter: { ru: 'М', en: 'M' } }, foeC: { col: 0, letter: { ru: 'М', en: 'C' } }, post: { col: 2, letter: { ru: 'П', en: 'P' } } };

  function lang() { return g.i18n.lang; }
  function tx(o) { return C.txt(o, lang()); }
  function pal() { return R.PAL[g.themeName === 'retro' ? 'retro' : 'modern']; }
  function th() { return g.themeName === 'retro' ? 'retro' : 'modern'; }
  function font() { return pal().font; }
  function text(c, s, x, y, o) { o = o || {}; R.txt(c, s, x, y, { color: o.color || pal().ink, font: font(), size: o.size || 13, weight: o.weight || 700, align: o.align, base: o.base }); }
  function wrap(c, s, maxW, size, weight) { return KU.wrap(c, s, maxW, size, weight, font()); }
  function fmtTime(s) { return KU.fmtTime(s); }
  function data() { return UI.data; }
  function persist() { C.save(store, UI.data); }
  function lockText() { return camp === 'sizye' ? 'lockedFullSubS' : 'lockedFullSub'; }

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
    else if (kind === 'geyser') { c.fillStyle = pl.rockLo; c.beginPath(); c.ellipse(12, 19, 8, 3, 0, 0, 7); c.fill(); c.fillStyle = '#eef3f6'; [[12, 13, 4], [9, 8, 3.5], [14, 5, 3]].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], q[2], 0, 7); c.fill(); }); }
    else if (kind === 'charge') { c.fillStyle = pl.roof; c.fillRect(5, 9, 14, 11); c.fillStyle = pl.bad; c.fillRect(7, 11, 10, 3); c.strokeStyle = pl.warn; c.beginPath(); c.moveTo(12, 9); c.quadraticCurveTo(14, 4, 19, 3); c.stroke(); }
    else if (kind === 'pit') { c.fillStyle = '#ff7a2e'; c.beginPath(); c.ellipse(12, 13, 10, 7, 0, 0, 7); c.fill(); c.fillStyle = '#1c1512'; c.beginPath(); c.ellipse(12, 13, 7.5, 5, 0, 0, 7); c.fill(); }
    else if (kind === 'fire') { c.fillStyle = pl.bad; c.beginPath(); c.moveTo(5, 20); c.quadraticCurveTo(2, 11, 9, 8); c.quadraticCurveTo(9, 3, 13, 2); c.quadraticCurveTo(13, 8, 18, 10); c.quadraticCurveTo(22, 15, 18, 20); c.closePath(); c.fill(); c.fillStyle = pl.warn; c.beginPath(); c.moveTo(9, 20); c.quadraticCurveTo(8, 14, 12, 11); c.quadraticCurveTo(16, 15, 15, 20); c.closePath(); c.fill(); }
    else if (kind === 'water') { c.fillStyle = pl.waterHi; c.beginPath(); c.moveTo(12, 2); c.quadraticCurveTo(20, 12, 19, 16); c.arc(12, 15, 7, 0.1, Math.PI - 0.1); c.quadraticCurveTo(4, 12, 12, 2); c.fill(); c.fillStyle = pl.panel; c.fillRect(9, 15, 2, 4); }
    else if (kind === 'ally') { c.fillStyle = pl.own[0]; c.beginPath(); c.arc(8, 9, 5, 0, 7); c.fill(); c.fillStyle = pl.own[1]; c.beginPath(); c.arc(16, 9, 5, 0, 7); c.fill(); c.strokeStyle = pl.good; c.lineWidth = 3; c.beginPath(); c.moveTo(4, 19); c.lineTo(20, 19); c.stroke(); }
    else if (kind === 'boss') { c.fillStyle = pl.tread; c.fillRect(2, 5, 17, 3); c.fillRect(2, 17, 17, 3); c.fillStyle = pl.metal; c.fillRect(4, 8, 13, 9); c.fillStyle = pl.metalHi; c.beginPath(); c.moveTo(17, 7); c.lineTo(23, 12.5); c.lineTo(17, 18); c.closePath(); c.fill(); c.fillStyle = pl.glow; c.beginPath(); c.arc(10, 12.5, 2.6, 0, 7); c.fill(); }
    else if (kind === 'lift') { c.strokeStyle = pl.metalHi; c.lineWidth = 2.5; c.strokeRect(4, 6, 16, 16); c.fillStyle = pl.roofHi; c.fillRect(7, 11, 10, 9); c.strokeStyle = pl.ink; c.lineWidth = 1.5; c.beginPath(); c.moveTo(12, 1); c.lineTo(12, 11); c.moveTo(10, 14); c.lineTo(10, 19); c.moveTo(14, 14); c.lineTo(14, 19); c.stroke(); }
    else if (kind === 'lamp') { c.fillStyle = pl.warn; c.globalAlpha = 0.35; c.beginPath(); c.arc(12, 10, 9, 0, 7); c.fill(); c.globalAlpha = 1; c.fillStyle = pl.metalHi; c.fillRect(11, 14, 2, 8); c.fillRect(8, 21, 8, 2); c.fillStyle = pl.warn; c.fillRect(8, 5, 8, 9); c.fillStyle = pl.metal; c.fillRect(7, 3, 10, 2); }
    else if (kind === 'heart') { c.fillStyle = pl.ore; c.beginPath(); c.moveTo(12, 2); c.lineTo(21, 9); c.lineTo(17, 21); c.lineTo(7, 21); c.lineTo(3, 9); c.closePath(); c.fill(); c.fillStyle = pl.oreHi; c.beginPath(); c.moveTo(12, 5); c.lineTo(17, 10); c.lineTo(12, 16); c.lineTo(8, 10); c.closePath(); c.fill(); c.fillStyle = pl.glow; c.fillRect(11, 9, 2, 3); }
    else if (kind === 'exit') { c.strokeStyle = pl.good; c.lineWidth = 3; c.beginPath(); c.moveTo(12, 21); c.lineTo(12, 5); c.moveTo(5, 11); c.lineTo(12, 4); c.lineTo(19, 11); c.stroke(); }
    else if (kind === 'blast') { c.fillStyle = pl.roof; c.fillRect(5, 11, 14, 10); c.fillStyle = pl.metalHi; c.fillRect(11, 3, 2, 9); c.fillRect(7, 2, 10, 3); c.fillStyle = pl.bad; c.fillRect(8, 14, 8, 3); }
    else if (kind === 'van') { c.fillStyle = pl.ownDk[0]; c.fillRect(2, 8, 20, 10); c.fillStyle = pl.wall; c.fillRect(4, 10, 16, 6); c.fillStyle = pl.roof; c.beginPath(); c.moveTo(7, 15); c.lineTo(12, 10); c.lineTo(17, 15); c.closePath(); c.fill(); c.fillStyle = pl.tread; c.fillRect(3, 18, 6, 3); c.fillRect(15, 18, 6, 3); }
    c.restore();
  }
  function star(c, x, y, r, filled, pl) {
    pl = pl || pal(); KU.starPath(c, x, y, r); if (filled) { c.fillStyle = pl.warn; c.fill(); } c.strokeStyle = filled ? pl.ownDk[0] : pl.muted; c.lineWidth = 1.5; c.stroke();
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
  function inScreens() { return g._sceneName === 'camp' || g._sceneName === 'brief' || g._sceneName === 'result' || g._sceneName === 'edition' || g._sceneName === 'finale'; }

  // ---------- карта кампании ----------
  function missionList(k) {
    k = k || camp;
    var out = C.list(k).filter(function (m) { return E.playable(P.EDITION, m.id); }).map(function (m) { return { n: m.n, id: m.id, def: m, title: m.title }; });
    if (k === 'both') return out;
    (k === 'sizye' ? LATER_S : LATER).forEach(function (l) {
      if (out.some(function (m) { return m.n === l.n; })) return;
      // издание «для площадок» (arcade-full/platform): узлы без файла и закрытые без возможности покупки не показываются (E.hidden)
      if (E.hidden && E.hidden(k, l.n, C.list(k).some(function (m) { return m.n === l.n; }))) return;
      out.push({ n: l.n, id: null, def: null, title: { ru: l.ru, en: l.en } });
    });
    return out.sort(function (a, b) { return a.n - b.n; });
  }
  // закрытое в издании открывается покупкой внутри площадки (E.canBuy/E.buy — издание «для площадок»), иначе — ссылка «Узнать больше»
  // E.more(g) — необязательный хук издания вне сайта (своя страница игры через мост обёртки, без ссылок и цен); на сайте его нет
  function offerLabel() { if (E.more) return g.t('more'); if (E.canBuy && E.canBuy()) { var pr = E.price ? E.price() : ''; return g.t('more') + (pr ? ' · ' + pr : ''); } return g.t('more') + ' ↗'; }
  function offerGo() {
    if (E.more) { E.more(g); return; }
    if (!(E.canBuy && E.canBuy())) { openMore(); return; }
    E.buy(g).then(function (ok) { g.audio.beep(ok ? 1000 : 200, ok ? 0.15 : 0.06, 'triangle'); if (ok) g.goto('camp'); });
  }
  function nodeState(m) { if (m.ep) return m.state.done ? 'done' : 'open'; var d = data(); if (!m.def) return 'later'; if (d.missions[m.id]) return 'done'; return m.n <= d.unlocked ? 'open' : 'closed'; }
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
  // перевал Сизых на северо-востоке: скальные зубцы, посёлок, нитка канатки
  function drawPass(c, pl) {
    var x0 = 30, y0 = 78; c.save(); c.beginPath(); c.rect(x0, y0, 590, 420); c.clip();
    c.fillStyle = pl.pixel ? '#555555' : 'rgba(120,112,150,0.35)'; c.beginPath(); c.moveTo(x0 + 430, y0); c.lineTo(x0 + 590, y0); c.lineTo(x0 + 590, y0 + 120); c.lineTo(x0 + 540, y0 + 70); c.lineTo(x0 + 500, y0 + 95); c.lineTo(x0 + 470, y0 + 40); c.closePath(); c.fill();
    [[548, 22], [570, 46], [520, 30]].forEach(function (h) { c.fillStyle = pl.own[1]; c.fillRect(x0 + h[0], y0 + h[1], 8, 6); c.beginPath(); c.moveTo(x0 + h[0] - 1, y0 + h[1]); c.lineTo(x0 + h[0] + 4, y0 + h[1] - 5); c.lineTo(x0 + h[0] + 9, y0 + h[1]); c.closePath(); c.fill(); });
    c.strokeStyle = pl.ownDk[1]; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0 + 552, y0 + 30); c.quadraticCurveTo(x0 + 500, y0 + 62, x0 + 462, y0 + 52); c.stroke();
    c.restore();
  }
  function drawCamp(c) {
    var pl = pal(), d = data(), ms = missionList(), t = g.time || 0; hot = [];
    var ed = epi(), es = ed && C.epilogueState(ed), epItem = es && (es.open || es.done) ? { n: '★', id: ed.id, def: ed, title: ed.title, ep: true, state: es, save: C.load(store, 'both') } : null;
    var items = epItem ? ms.concat([epItem]) : ms; if (sel >= items.length) sel = 0;
    g.clear();
    var sz = camp === 'sizye', NS = nodes();
    text(c, g.t(sz ? 'campMapS' : 'campMap'), 30, 40, { size: 24, weight: 900, color: sz ? pl.own[1] : g.th().accent });
    text(c, g.t(sz ? 'campSubS' : 'campSub'), 30, 62, { size: 13, weight: 600, color: pl.muted });
    // вкладки кампаний: Медный Ключ / Сизый Перевал
    [['copper', 'campTabC', 0], ['sizye', 'campTabS', 1]].forEach(function (tb, k) {
      if (E.hidden && camp !== tb[0] && !missionList(tb[0]).length) return; // издание «для площадок»: пустая кампания — без вкладки
      var bx = 330 + k * 166, bw = 160, on = camp === tb[0], hi = hot.length;
      hot.push({ x: bx, y: 28, w: bw, h: 30, fn: function () { setCamp(tb[0]); }, tab: tb[0] });
      c.fillStyle = on ? pl.ownDk[tb[2]] : hover === hi ? pl.line : 'rgba(255,255,255,0.04)'; c.fillRect(bx, 28, bw, 30);
      c.strokeStyle = on ? pl.own[tb[2]] : pl.line; c.lineWidth = 1.5; c.strokeRect(bx + 0.5, 28.5, bw - 1, 29);
      c.fillStyle = pl.own[tb[2]]; c.fillRect(bx + 8, 38, 9, 9);
      text(c, g.t(tb[1]), bx + 24, 48, { size: 13, weight: 800, color: on ? pl.ink : pl.muted });
      if (tb[0] === 'sizye' && E.stub(P.EDITION) === 'full' && !C.list('sizye').some(function (m) { return E.playable(P.EDITION, m.id); })) lock(c, bx + bw - 12, 42, pl);
    });
    drawPlateau(c, pl);
    if (sz) drawPass(c, pl);
    // дорога между узлами
    c.strokeStyle = sz ? pl.ownDk[1] : pl.wall; c.lineWidth = 3; c.setLineDash([7, 6]); c.beginPath(); NS.slice(0, ms.length).forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); c.setLineDash([]);
    var oc = sz ? 1 : 0;
    ms.forEach(function (m, i) {
      var p = NS[i] || [0, 0], st = nodeState(m), on = i === sel, r = 17;
      hot.push({ x: p[0] - 22, y: p[1] - 22, w: 44, h: 44, fn: function () { if (sel === i) openBrief(m); sel = i; }, node: i });
      if (on) { c.strokeStyle = sz ? pl.own[1] : g.th().accent; c.lineWidth = 2; c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5); c.beginPath(); c.arc(p[0], p[1], r + 6, 0, 7); c.stroke(); c.globalAlpha = 1; }
      c.fillStyle = st === 'done' ? pl.own[oc] : st === 'open' ? pl.ownDk[oc] : pl.panel; c.beginPath(); c.arc(p[0], p[1], r, 0, 7); c.fill();
      c.strokeStyle = st === 'later' || st === 'closed' ? pl.line : pl.own[oc]; c.lineWidth = 2; c.stroke();
      text(c, String(m.n), p[0], p[1] + 5, { size: 14, weight: 900, align: 'center', color: st === 'done' ? pl.panel : st === 'open' ? pl.ink : pl.muted });
      if (st === 'later' && E.stub(P.EDITION) === 'full') lock(c, p[0] + 12, p[1] - 13, pl);
      if (st === 'done') { var stars = d.missions[m.id].stars || []; for (var k = 0; k < 3; k++) star(c, p[0] - 13 + k * 13, p[1] + r + 9, 5, !!stars[k], pl); }
    });
    // отметка эпилога «Общий посёлок»: двухцветный узел с домом (латунь и сирень), пунктир от финалов обеих кампаний
    if (epItem) {
      var ep = EP_NODE, ei = ms.length, eon = sel === ei, ehot = hot.length;
      hot.push({ x: ep[0] - 24, y: ep[1] - 24, w: 48, h: 48, fn: function () { if (sel === ei) openBrief(epItem); sel = ei; }, node: ei, ep: true });
      var last = NS[ms.length - 1] || NS[NS.length - 1]; // пунктир — от финала открытой кампании
      c.strokeStyle = pl.warn; c.lineWidth = 1.5; c.setLineDash([3, 5]); c.globalAlpha = 0.7; c.beginPath(); c.moveTo(last[0], last[1]); c.quadraticCurveTo((last[0] + ep[0]) / 2 + 30, Math.max(last[1], ep[1]) + 10, ep[0], ep[1]); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      if (eon || hover === ehot) { c.strokeStyle = pl.warn; c.lineWidth = 2; c.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5); c.beginPath(); c.arc(ep[0], ep[1], 26, 0, 7); c.stroke(); c.globalAlpha = 1; }
      c.fillStyle = pl.own[0]; c.beginPath(); c.arc(ep[0], ep[1], 20, Math.PI / 2, Math.PI * 1.5); c.fill(); c.fillStyle = pl.own[1]; c.beginPath(); c.arc(ep[0], ep[1], 20, -Math.PI / 2, Math.PI / 2); c.fill();
      c.strokeStyle = pl.warn; c.lineWidth = 2; c.beginPath(); c.arc(ep[0], ep[1], 20, 0, 7); c.stroke();
      c.fillStyle = pl.panel; c.beginPath(); c.arc(ep[0], ep[1], 12.5, 0, 7); c.fill(); icon(c, 'home', ep[0] - 9, ep[1] - 10, 18, pl);
      if (es.done) { var es3 = (epItem.save.missions[ed.id] || {}).stars || []; for (var k3 = 0; k3 < 3; k3++) star(c, ep[0] - 13 + k3 * 13, ep[1] + 30, 5, !!es3[k3], pl); }
      text(c, tx(ed.title), ep[0], ep[1] - 28, { size: 11, weight: 800, align: 'center', color: pl.warn });
    }
    // карточка выбранной миссии
    var m = items[sel] || items[0], st = nodeState(m), cx = 640, cy = 78, cw = 300;
    if (m.ep) d = m.save; // карточка эпилога: своё сохранение (звёзды, лучшее время)
    c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(cx, cy, cw, 420); c.strokeStyle = pl.line; c.strokeRect(cx + 0.5, cy + 0.5, cw - 1, 419);
    text(c, (m.ep ? g.t('epilogueT') : g.t('mission') + ' ' + m.n).toUpperCase(), cx + 16, cy + 28, { size: 12, color: m.ep ? pl.warn : pl.muted });
    wrap(c, tx(m.title), cw - 32, 20, 900).forEach(function (ln, k) { text(c, ln, cx + 16, cy + 56 + k * 24, { size: 20, weight: 900, color: st === 'later' ? pl.muted : pl.ink }); });
    var y = cy + 92;
    if (m.def) {
      text(c, tx(m.def.kind), cx + 16, y, { size: 12, weight: 600, color: pl.muted }); y += 24;
      var rec = d.missions[m.id];
      for (var k = 0; k < 3; k++) star(c, cx + 26 + k * 26, y, 9, !!(rec && rec.stars[k]), pl);
      if (rec) text(c, g.t('bestTime') + ' ' + fmtTime(rec.time), cx + 112, y + 5, { size: 12, color: pl.muted, weight: 600 });
      y += 28;
      (m.def.objectives || []).forEach(function (o) { if (y > cy + 330 || o.secret) return; /* secret — цель ветки развилки: в брифинге не показываем */ icon(c, o.icon, cx + 16, y - 13, 18, pl); text(c, tx(o.text) + (o.kind === 'opt' ? ' · ' + g.t('optional') : ''), cx + 42, y, { size: 12, weight: 600, color: pl.ink }); y += 24; });
      if (sz && m.def.xcarry && m.def.xnote) { var xf = C.xcarried(m.def), xn = Object.keys(m.def.xnote).filter(function (k) { return xf[k] != null && m.def.xnote[k][xf[k]]; })[0]; if (xn) { y += 4; wrap(c, '◆ ' + g.t('xflag') + ': ' + tx(m.def.xnote[xn][xf[xn]]), cw - 32, 11).forEach(function (ln) { text(c, ln, cx + 16, y, { size: 11, weight: 600, color: pl.own[1] }); y += 16; }); } } // связка кампаний
      if (m.id === 'm2' && d.flags.convoy && m.def.flagText) { y += 4; wrap(c, '◆ ' + tx(m.def.flagText.convoy[d.flags.convoy]), cw - 32, 11).forEach(function (ln) { text(c, ln, cx + 16, y, { size: 11, weight: 600, color: pl.warn }); y += 16; }); }
      if (st === 'closed') text(c, g.t('closed'), cx + 16, cy + 372, { size: 12, color: pl.muted, weight: 600 });
      else button(c, cx + 16, cy + 352, cw - 32, 40, '▶ ' + g.t('brief'), function () { openBrief(m); }, { primary: true });
      if (m.def.finale && rec) button(c, cx + 16, cy + 312, cw - 32, 32, '★ ' + g.t(m.ep ? 'epilogueEnd' : 'finaleT'), function () { if (m.ep) setCamp('both'); finaleId = m.id; g.goto('finale'); }, { size: 13 }); // пройденный финал — итог кампании (эпилог — экран «Общий посёлок»)
    } else if (E.stub(P.EDITION) === 'full') {
      lock(c, cx + 24, y - 5, pl, 1.3); text(c, g.t('lockedFull'), cx + 40, y, { size: 14, color: pl.warn }); y += 24;
      wrap(c, g.t(lockText()), cw - 32, 12).forEach(function (ln) { text(c, ln, cx + 16, y, { size: 12, weight: 600, color: pl.muted }); y += 18; });
      button(c, cx + 16, cy + 352, cw - 32, 40, offerLabel(), offerGo);
    } else {
      text(c, g.t(sz ? 'workS' : 'locked'), cx + 16, y, { size: 13, color: pl.warn }); y += 22;
      wrap(c, g.t(sz ? 'workSubS' : 'lockedSub'), cw - 32, 12).forEach(function (ln) { text(c, ln, cx + 16, y, { size: 12, weight: 600, color: pl.muted }); y += 18; });
    }
    button(c, 30, 506, 150, 28, '← ' + g.t('toMenu'), function () { g.goto('title'); }, { size: 13 });
    button(c, 470, 506, 150, 28, resetArm > t ? g.t('resetSure').slice(0, 18) + '…' : g.t('reset'), function () { if (resetArm > (g.time || 0)) { UI.data = C.reset(store, camp); sel = 0; resetArm = 0; } else resetArm = (g.time || 0) + 3; }, { size: 11 });
    text(c, g.t('campHint'), 640, 524, { size: 10, weight: 600, color: pl.muted });
  }
  function lock(c, x, y, pl, k) {
    k = k || 1; c.save(); c.translate(x, y); c.scale(k, k);
    c.strokeStyle = pl.warn; c.lineWidth = 2; c.beginPath(); c.arc(0, -3, 4, Math.PI, 0); c.lineTo(4, 0); c.moveTo(-4, 0); c.lineTo(-4, -3); c.stroke();
    c.fillStyle = pl.warn; c.fillRect(-6, -1, 12, 9); c.fillStyle = pl.panel; c.fillRect(-1, 2, 2, 3);
    c.restore();
  }
  // новая вкладка (окно с 'noopener' всегда возвращает null — тогда не понять, открылась ли вкладка); не открылась — переход в этой же
  function openMore() { var url = E.MORE_URL, w = null; if (!url) return; /* издание «для площадок» — без ссылок наружу */ try { w = global.open(url, '_blank'); } catch (e) {} if (w) { try { w.opener = null; } catch (e) {} } else location.href = url; }
  function openBrief(m) { if (!m.def || nodeState(m) === 'closed') { g.audio.beep(180, 0.06, 'square'); return; } if (m.ep) setCamp('both'); briefId = m.id; g.goto('brief'); }

  // ---------- брифинг ----------
  function drawMiniMap(c, def, x, y, maxW, maxH, pl) {
    var map = C.parseMap(def.map, def.legend), s = Math.floor(Math.min(maxW / map.w, maxH / map.h) * 10) / 10, gp = R.groundPal({ ground: def.ground }, th(), pl);
    var ox = x + (maxW - map.w * s) / 2, oy = y;
    for (var j = 0; j < map.h; j++) for (var i = 0; i < map.w; i++) {
      var k = j * map.w + i, t = map.t[k];
      c.fillStyle = t === L.ROCK ? (gp.rock || pl.rock) : t === L.WATER ? pl.water : t === L.ICE ? gp.ice : t === L.OPEN ? gp.open : t === L.PIT ? gp.pitHi : t === L.BRIDGE ? pl.roofHi : map.ore[k] ? pl.ore : t === L.SHAKY ? gp.shaky : ((i + j) % 2 ? gp.g1 : gp.g2);
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
    Object.keys(def.lifts || {}).forEach(function (id) { ['a', 'b'].forEach(function (e) { var q = C.pointOf(MS, def.lifts[id][e]); c.fillStyle = '#000'; c.fillRect(ox + q.x * s - 5, oy + q.y * s - 5, 10, 10); c.fillStyle = pl.warn; c.fillRect(ox + q.x * s - 3, oy + q.y * s - 3, 6, 6); }); });
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
    var objs = def.objectives.filter(function (o) { return !o.secret; }), tight = objs.length > 7; // много целей — строки плотнее, чтобы отряд и кнопки не налезали
    objs.forEach(function (o, i) { // secret — цель ветки развилки: в брифинге не показываем
      c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(x, y, 390, tight ? 20 : 28);
      icon(c, o.icon, x + 8, y + (tight ? 2 : 3), tight ? 16 : 22, pl);
      text(c, (o.kind === 'opt' ? '◇ ' : (i + 1) + '. ') + tx(o.text), x + 38, y + (tight ? 15 : 19), { size: tight ? 12 : 13, weight: 700, color: o.kind === 'opt' ? pl.warn : pl.ink });
      y += tight ? 22 : 31;
    });
    y += 12; text(c, g.t('starsT').toUpperCase(), x, y, { size: 12, color: pl.muted }); y += 22;
    var rec = d.missions[def.id], stars = [{ icon: 'flag', text: { ru: g.t('starDone'), en: g.t('starDone') } }].concat(def.stars || []);
    stars.forEach(function (s, i) { star(c, x + 10, y - 4, 8, !!(rec && rec.stars[i]), pl); icon(c, s.icon, x + 26, y - 15, 18, pl); text(c, tx(s.text), x + 52, y, { size: 12, weight: 600 }); y += tight ? 20 : 22; });
    y += tight ? 4 : 10; text(c, g.t('heroesT').toUpperCase(), x, y, { size: 12, color: pl.muted }); y += tight ? 22 : 24;
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
    labels.forEach(function (lb, i) { var x = g.W / 2 + (i - 1) * 190; star(c, x, 200, 26, !!r.stars[i], pl); wrap(c, lb, 176, 12, 700).slice(0, 2).forEach(function (ln, k) { text(c, ln, x, 248 + k * 15, { size: 12, weight: 700, align: 'center', color: r.stars[i] ? pl.ink : pl.muted }); }); });
    var y = 304, rows = [[g.t('resTime'), fmtTime(r.time)], [g.t('resLost'), r.lostU + ' ' + g.t('resUnits') + (r.lostB ? ' · ' + r.lostB + ' ' + g.t('resBlds') : '')], [g.t('resKills'), String(r.kills)]];
    if (r.win && r.vets && r.vets.length) rows.push([g.t('resVets'), String(r.vets.length)]);
    rows.forEach(function (rw) { text(c, rw[0], g.W / 2 - 12, y, { size: 14, weight: 600, align: 'right', color: pl.muted }); text(c, rw[1], g.W / 2 + 12, y, { size: 15, weight: 800 }); y += 26; });
    if (r.win && def.flagText) Object.keys(def.flagText).forEach(function (k) { var v = r.flags[k]; if (v && def.flagText[k][v]) { text(c, '◆ ' + tx(def.flagText[k][v]), g.W / 2, y + 8, { size: 14, weight: 700, align: 'center', color: pl.warn }); y += 24; } });
    var next = r.win && C.list(C.campOf(def)).filter(function (m) { return m.n === def.n + 1 && E.playable(P.EDITION, m.id); })[0];
    var more = missionList().some(function (m) { return m.n > def.n && !m.def; }), after = E.afterWin(P.EDITION, !!next, more);
    var retry = function () { host.startMission(r.id); }, toMap = function () { g.goto('camp'); };
    if (r.win && def.finale) { button(c, g.W / 2 - 250, 456, 240, 44, g.t('next') + ' ▸', function () { finaleId = def.id; g.goto('finale'); }, { primary: true, size: 16 }); button(c, g.W / 2 + 10, 456, 240, 44, g.t('toMap'), toMap); }
    else if (r.win && after !== 'next' && after !== 'map') { /* экран издания (E.afterWin: демо — «в полной версии», площадки — «после покупки») */ button(c, g.W / 2 - 250, 456, 240, 44, g.t('next') + ' ▸', function () { g.goto('edition'); }, { primary: true, size: 16 }); button(c, g.W / 2 + 10, 456, 240, 44, g.t('toMap'), toMap); }
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
    icon(c, fin.items.length > 1 ? 'convoy' : 'flag', cx - 24, y0 + 24, 48, pl);   // экран с кнопкой «дальше» (демо/покупка) — обоз, итог — флаг
    var y = y0 + 112;
    wrap(c, g.t(fin.title), pw - 60, 26, 900).forEach(function (ln) { text(c, ln, cx, y, { size: 26, weight: 900, align: 'center', color: g.th().accent }); y += 32; });
    y += 4; wrap(c, g.t(fin.sub), pw - 90, 15, 600).forEach(function (ln) { text(c, ln, cx, y, { size: 15, weight: 600, align: 'center' }); y += 22; });
    var n = fin.items.length, bw = 240, gap = 20, bx = cx - (n * bw + (n - 1) * gap) / 2;
    fin.items.forEach(function (k, i) {
      // 'toMenu' — экран издания открыт из главного меню (необязательный пункт издания вне сайта); на сайте — только 'toMap'/'more'
      var fn = k === 'more' ? offerGo : k === 'toMenu' ? function () { g.goto('title'); } : function () { g.goto('camp'); };
      button(c, bx + i * (bw + gap), y0 + ph - 70, bw, 44, k === 'more' ? offerLabel() : '← ' + g.t(k === 'toMenu' ? 'toMenu' : 'toMap'), fn, { primary: i === 0, size: 15, focus: sel2 === i });
    });
  }
  var sel2 = 0, finaleId = null;

  // ---------- финал кампании: итог по флагам, звёзды по миссиям, реплики героев (данные — def.finale миссии, см. campaign.js) ----------
  function drawFinale(c) {
    var pl = pal(), def = C.byId(finaleId), F = def && C.finale(def, data()), t = g.time || 0, fc = def && C.campOf(def), oc = fc === 'sizye' ? 1 : 0; hot = []; g.clear();
    if (!F) { button(c, g.W / 2 - 120, 260, 240, 44, '← ' + g.t('toMap'), function () { g.goto('camp'); }, { primary: true }); return; }
    drawPlateau(c, pl); c.fillStyle = pl.pixel ? 'rgba(0,0,0,0.95)' : 'rgba(12,14,18,0.95)'; c.fillRect(0, 0, g.W, g.H); // плато — едва видным фоном
    text(c, (fc === 'both' ? g.t('epilogueT') + ' · ' + g.t('epilogueSub') : g.t('finaleT') + ' · ' + g.t(fc === 'sizye' ? 'campMapS' : 'campMap')).toUpperCase(), 30, 30, { size: 12, color: fc === 'both' ? pl.warn : pl.muted });
    text(c, tx(F.title), 30, 62, { size: 28, weight: 900, color: g.th().accent });
    var y = 84; wrap(c, tx(F.sub), 900, 14, 600).slice(0, 2).forEach(function (ln) { text(c, ln, 30, y, { size: 14, weight: 600, color: pl.ink }); y += 19; });
    // слева: решения и звёзды
    var x = 30, cw = 430; y = 138;
    text(c, g.t(fc === 'both' ? 'finaleChoicesB' : 'finaleChoices').toUpperCase(), x, y, { size: 11, color: pl.muted }); y += 8;
    F.rows.forEach(function (r) {
      var lines = wrap(c, tx(r.text), cw - 52, 12, 600).slice(0, 3), h = Math.max(34, 12 + lines.length * 15);
      var rc = r.camp === 'sizye' ? 1 : r.camp === 'copper' ? 0 : oc; // в эпилоге решения обеих кампаний — каждое своим цветом
      c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(x, y, cw, h); c.fillStyle = pl.ownDk[rc]; c.beginPath(); c.arc(x + 20, y + h / 2, 12, 0, 7); c.fill();
      text(c, String(r.n), x + 20, y + h / 2 + 5, { size: 13, weight: 900, align: 'center', color: pl.ink });
      lines.forEach(function (ln, k) { text(c, ln, x + 42, y + 20 + k * 15 - (lines.length > 1 ? 4 : 0) + (lines.length === 1 ? 1 : 0), { size: 12, weight: 600, color: pl.ink }); });
      y += h + 5;
    });
    y += 14; text(c, g.t('starsT').toUpperCase() + ' · ' + F.total + ' / ' + F.max, x, y, { size: 11, color: pl.muted });
    if (F.totals && F.totals.length) { var tl = F.totals.map(function (q) { return g.t(q.camp === 'sizye' ? 'campTabS' : 'campTabC') + ' ★ ' + q.total + ' / ' + q.max; }).join('   ·   '); text(c, tl, x + 150, y, { size: 11, weight: 700, color: pl.oreHi }); }
    y += 12;
    F.stars.forEach(function (m, i) {
      var cx2 = x + (i % 5) * 86, cy2 = y + Math.floor(i / 5) * 30;
      c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(cx2, cy2, 82, 26);
      text(c, String(m.n), cx2 + 14, cy2 + 18, { size: 12, weight: 900, align: 'center', color: m.done ? pl.ink : pl.muted });
      for (var k = 0; k < 3; k++) star(c, cx2 + 34 + k * 17, cy2 + 13, 6.5, m.stars[k], pl);
    });
    // справа: реплики
    var qx = 492, qw = 438, qy = 138;
    text(c, g.t('finaleVoices').toUpperCase(), qx, qy, { size: 11, color: pl.muted }); qy += 8;
    F.quotes.forEach(function (q) {
      var lines = wrap(c, tx(q.text), qw - 62, 13, 600).slice(0, 4), h = Math.max(48, 30 + lines.length * 16), col = (WHO[q.who] || WHO.foe).col;
      if (qy + h > 452) return;
      c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(qx, qy, qw, h); c.fillStyle = pl.own[col]; c.fillRect(qx, qy, 3, h);
      portrait(c, q.who, qx + 28, qy + 26, 16);
      text(c, g.t(q.who), qx + 54, qy + 18, { size: 11, weight: 800, color: pl.own[col] });
      lines.forEach(function (ln, k) { text(c, ln, qx + 54, qy + 35 + k * 16, { size: 13, weight: 600 }); });
      qy += h + 6;
    });
    // эпилог «Общий посёлок»: после финала второй кампании (флаги обеих совместимы) — кнопка; совместимо, но вторая не пройдена — подсказка
    var ed = fc !== 'both' && epi(), es = ed && C.epilogueState(ed), mine = es && es.camps[fc], other = es && es.camps[fc === 'sizye' ? 'copper' : 'sizye'];
    var note = F.note ? tx(F.note) : null; if (es && !es.open && mine && mine.match && other && !other.done) note = g.t('epilogueHint');
    if (note) { c.globalAlpha = 0.75 + 0.25 * Math.sin(t * 2); text(c, note, 30, 478, { size: 13, weight: 800, color: pl.warn }); c.globalAlpha = 1; }
    var bi = 0;
    if (es && es.open) { button(c, 30, 492, 280, 36, '★ ' + tx(ed.title) + ' ▸', function () { setCamp('both'); briefId = ed.id; g.goto('brief'); }, { primary: true, size: 14, focus: sel2 === bi++ }); }
    var bx0 = es && es.open ? 320 : 30;
    button(c, bx0, 492, 200, 36, '← ' + g.t('toMap'), function () { g.goto('camp'); }, { primary: !(es && es.open), size: 14, focus: sel2 === bi++ });
    button(c, bx0 + 210, 492, 150, 36, g.t('toMenu'), function () { g.goto('title'); }, { size: 13, focus: sel2 === bi++ });
  }

  // ---------- ввод на экранах ----------
  function sceneKeys(name) {
    return function (a) {
      if (name === 'camp') {
        var es0 = epiState(), epOn = es0 && (es0.open || es0.done), n = missionList().length + (epOn ? 1 : 0);
        if (a === 'right' || a === 'down') { sel = (sel + 1) % n; g.audio.beep(600, 0.03); }
        else if (a === 'left' || a === 'up') { sel = (sel - 1 + n) % n; g.audio.beep(600, 0.03); }
        else if (a === 'start' || a === 'action') { if (epOn && sel === n - 1) { var eh = hot.filter(function (h) { return h.ep; })[0]; if (eh) eh.fn(); } else openBrief(missionList()[sel]); }
        else if (a === 'pause') g.goto('title');
      } else if (name === 'brief') {
        if (a === 'start' || a === 'action') host.startMission(briefId);
        else if (a === 'pause') g.goto('camp');
      } else if (name === 'edition') {
        var nb = E.finale(P.EDITION).items.length;
        if (a === 'right' || a === 'down') { sel2 = (sel2 + 1) % nb; g.audio.beep(600, 0.03); }
        else if (a === 'left' || a === 'up') { sel2 = (sel2 - 1 + nb) % nb; g.audio.beep(600, 0.03); }
        else if (a === 'start' || a === 'action') { if (hot[sel2]) hot[sel2].fn(); }
        else if (a === 'pause') g.goto(E.finale(P.EDITION).items.indexOf('toMenu') >= 0 ? 'title' : 'camp');
      } else if (name === 'finale') {
        var nf = Math.max(1, hot.length);
        if (a === 'right' || a === 'down') { sel2 = (sel2 + 1) % nf; g.audio.beep(600, 0.03); } else if (a === 'left' || a === 'up') { sel2 = (sel2 - 1 + nf) % nf; g.audio.beep(600, 0.03); }
        else if (a === 'start' || a === 'action') { if (hot[sel2]) hot[sel2].fn(); else g.goto('camp'); }
        else if (a === 'pause') g.goto('camp');
      } else if (name === 'result') {
        if (a === 'start' || a === 'action') { if (hot[0]) hot[0].fn(); }
        else if (a === 'pause') g.goto('camp');
      }
    };
  }

  // ---------- в бою ----------
  function heroUnit(W, type) { var MS = W.mission, id = MS && MS.heroes[type], u = id && W.byId[id]; return u && u.hp > 0 ? u : null; }
  var AB = [{ hero: 'varvara', key: 'Q', label: 'abCry' }, { hero: 'lunya', key: 'E', label: 'abFlare' }, { hero: 'sava', key: 'R', label: 'abFix' },
    { hero: 'korney', key: 'Q', label: 'abRage' }, { hero: 'mityay', key: 'E', label: 'abTalk' }, { hero: 'agafya', key: 'R', label: 'abCable' }];
  var AB_KEYS = { KeyQ: 'korney', KeyE: 'mityay', KeyR: 'agafya' }; // клавиши героев Сизых (Медного Ключа — в main.js)
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
    if (hero === 'agafya') { S.targeting = { hero: 'agafya' }; host.msg(g.t('tipCable')); g.audio.beep(760, 0.04); return true; }
    var r = L.ability(W, u);
    if (r === 'ok') { g.audio.beep(520, 0.12, 'square'); g.audio.beep(780, 0.14, 'triangle'); return true; }
    if (r === 'far' && hero === 'mityay') { host.msg(g.t('msgNoPost'), 'warn'); g.audio.beep(180, 0.06, 'square'); }
    return false;
  };
  UI.placeFlare = function (S, w) {
    if (S.targeting && S.targeting.hero === 'agafya') { // Агафья: куда ехать по канату
      var ua = heroUnit(S.W, 'agafya'); S.targeting = null; if (!ua) return;
      var ra = L.ability(S.W, ua, w.x, w.y);
      if (ra === 'ok') { g.audio.beep(330, 0.1, 'triangle'); g.audio.beep(495, 0.14, 'triangle'); S.marks.push({ x: w.x, y: w.y, kind: 'move', life: 0.6 }); }
      else { host.msg(g.t(ra === 'nonode' ? 'msgNoNode' : 'msgNoLink'), 'bad'); g.audio.beep(150, 0.08, 'square'); }
      return;
    }
    var W = S.W, u = heroUnit(W, 'lunya'); S.targeting = null; if (!u) return;
    var r = L.ability(W, u, w.x, w.y);
    if (r === 'ok') { g.audio.beep(1200, 0.08, 'triangle'); g.audio.beep(900, 0.12, 'sine'); S.marks.push({ x: w.x, y: w.y, kind: 'harvest', life: 0.6 }); }
    else if (r === 'far') { host.msg(g.t('msgFar'), 'bad'); g.audio.beep(150, 0.08, 'square'); }
  };
  // реплики живут по игровому времени; устаревшие в очереди (старше 12 с) выбрасываются
  function sayLine(S, e) { S.say = { who: e.who, text: e.text, life: e.life || 5.5 }; g.audio.beep(e.who === 'foe' || e.who === 'foeC' ? 260 : 620, 0.05, 'triangle'); }
  // события миссии → реплики, сообщения, звук
  UI.drain = function (S) {
    var W = S.W, MS = W.mission; if (!MS) return;
    MS.ui.forEach(function (e) {
      if (e.t === 'say') { e.at = W.time; if (S.say && S.say.life > 1.2) S.sayQ.push(e); else sayLine(S, e); }
      else if (e.t === 'msg') host.msg(tx(e.text), e.col);
      else if (e.t === 'obj') { var o = MS.byObj[e.id]; if (e.state === 'done') { host.msg('✓ ' + g.t('msgObjDone') + ': ' + tx(o.def.text), 'good'); g.audio.beep(880, 0.07, 'triangle'); g.audio.beep(1320, 0.1, 'triangle'); } else if (e.state === 'active' && W.time > 1) { host.msg(g.t('msgObj') + ': ' + tx(o.def.text), 'warn'); g.audio.beep(660, 0.06); } }
      else if (e.t === 'heroDown') host.msg(g.t(e.who) + ' — ' + g.t('msgHeroDown'), 'bad');
      else if (e.t === 'night') host.msg(g.t('msgNight'), 'warn');
      else if (e.t === 'quake') { host.msg(g.t('msgQuake'), 'bad'); g.audio.beep(70, 0.6, 'sawtooth', 0.1); }
      else if (e.t === 'creak') host.msg(g.t(e.type) + ' ' + g.t('msgCreak'), 'warn');
      else if (e.t === 'geyserWarn') { var gz = MS.geys[e.id], gp2 = gz && C.pointOf(MS, gz.def.at); if (gp2 && W.units.some(function (u) { return u.owner === 0 && Math.hypot(u.x - gp2.x, u.y - gp2.y) < (gz.def.r || 2.2) + 1.5; })) host.msg(g.t('msgGeyser'), 'warn'); }
      else if (e.t === 'part') { host.msg(g.t('msgPart_' + e.k) + (e.left ? '' : ' — ' + g.t('msgBossDown')), 'good'); g.audio.beep(140, 0.3, 'sawtooth', 0.1); g.audio.beep(660, 0.1, 'triangle'); }
      else if (e.t === 'scald') { host.msg(g.t('msgScald'), 'good'); g.audio.beep(90, 0.6, 'sawtooth', 0.08); }
      else if (e.t === 'lamp') { host.msg(g.t('msgLamp')); g.audio.beep(980, 0.05, 'triangle'); }
      else if (e.t === 'site') { var sd = MS.sites[e.id]; host.msg((sd && sd.def.doneText ? tx(sd.def.doneText) : g.t('msgSite')), 'good'); g.audio.beep(300, 0.06, 'square'); g.audio.beep(520, 0.08, 'triangle'); }
      else if (e.t === 'talked') { host.msg(g.t('msgTalked'), 'good'); g.audio.beep(660, 0.08, 'triangle'); g.audio.beep(880, 0.1, 'triangle'); }
      else if (e.t === 'talkFail') { host.msg(g.t('msgTalkFail'), 'bad'); g.audio.beep(200, 0.1, 'square'); }
      else if (e.t === 'carFall') { host.msg(g.t(e.shot ? 'msgCarShot' : 'msgCarFall'), 'bad'); g.audio.beep(120, 0.25, 'sawtooth', 0.08); }
      else if (e.t === 'cutWarn') { host.msg(g.t('msgCutWarn'), 'bad'); g.audio.beep(90, 0.4, 'sawtooth', 0.08); }
      else if (e.t === 'cut') { host.msg(g.t('msgCut'), 'bad'); g.audio.beep(70, 0.5, 'sawtooth', 0.1); }
      else if (e.t === 'spliced') { host.msg(g.t('msgSpliced'), 'good'); g.audio.beep(520, 0.08, 'triangle'); g.audio.beep(780, 0.1, 'triangle'); }
      else if (e.t === 'scouted' && MS.def.scoutMsg) { host.msg(g.t('msgScouted') + ': ' + g.t(e.type), 'good'); g.audio.beep(760, 0.05, 'triangle'); }
      else if (e.t === 'wind') host.msg(g.t('msgWindShift') + ' · ' + g.t('steamS') + ' ' + Math.round(W.wind.s * 100) + '%', 'warn');
      else if (e.t === 'halt' && MS.groups[e.tag] && MS.groups[e.tag].owner === 0) host.msg(g.t(e.on ? 'msgHalt' : 'msgGo'), e.on ? 'warn' : 'good');
    });
    MS.ui.length = 0;
    // метель: волна сильнее / слабее
    if (MS.weather) { var hi = MS.storm > 0.75, lo = MS.storm < 0.25; if (hi && S.stormWas !== 'hi') { if (S.stormWas) host.msg(g.t('msgStormUp'), 'warn'); S.stormWas = 'hi'; } else if (lo && S.stormWas !== 'lo') { if (S.stormWas) host.msg(g.t('msgStormDown')); S.stormWas = 'lo'; } }
    W.events.forEach(function (ev) { if (ev.t === 'faceDry' && ev.owner === 0) host.msg(g.t('msgFaceDry'), 'warn'); if (ev.t === 'cableIn' && ev.owner === 0 && ev.id === (MS.heroes.agafya || -1)) host.msg(g.t('msgCableIn'), 'good'); });
    W.events.forEach(function (ev) { if (ev.t === 'vet' && ev.owner === 0) host.msg(g.t('msgVet') + ': ' + g.t(W.byId[ev.id] ? W.byId[ev.id].type : 'rifleman'), 'good'); });
  };
  UI.update = function (S) {
    var W = S.W, now = W.time, d = S.lastT == null ? 0 : Math.max(0, now - S.lastT); S.lastT = now;
    if (S.say) { S.say.life -= d; if (S.say.life <= 0) { S.say = null; while (S.sayQ.length && now - S.sayQ[0].at > 12) S.sayQ.shift(); if (S.sayQ.length) sayLine(S, S.sayQ.shift()); } }
  };
  function objLabel(W, ob) {
    var s = tx(ob.def.text), cnt = ob.def.count;
    if (cnt && ob.state === 'active' && cnt.t === 'trained') s += ' (' + Math.min(cnt.n, W.players[0].trained[cnt.type] || 0) + '/' + cnt.n + ')';
    if (cnt && ob.state === 'active' && cnt.t === 'time') s += ' · ' + fmtTime(Math.max(0, cnt.gte - W.time)); // обратный отсчёт
    if (cnt && ob.state === 'active' && cnt.t === 'zone' && cnt.who) { var tin = W.units.filter(function (u) { return u.tag === cnt.who && C.inZone(W.mission, cnt.zone, u.x, u.y); }).length; return s + ' (' + Math.min(cnt.n, tin) + '/' + cnt.n + ')'; } // «сколько дошло» по тегу
    if (cnt && ob.state === 'active' && cnt.t === 'since') { var so = W.mission.byObj[cnt.obj]; if (so && so.state === 'done' && cnt.gte - (W.time - so.t) > 0) s += ' · ' + fmtTime(cnt.gte - (W.time - so.t)); } // отсчёт вышел, а цель ещё не выполнена — «00:00» не показываем
    if (cnt && ob.state === 'active' && cnt.t === 'sites') s += ' (' + Math.min(cnt.gte, cnt.ids ? cnt.ids.filter(function (k) { return W.mission.sites[k] && W.mission.sites[k].done; }).length : W.mission.sitesN) + '/' + cnt.gte + ')';
    if (cnt && ob.state === 'active' && cnt.t === 'ferried') s += ' (' + Math.min(cnt.gte, [].concat(cnt.tag || '*').reduce(function (a, k) { return a + (W.mission.ferried[k] || 0); }, 0)) + '/' + cnt.gte + ')'; // довезли люльками
    if (cnt && ob.state === 'active' && cnt.t === 'mined') s += ' (' + Math.min(cnt.gte, Math.floor(W.players[0].mined)) + '/' + cnt.gte + ')';
    if (cnt && ob.state === 'active' && cnt.t === 'pumped') s += ' (' + Math.min(cnt.gte, Math.floor(W.mission.pumped[cnt.zone] || 0)) + '/' + cnt.gte + ')'; // выкачано вышками в зоне
    if (cnt && ob.state === 'active' && cnt.t === 'fires') s += ' · ' + W.fires.filter(function (f) { return f.hp > 0 && (!cnt.tag || [].concat(cnt.tag).indexOf(f.tag) >= 0); }).length;
    if (cnt && ob.state === 'active' && cnt.t === 'owned') s += ' (' + Math.min(cnt.n, W.blds.filter(function (b) { return b.owner === 0 && (b.tag === cnt.tag || b.tag0 === cnt.tag) && (!cnt.type || b.type === cnt.type); }).length) + '/' + cnt.n + ')';
    if (cnt && ob.state === 'active' && cnt.t === 'scouted') s += ' (' + Math.min(cnt.gte, W.mission.scoutedN[(cnt.owner == null ? 1 : cnt.owner) + ':' + (cnt.type || cnt.tag || '*')] || 0) + '/' + cnt.gte + ')'; // разведано зданий
    if (cnt && ob.state === 'active' && cnt.t === 'builtIn') s += ' (' + Math.min(cnt.n || 1, W.blds.filter(function (b) { var bc = L.center(b); return b.owner === 0 && (!cnt.type || [].concat(cnt.type).indexOf(b.type) >= 0) && C.inZone(W.mission, cnt.zone, bc.x, bc.y); }).length) + '/' + (cnt.n || 1) + ')';
    if (cnt && ob.state === 'active' && cnt.t === 'parts') s += ' (' + (W.mission.partsN[cnt.tag || '*'] || 0) + '/' + cnt.gte + ')';
    if (cnt && ob.state === 'active' && cnt.t === 'zone') { var own = W.units.filter(function (u) { return u.owner === 0; }), inside = own.filter(function (u) { return C.inZone(W.mission, cnt.zone, u.x, u.y); }).length, need = cnt.all ? own.length : cnt.n; s += ' (' + Math.min(need, inside) + '/' + need + ')'; }
    return s;
  }
  function hintZone(W) { var ob = W.mission.objs.find(function (o) { return o.state === 'active' && o.def.hint && (o.def.hint.zone || o.def.hint.zones); }); return ob ? ob.def.hint.zone || ob.def.hint.zones : null; }
  function hintBtn(W) { var ob = W.mission.objs.find(function (o) { return o.state === 'active' && o.def.kind !== 'opt'; }); return ob && ob.def.hint && ob.def.hint.btn; }
  // слои поверх кадра (render.frame вызывает их, если заданы в S)
  function worldOverlay(c, pl, now) {
    var S0 = this, W = this.W, MS = W.mission;
    W.flares.forEach(function (f) { var k = f.t / f.max; c.strokeStyle = pl.warn; c.lineWidth = 2; c.globalAlpha = 0.25 + 0.5 * k; c.setLineDash([6, 5]); c.beginPath(); c.arc(f.x * T, f.y * T, f.r * T * (0.96 + 0.04 * Math.sin(now * 6)), 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = pl.warn; c.beginPath(); c.arc(f.x * T, f.y * T, 4 + 2 * Math.sin(now * 10), 0, 7); c.fill(); c.globalAlpha = 1; });
    // предупреждение о провале: мигающие клетки зоны
    MS.warn.forEach(function (wz) {
      var a = 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(now * 9)); c.fillStyle = pl.bad; c.globalAlpha = a;
      wz.cells.forEach(function (k) { if (!W.vis[k]) return; var i = k % W.w, j = (k / W.w) | 0; c.fillRect(i * T + 1, j * T + 1, T - 2, T - 2); });
      c.globalAlpha = 1; var zc = C.zoneCenter(MS, wz.zone), lt = '⚠ ' + Math.ceil(wz.t);
      c.font = '900 14px ' + pl.font; var lw = c.measureText(lt).width + 12; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(zc.x * T - lw / 2, zc.y * T - 11, lw, 19);
      R.txt(c, lt, zc.x * T, zc.y * T + 4, { color: pl.bad, font: pl.font, size: 14, weight: 900, align: 'center' });
    });
    // гейзеры: жерло, перед выбросом — пульсирующий круг, выброс — столб пара
    Object.keys(MS.geys).forEach(function (id) {
      var gz = MS.geys[id], p = C.pointOf(MS, gz.def.at), r = (gz.def.r || 2.2) * T, k = Math.floor(p.y) * W.w + Math.floor(p.x); if (!W.vis[k]) return;
      c.fillStyle = pl.pixel ? '#000' : 'rgba(20,14,10,0.75)'; c.beginPath(); c.ellipse(p.x * T, p.y * T, 10, 6, 0, 0, 7); c.fill();
      c.strokeStyle = gz.on ? '#ff7a2e' : pl.muted; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x * T, p.y * T, 10, 6, 0, 0, 7); c.stroke();
      if (gz.on && !gz.warn && Math.sin(now * 3 + p.x) > 0.3) { c.fillStyle = pl.steam + '0.35)'; c.beginPath(); c.arc(p.x * T + 2, p.y * T - 9, 5, 0, 7); c.fill(); }
      if (gz.warn) { c.strokeStyle = pl.warn; c.lineWidth = 2.5; c.globalAlpha = 0.5 + 0.5 * Math.sin(now * 14); c.setLineDash([6, 5]); c.beginPath(); c.arc(p.x * T, p.y * T, r, 0, 7); c.stroke(); c.setLineDash([]); c.globalAlpha = 1; R.txt(c, '!', p.x * T, p.y * T - 12, { color: pl.warn, font: pl.font, size: 16, weight: 900, align: 'center' }); }
      var bt = now - gz.burst;
      if (bt >= 0 && bt < 1.8) { var kk = bt / 1.8; c.fillStyle = pl.pixel ? '#ffffff' : 'rgba(238,243,246,' + (0.85 * (1 - kk)).toFixed(3) + ')'; c.globalAlpha = pl.pixel ? 1 - kk : 1;
        for (var q = 0; q < 7; q++) { var hh = q * 9 + kk * 26, rr = 6 + q * 2.4 + kk * 14; c.beginPath(); c.arc(p.x * T + Math.sin(q * 1.7) * 6, p.y * T - hh, rr, 0, 7); c.fill(); }
        c.globalAlpha = 0.3 * (1 - kk); c.beginPath(); c.arc(p.x * T, p.y * T, r * (0.6 + kk * 0.4), 0, 7); c.fill(); c.globalAlpha = 1; }
    });
    // фонари шахты: столб с лампой; зажжённый — тёплый круг света
    Object.keys(MS.lamps).forEach(function (id) {
      var lm = MS.lamps[id], k = Math.floor(lm.y) * W.w + Math.floor(lm.x); if (!W.vis[k]) return; var x = lm.x * T, y = lm.y * T;
      if (lm.on) { c.fillStyle = pl.pixel ? 'rgba(255,255,85,0.10)' : 'rgba(255,190,90,0.10)'; c.beginPath(); c.arc(x, y, lm.r * T, 0, 7); c.fill(); c.fillStyle = pl.pixel ? 'rgba(255,255,85,0.25)' : 'rgba(255,200,110,' + (0.22 + 0.05 * Math.sin(now * 7 + lm.x)).toFixed(3) + ')'; c.beginPath(); c.arc(x, y - 6, 13, 0, 7); c.fill(); }
      c.fillStyle = pl.metal; c.fillRect(x - 1.5, y - 4, 3, 12); c.fillRect(x - 5, y + 7, 10, 3);
      c.fillStyle = lm.on ? pl.warn : pl.rockLo; c.fillRect(x - 4, y - 12, 8, 9); c.strokeStyle = pl.metalHi; c.lineWidth = 1; c.strokeRect(x - 4.5, y - 12.5, 9, 10);
    });
    // места работ: ящик с зарядом / подрывная машинка, круг, полоса работы, галочка (подпись места не пишем, если тут же подписан круг-подсказка цели)
    var zs = hintZone(W); if (zs && !Array.isArray(zs)) zs = [zs];
    var hintAt = (zs || []).filter(function (z) { return MS.def.zones[z] && MS.def.zones[z].label; }).map(function (z) { return C.zoneCenter(MS, z); });
    Object.keys(MS.sites).forEach(function (id) {
      var st = MS.sites[id], k = Math.floor(st.y) * W.w + Math.floor(st.x); if (!st.on || !W.vis[k]) return; var x = st.x * T, y = st.y * T, need = st.def.time || 5;
      c.strokeStyle = st.done ? pl.good : pl.warn; c.lineWidth = 2; c.setLineDash(st.done ? [] : [5, 4]); c.globalAlpha = st.done ? 0.7 : 0.6 + 0.3 * Math.sin(now * 4); c.beginPath(); c.arc(x, y, st.r * T, 0, 7); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;
      c.fillStyle = 'rgba(0,0,0,0.55)'; c.beginPath(); c.arc(x, y, 12, 0, 7); c.fill(); icon(c, st.def.icon || 'charge', x - 9, y - 9, 18, pl);
      if (st.done) { c.strokeStyle = pl.good; c.lineWidth = 3; c.beginPath(); c.moveTo(x + 5, y - 13); c.lineTo(x + 9, y - 9); c.lineTo(x + 16, y - 18); c.stroke(); }
      else if (st.p > 0) { c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - 16, y + 14, 32, 5); c.fillStyle = pl.warn; c.fillRect(x - 15, y + 15, 30 * Math.min(1, st.p / need), 3); }
      if (st.def.label && !st.done && !hintAt.some(function (h) { return Math.hypot(h.x - st.x, h.y - st.y) < 1.6; })) { var sl = tx(st.def.label); c.font = '800 12px ' + pl.font; var sw = c.measureText(sl).width + 12; c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(x - sw / 2, y - st.r * T - 22, sw, 17); R.txt(c, sl, x, y - st.r * T - 9, { color: pl.warn, font: pl.font, size: 12, weight: 800, align: 'center' }); }
    });
    // подсказка цели: круг (или несколько — развилка), у зоны может быть подпись zone.label {ru,en}
    (zs || []).forEach(function (z) {
      var zd = MS.def.zones[z], p = C.zoneCenter(MS, z), r = (zd.r || Math.max(zd.w || 3, zd.h || 3) / 2) * T; c.strokeStyle = pl.warn; c.lineWidth = 2; c.globalAlpha = 0.55 + 0.3 * Math.sin(now * 4); c.setLineDash([8, 7]); c.lineDashOffset = -now * 20; c.beginPath(); c.arc(p.x * T, p.y * T, r, 0, 7); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0; c.globalAlpha = 1;
      if (zd.label) { var lt = tx(zd.label); c.font = '800 13px ' + pl.font; var lw = c.measureText(lt).width + 14, cam = S0.cam || { x: 0, y: 0 };
        var ly = p.y * T - r - 10; if (ly - 14 < cam.y + 30 && p.y * T + r > cam.y + 60) ly = Math.min(p.y * T + r - 8, cam.y + 46); // подпись не уезжает под кнопки групп — прижимаем к верху экрана
        var lx = Math.max(cam.x + lw / 2 + 4, Math.min(cam.x + LY.W - lw / 2 - 4, p.x * T));
        var ob = S0.objBox; if (ob && lx - lw / 2 - cam.x < ob.r && ly - 14 - cam.y < ob.b) { if (p.y * T + r > cam.y + ob.b + 30) ly = Math.max(ly, cam.y + ob.b + 20); else lx = Math.max(lx, cam.x + ob.r + lw / 2 + 4); } // и не поверх блока целей
        c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(lx - lw / 2, ly - 14, lw, 19); R.txt(c, lt, lx, ly, { color: pl.warn, font: pl.font, size: 13, weight: 800, align: 'center' }); }
    });
  }
  function viewOverlay(c, pl, now) {
    var MS = this.W.mission, VW = LY.W, VH = LY.VIEW_H;
    if (MS.night) {
      if (pl.pixel) { c.fillStyle = 'rgba(0,0,40,0.35)'; c.fillRect(0, 0, VW, VH); c.fillStyle = '#000'; for (var y = 0; y < VH; y += 4) for (var x = (y / 4) % 2 * 2; x < VW; x += 8) c.fillRect(x, y, 2, 2); }
      else if (this.W.ground === 'mine') { var gr = c.createRadialGradient(VW / 2, VH / 2, VH * 0.25, VW / 2, VH / 2, VW * 0.62); gr.addColorStop(0, 'rgba(10,6,2,0.18)'); gr.addColorStop(1, 'rgba(6,4,2,0.62)'); c.fillStyle = gr; c.fillRect(0, 0, VW, VH); } // шахта: тёплая темнота, гуще к краям
      else { c.fillStyle = 'rgba(8,14,40,0.40)'; c.fillRect(0, 0, VW, VH); }
    }
    if (MS.weather && (MS.weather.kind === 'snowstorm' || MS.weather.kind === 'buran')) { // буран — гуще и злее метели
      var bz = MS.weather.kind === 'buran', s = Math.min(1, MS.storm * (bz ? 1.25 : 1)), n = Math.round((bz ? 110 : 70) + (bz ? 300 : 230) * s);
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
    S.objBox = null;
    if (rows.length) {
      c.font = '700 13px ' + f; var wMax = 0; rows.forEach(function (o) { wMax = Math.max(wMax, c.measureText(objLabel(W, o)).width); });
      var bx = 8, by = 30, bw = wMax + 48, bh = 22 + rows.length * 20;
      S.objBox = { r: bx + bw + 14, b: by + bh }; // для сообщений: не писать поверх целей (галочки выполненных торчат правее блока)
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
    // гонка за жилой: добыча обеих сторон до цели (def.race.goal)
    if (MS.def.race) {
      var goal = MS.def.race.goal, rx = LY.W - 308, ry = 30, rw = 300; // справа, под кнопками групп (слева — цели)
      c.fillStyle = 'rgba(0,0,0,0.62)'; c.fillRect(rx, ry, rw, 40);
      R.txt(c, g.t('raceT').toUpperCase() + ' · ' + goal, rx + rw / 2, ry + 11, { color: pl.muted, font: f, size: 9, weight: 800, align: 'center' });
      [0, 1].forEach(function (o, i) {
        var m = Math.min(goal, Math.floor(W.players[o].mined)), y = ry + 16 + i * 12;
        R.txt(c, g.t(o ? 'raceThem' : 'raceUs'), rx + 6, y + 8, { color: pl.own[o], font: f, size: 10, weight: 800 });
        c.fillStyle = pl.line; c.fillRect(rx + 70, y + 1, 170, 8); c.fillStyle = pl.own[o]; c.fillRect(rx + 70, y + 1, 170 * m / goal, 8);
        R.txt(c, String(m), rx + rw - 6, y + 9, { color: pl.ink, font: f, size: 11, weight: 800, align: 'right' });
      });
    }
    // реплика героя
    if (S.say) {
      var line = tx(S.say.text), name = S.say.who === 'foe' ? g.t('foeVoice') : S.say.who === 'foeC' ? g.t('foeVoiceC') : S.say.who === 'post' ? g.t('postVoice') : g.t(S.say.who), a = Math.min(1, S.say.life * 2);
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
      var u = heroUnit(W, b.ab.hero), cd = u ? u.abT || 0 : 0, hd = L.HEROES[b.ab.hero], ready = u && cd <= 0, act = S.targeting && b.ab.hero === S.targeting.hero;
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
    S.msgY = def.race ? 92 : 44; // сообщения — ниже счётчика гонки
  };
  UI.detach = function (S) { ['worldOverlay', 'viewOverlay', 'hudOverlay', 'btnAllowed', 'btnHidden', 'noEco', 'idleTitle', 'idleSub', 'say', 'targeting', 'msgY', 'objBox'].forEach(function (k) { delete S[k]; }); };
  UI.finish = function (W) {
    var res = W.mission.result || C.result(W); lastRes = res; setCamp(C.campOf(C.byId(res.id)));
    UI.data = C.applyResult(C.load(store, camp), res); persist();
    if (P.achieve) P.achieve.mission(res, C.byId(res.id), UI.data, C.list(camp));   // достижения (на сайте — no-op)
    g.goto('result');
  };
  UI.openBrief = function (id) { setCamp(C.campOf(C.byId(id))); briefId = id; g.goto('brief'); };
  UI.openFinale = function (id) { finaleId = id; g.goto('finale'); };
  UI.install = function (game, h) {
    g = game; host = h;
    if (E.attach) E.attach(g);   // издание «для площадок»: товар full_game (проверка покупок при запуске — движок v2.7)
    try { store = E.storage || global.localStorage; } catch (e) { store = null; }   // E.storage — хук издания вне сайта (файлы); на сайте — localStorage
    UI.store = store; C.store = store; UI.camp = camp; UI.data = C.load(store, camp);
    // скирмиш: сторона игрока (Медный Ключ — классика; Сизый Перевал — ветряки и канатка, против ИИ Медного Ключа). ?side=sizye|copper
    var side = 'copper', qs = !E.release && /[?&]side=(sizye|copper)\b/.exec(global.location ? global.location.search : '');
    try { side = store.getItem('arcade.priisk.side') === 'sizye' ? 'sizye' : 'copper'; } catch (e) {}
    if (qs) side = qs[1]; P.SKIRMISH_SIDE = side;
    g.menu.addItem({ key: 'side', after: 'play', label: function () { return g.t('side') + ': ' + g.t(P.SKIRMISH_SIDE === 'sizye' ? 'sideSizye' : 'sideCopper'); },
      onSelect: function () { P.SKIRMISH_SIDE = P.SKIRMISH_SIDE === 'sizye' ? 'copper' : 'sizye'; try { store.setItem('arcade.priisk.side', P.SKIRMISH_SIDE); } catch (e) {} g.audio.beep(P.SKIRMISH_SIDE === 'sizye' ? 520 : 660, 0.05); } });
    // противник в скирмише за Медный Ключ: Сизые на котельных (классика) или на своей механике — ветряки и канатка (ИИ Сизых). ?foe=sizye|classic
    var foe = 'classic', qf = !E.release && /[?&]foe=(sizye|classic)\b/.exec(global.location ? global.location.search : '');
    try { foe = store.getItem('arcade.priisk.foe') === 'sizye' ? 'sizye' : 'classic'; } catch (e) {}
    if (qf) foe = qf[1]; P.SKIRMISH_FOE = foe;
    g.menu.addItem({ key: 'foe', after: 'side', label: function () { return g.t('foe') + ': ' + g.t(P.SKIRMISH_SIDE === 'sizye' ? 'sideCopper' : P.SKIRMISH_FOE === 'sizye' ? 'foeSizye' : 'foeClassic'); },
      onSelect: function () { if (P.SKIRMISH_SIDE === 'sizye') { g.audio.beep(200, 0.05); return; } P.SKIRMISH_FOE = P.SKIRMISH_FOE === 'sizye' ? 'classic' : 'sizye'; try { store.setItem('arcade.priisk.foe', P.SKIRMISH_FOE); } catch (e) {} g.audio.beep(P.SKIRMISH_FOE === 'sizye' ? 520 : 660, 0.05); } });
    // скирмиш: уровень ИИ (Лёгкий / Обычный — как раньше / Трудный) и карта (плато со случайным сидом, плато с сидом прошлой партии,
    // три рукотворные). Запоминаются (arcade.priisk.level / .map, сид прошлой партии — .seed). Для проверки: ?level=easy|normal|hard,
    // ?map=gen|pass|isles|veins (в издании release — нет)
    var srch = global.location ? global.location.search : '', LV = L.AI_LEVELS, MAPS = L.SK_MAPS;
    var lvl = 'normal', ql = !E.release && /[?&]level=(easy|normal|hard)\b/.exec(srch);
    try { var sl = store.getItem('arcade.priisk.level'); if (LV.indexOf(sl) >= 0) lvl = sl; } catch (e) {}
    if (ql) lvl = ql[1]; P.SKIRMISH_LEVEL = lvl;
    g.menu.addItem({ key: 'level', after: 'foe', label: function () { return g.t('level') + ': ' + g.t({ easy: 'lvEasy', normal: 'lvNormal', hard: 'lvHard' }[P.SKIRMISH_LEVEL]); },
      onSelect: function () { P.SKIRMISH_LEVEL = LV[(LV.indexOf(P.SKIRMISH_LEVEL) + 1) % LV.length]; try { store.setItem('arcade.priisk.level', P.SKIRMISH_LEVEL); } catch (e) {} g.audio.beep([440, 560, 680][LV.indexOf(P.SKIRMISH_LEVEL)], 0.05); } });
    var mp = 'gen', qm = !E.release && /[?&]map=(gen|pass|isles|veins)\b/.exec(srch);
    try { var sm = store.getItem('arcade.priisk.map'); if (MAPS.indexOf(sm) >= 0 || sm === 'gen:last') mp = sm; P.SKIRMISH_SEED = parseInt(store.getItem('arcade.priisk.seed'), 10) || 0; } catch (e) {}
    if (mp === 'gen:last' && !P.SKIRMISH_SEED) mp = 'gen';
    if (qm) mp = qm[1]; P.SKIRMISH_MAP = mp;
    function mapList() { var l = MAPS.slice(); if (P.SKIRMISH_SEED) l.splice(1, 0, 'gen:last'); return l; }
    // E.mapOpen(map) — необязательный хук издания вне сайта: карта закрыта — подпись «· <mapLocked>», «Скирмиш» на ней зовёт E.mapLocked(g)
    // (или просто не стартует); на сайте хука нет — открыты все карты, как раньше
    function mapShut(m) { return !!E.mapOpen && !E.mapOpen(String(m || 'gen').split(':')[0]); }
    g.menu.addItem({ key: 'map', after: 'level', label: function () { var m = P.SKIRMISH_MAP; return g.t('map') + ': ' + (m === 'gen:last' ? g.t('mapGenSeed') + P.SKIRMISH_SEED : g.t({ gen: 'mapGen', pass: 'mapPass', isles: 'mapIsles', veins: 'mapVeins' }[m])) + (mapShut(m) ? ' · ' + g.t('mapLocked') : ''); },
      onSelect: function () { var l = mapList(); P.SKIRMISH_MAP = l[(l.indexOf(P.SKIRMISH_MAP) + 1) % l.length]; try { store.setItem('arcade.priisk.map', P.SKIRMISH_MAP); } catch (e) {} g.audio.beep(600, 0.05); } });
    if (E.mapOpen) { var tm = g.menu.get('title'), pi = tm && tm.items.filter(function (it) { return it.key === 'play'; })[0];
      if (pi) { var play0 = pi.onSelect; pi.onSelect = function () { if (!mapShut(P.SKIRMISH_MAP)) return play0.apply(this, arguments); g.audio.beep(180, 0.06, 'square'); if (E.mapLocked) E.mapLocked(g); }; } }
    // клавиши героев Сизых: Q — Корней, E — Митяй, R — Агафья (у Медного Ключа Q/E/R ловит main.js)
    global.addEventListener('keydown', function (e) {
      var hk = AB_KEYS[e.code], S = host.S; if (!hk || e.ctrlKey || e.metaKey || e.altKey || g._sceneName !== 'play' || !S.W || !S.W.mission || !S.W.mission.heroes[hk]) return;
      UI.useAbility(S, hk); e.preventDefault();
    });
    g.menu.addItem({ key: 'campaign', after: 'map', label: function () { return g.t('campaign'); }, onSelect: function () { var d = data(); sel = Math.max(0, Math.min(d.unlocked, C.list(camp).length || 1) - 1); g.goto('camp'); } });
    var draw = { camp: drawCamp, brief: drawBrief, result: drawResult, edition: drawEdition, finale: drawFinale };
    ['camp', 'brief', 'result', 'edition', 'finale'].forEach(function (name) {
      g.scene(name, { realtime: true, enter: function () { hover = -1; resetArm = 0; sel2 = 0; if (name === 'camp' || name === 'edition') backFromBoth(); UI.data = C.load(store, camp); g.audio.beep(520, 0.05); }, update: function () {}, draw: function (c) { draw[name](c); }, press: sceneKeys(name) });
    });
    KU.bindHot(g.canvas, { active: inScreens, list: function () { return hot; }, size: function () { return { w: g.W, h: g.H }; },
      press: function (i, b) { if (b.node != null && sel !== b.node) { sel = b.node; g.audio.beep(600, 0.03); return; } g.audio.beep(700, 0.03); b.fn(); }, hover: function (i) { hover = i; } });
    return UI;
  };
  UI._test = { missionList: missionList, nodeState: nodeState, nodes: NODES, nodesS: NODES_S, epNode: EP_NODE, epi: epi, epiState: epiState, setCamp: setCamp, camp: function () { return camp; }, hot: function () { return hot; }, sel: function (v) { if (v != null) sel = v; return sel; } };
})(window);
