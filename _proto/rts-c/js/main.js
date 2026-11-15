/* ГАТЬ · связка с движком Гефест Arcade: сцены (заставка движка → поход → бой → итог), камера, HUD,
   тач/мышь/клавиатура, звук событий. Холст: высота 720 логических px, ширина подстраивается под экран (1000–1600). */
(function () {
  'use strict';
  var GAT = window.GAT, L = GAT.logic, RN = GAT.render, Store = Arcade.Store;
  var Q = new URLSearchParams(location.search);
  var canvas = document.getElementById('c');
  var g = Arcade.createGame({ canvas: '#c', width: 1280, height: 720, gameId: 'gat', strings: GAT.strings, theme: 'modern' });
  var STEP = 1 / 30;
  var S = null, bot = null, acc = 0, cam = { x: 0, y: 0, z: 1 }, sel = new Set(), marks = [], panel = null, aim = null, toasts = [], btns = [];
  var endT = 0, lastOrder = null, lastKey = { code: '', t: 0 }, mouse = { x: -1, y: -1, in: false, used: false }, playT = 0, shotT = 0;
  var brief = { m: 0, h: +Store.get('arcade.gat.hero', '0') || 0 }, debrief = null;
  var buf = document.createElement('canvas'), bctx = buf.getContext('2d');
  function unlocked() { return Math.max(1, Math.min(3, +Store.get('arcade.gat.progress', '1') || 1)); }
  function t(k) { return g.t(k, k); }

  // ---------- размер ----------
  function layout() {
    var vw = window.innerWidth || 1280, vh = window.innerHeight || 720;
    var W = Math.round(Math.max(1000, Math.min(1600, 720 * vw / vh)));
    if (g.W !== W || canvas.width !== W) { g.W = W; g.H = 720; canvas.width = W; canvas.height = 720; g._applyPixel(); }
    var s = Math.min(vw / W, vh / 720);
    canvas.style.width = Math.floor(W * s) + 'px'; canvas.style.height = Math.floor(720 * s) + 'px';
    clampCam();
  }
  window.addEventListener('resize', layout);

  // ---------- камера ----------
  function clampCam() {
    if (!S) return; var TL = L.TILE, ww = S.map.w * TL, wh = S.map.h * TL, vw = g.W / cam.z, vh = g.H / cam.z, m = 60;
    cam.x = vw > ww + 2 * m ? (ww - vw) / 2 : Math.max(-m, Math.min(ww - vw + m, cam.x));
    cam.y = vh > wh + 2 * m ? (wh - vh) / 2 : Math.max(-m - 40, Math.min(wh - vh + m + 90, cam.y));
  }
  function centerOn(x, y) { cam.x = x - g.W / cam.z / 2; cam.y = y - g.H / cam.z / 2; clampCam(); }
  function zoomAt(p, f) { var w = toWorld(p); cam.z = Math.max(0.55, Math.min(1.6, cam.z * f)); cam.x = w.x - p.x / cam.z; cam.y = w.y - p.y / cam.z; clampCam(); }
  function toWorld(p) { return { x: cam.x + p.x / cam.z, y: cam.y + p.y / cam.z }; }
  function toLogical(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * g.W / r.width, y: (e.clientY - r.top) * g.H / r.height }; }

  // ---------- запуск миссии ----------
  function setup(mi, hi) {
    S = L.create(mi, hi, (+Q.get('seed')) || (Date.now() % 100000));
    bot = Q.get('bot') === '1' ? GAT.makeBot(S, 5) : null;
    sel = new Set(['hero']); marks = []; panel = null; aim = null; toasts = []; acc = 0; endT = 0; playT = 0;
    cam.z = 1; centerOn(S.hero.x + 200, S.hero.y);
    toast(t('m' + (mi + 1)), 4);
  }
  function toast(s, d) { toasts.push({ s: s, t: 0, d: d || 2.6 }); if (toasts.length > 4) toasts.shift(); }

  // ---------- приказы ----------
  function selIds() { return Array.from(sel).filter(function (id) { var sq = L.squadById(S, id); return sq && L.alive(sq); }); }
  function pickSquad(w, extra) {
    var best = null, bd = Infinity;
    S.squads.forEach(function (sq) { sq.members.forEach(function (u) { if (u.dead) return; var d = Math.hypot(u.x - w.x, u.y - w.y) - u.r - extra; if (d < 0 && d < bd) { bd = d; best = sq; } }); });
    return best;
  }
  function pickFoe(w, extra) {
    var best = null, bd = Infinity;
    S.units.forEach(function (u) { if (u.dead || u.side !== 1) return; var d = Math.hypot(u.x - w.x, u.y - (w.y + 4)) - u.r - extra; if (d < 0 && d < bd) { bd = d; best = u; } });
    return best;
  }
  function pickPoint(w, rr) { var b = null; S.points.forEach(function (p) { if (Math.hypot(p.x - w.x, p.y - 20 - w.y) < rr) b = p; }); return b; }
  function command(w, mouseCmd) {
    var ids = selIds(); if (!ids.length) return false;
    var foe = pickFoe(w, mouseCmd ? 8 : 18);
    if (foe) { L.order(S, ids, { k: 'attack', tid: foe.id }); marks.push({ x: foe.x, y: foe.y, t: 0, atk: true }); return true; }
    var now = performance.now(), force = !!(lastOrder && now - lastOrder.t < 450 && Math.hypot(lastOrder.x - w.x, lastOrder.y - w.y) < 50);
    L.order(S, ids, { k: 'move', x: w.x, y: w.y, force: force }); lastOrder = { t: now, x: w.x, y: w.y };
    marks.push({ x: w.x, y: w.y, t: 0, atk: false });
    return true;
  }
  function castQ(w) { aim = null; if (!L.ability(S, 'q', w.x, w.y)) g.audio.beep(180, 0.06); }
  function abilityBtn(k) {
    if (S.hero.dead) { g.audio.beep(180, 0.06); return; }
    if (k === 'e') { if (!L.ability(S, 'e')) g.audio.beep(180, 0.06); return; }
    if (S.hero.cdQ > 0) { g.audio.beep(180, 0.06); return; }
    aim = aim ? null : { k: 'q' };
  }
  function selectAll() { sel = new Set(S.squads.filter(function (s) { return L.alive(s); }).map(function (s) { return s.id; })); }
  function selectSlot(i) { // 0 — герой, 1..4 — отряды
    var list = cards(); var sq = list[i]; if (!sq) return;
    var now = performance.now(); if (lastKey.code === 'slot' + i && now - lastKey.t < 400) centerSq(sq);
    lastKey = { code: 'slot' + i, t: now };
    sel = new Set([sq.id]);
  }
  function centerSq(sq) { var u = sq.members.filter(function (m) { return !m.dead; })[0]; if (u) centerOn(u.x, u.y); }
  function cards() { var a = [S.squads.filter(function (s) { return s.type === 'hero'; })[0]]; return a.concat(S.squads.filter(function (s) { return s.type !== 'hero'; })); }
  function why(r) { if (!r || r.ok) return; toast(t({ max: 'msgMax', supply: 'msgSupply', far: 'msgFar', maxlvl: 'msgMaxLvl', built: 'msgBuilt' }[r.why] || 'msgSupply'), 1.6); g.audio.beep(180, 0.06); }

  // ---------- ввод (Pointer Events: тач и мышь) ----------
  var ptrs = new Map(), gest = null, active = { brief: 1, play: 1, debrief: 1 };
  function hitBtn(p) { for (var i = btns.length - 1; i >= 0; i--) { var b = btns[i]; if (p.x >= b.x && p.y >= b.y && p.x <= b.x + b.w && p.y <= b.y + b.h) return b; } return null; }
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('pointerdown', function (e) {
    if (!active[g._sceneName]) return;
    e.preventDefault(); try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
    var p = toLogical(e); if (e.isPrimary) ptrs.clear(); // первый палец — значит, других касаний нет (страховка от потерянных pointerup)
    ptrs.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y });
    if (e.pointerType === 'mouse') mouse.used = true; else mouse.used = false;
    if (ptrs.size === 2 && g._sceneName === 'play') {
      var a = Array.from(ptrs.values()); gest = { k: 'pinch', d0: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, z0: cam.z, m0: { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 }, c0: { x: cam.x, y: cam.y } };
      return;
    }
    if (ptrs.size > 2) return;
    var b = hitBtn(p); if (b) { gest = { k: 'btn', b: b, id: e.pointerId }; return; }
    if (g._sceneName !== 'play') { gest = null; return; }
    if (e.pointerType === 'mouse') {
      if (e.button === 2) { rightClick(p); gest = null; return; }
      if (e.button === 1) { gest = { k: 'pan', id: e.pointerId, lx: p.x, ly: p.y }; return; }
      gest = { k: 'press', mouse: true, shift: e.shiftKey, id: e.pointerId, sx: p.x, sy: p.y };
    } else gest = { k: 'press', mouse: false, id: e.pointerId, sx: p.x, sy: p.y, lx: p.x, ly: p.y };
  }, { passive: false });
  canvas.addEventListener('pointermove', function (e) {
    var p = toLogical(e);
    if (e.pointerType === 'mouse') { mouse.x = p.x; mouse.y = p.y; mouse.in = true; }
    var pt = ptrs.get(e.pointerId); if (!pt) return; pt.x = p.x; pt.y = p.y;
    if (!gest) return;
    if (gest.k === 'pinch') {
      var a = Array.from(ptrs.values()); if (a.length < 2) return;
      var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), m = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
      var wz = { x: gest.c0.x + gest.m0.x / gest.z0, y: gest.c0.y + gest.m0.y / gest.z0 };
      cam.z = Math.max(0.55, Math.min(1.6, gest.z0 * d / gest.d0)); cam.x = wz.x - m.x / cam.z; cam.y = wz.y - m.y / cam.z; clampCam();
      return;
    }
    if (gest.id !== e.pointerId) return;
    if (gest.k === 'press' && Math.hypot(p.x - gest.sx, p.y - gest.sy) > 14) { gest.k = gest.mouse ? 'box' : 'pan'; gest.lx = p.x; gest.ly = p.y; }
    if (gest.k === 'pan') { cam.x -= (p.x - gest.lx) / cam.z; cam.y -= (p.y - gest.ly) / cam.z; gest.lx = p.x; gest.ly = p.y; clampCam(); }
    if (gest.k === 'box') { gest.ex = p.x; gest.ey = p.y; }
  });
  function up(e) {
    var p = toLogical(e), had = ptrs.has(e.pointerId); ptrs.delete(e.pointerId);
    if (!had || !gest) return;
    if (gest.k === 'pinch') { if (ptrs.size < 2) gest = { k: 'none' }; return; }
    if (gest.id !== e.pointerId) return;
    var G = gest; gest = null;
    if (e.type === 'pointercancel') return;
    if (G.k === 'btn') { if (hitBtn(p) === G.b) { G.b.fn(); g.audio.beep(640, 0.03); } return; }
    if (g._sceneName !== 'play') return;
    if (G.k === 'press') tap(p, G.mouse, G.shift);
    else if (G.k === 'box') boxSelect(G, G.shift);
  }
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') mouse.in = false; });
  canvas.addEventListener('wheel', function (e) { if (g._sceneName !== 'play') return; e.preventDefault(); zoomAt(toLogical(e), e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });

  function tap(p, isMouse, shift) {
    var w = toWorld(p);
    if (aim) { castQ(w); return; }
    var own = pickSquad(w, isMouse ? 6 : 16);
    if (own) {
      if (shift) { if (sel.has(own.id)) sel.delete(own.id); else sel.add(own.id); }
      else sel = new Set([own.id]);
      g.audio.beep(760, 0.03); return;
    }
    if (isMouse) { var pm = pickPoint(w, 46); if (pm) { panel = pm.id; return; } if (!shift) sel.clear(); panel = null; return; }
    // тач: враг → атака, значок вехи → панель, земля → приказ
    var foe = pickFoe(w, 18);
    if (foe && sel.size) { command(w, false); return; }
    var pt = pickPoint(w, 40); if (pt) { panel = panel === pt.id ? null : pt.id; return; }
    if (sel.size) { command(w, false); return; }
    var inside = S.points.filter(function (q) { return Math.hypot(q.x - w.x, q.y - w.y) < q.r; })[0];
    panel = inside ? inside.id : null;
  }
  function rightClick(p) { if (aim) { aim = null; return; } command(toWorld(p), true); }
  function boxSelect(G, shift) {
    var a = toWorld({ x: Math.min(G.sx, G.ex), y: Math.min(G.sy, G.ey) }), b = toWorld({ x: Math.max(G.sx, G.ex), y: Math.max(G.sy, G.ey) });
    var got = S.squads.filter(function (sq) { return sq.members.some(function (u) { return !u.dead && u.x >= a.x && u.x <= b.x && u.y >= a.y && u.y <= b.y; }); });
    if (!shift) sel = new Set();
    got.forEach(function (sq) { sel.add(sq.id); });
  }

  // клавиатура (своё, кроме общих P/Esc/M/L/T/Enter/Space движка)
  window.addEventListener('keydown', function (e) {
    var sc = g._sceneName;
    if (sc === 'brief') {
      if (/^Digit[1-3]$/.test(e.code)) { var m = +e.code.slice(5) - 1; if (m < unlocked()) brief.m = m; }
      if (e.code === 'KeyQ' || e.code === 'KeyE') setHero(e.code === 'KeyQ' ? 0 : 1);
      return;
    }
    if (sc !== 'play' || !S) return;
    var c = e.code;
    if (/^Digit[1-4]$/.test(c)) { selectSlot(+c.slice(5)); e.preventDefault(); }
    else if (c === 'Backquote' || c === 'KeyH' || c === 'Digit0') selectSlot(0);
    else if (c === 'KeyQ') { if (mouse.used && mouse.in && !S.hero.dead && S.hero.cdQ <= 0 && !hitBtn(mouse)) castQ(toWorld(mouse)); else abilityBtn('q'); }
    else if (c === 'KeyE') abilityBtn('e');
    else if (c === 'Equal' || c === 'NumpadAdd') zoomAt({ x: g.W / 2, y: g.H / 2 }, 1.12);
    else if (c === 'Minus' || c === 'NumpadSubtract') zoomAt({ x: g.W / 2, y: g.H / 2 }, 1 / 1.12);
    else if (c === 'Tab') { e.preventDefault(); var own = S.points.filter(function (p) { return p.owner === 1; }); var i = own.map(function (p) { return p.id; }).indexOf(panel); var nx = own[(i + 1) % own.length]; if (nx) { panel = nx.id; centerOn(nx.x, nx.y); } }
    else if (panel && (c === 'KeyZ' || c === 'KeyX' || c === 'KeyC')) why(L.hire(S, panel, { KeyZ: 'bow', KeyX: 'shield', KeyC: 'cart' }[c]));
    else if (panel && (c === 'KeyR' || c === 'KeyF' || c === 'KeyG')) why(L.build(S, panel, { KeyR: 'tower', KeyF: 'fire', KeyG: 'barn' }[c]));
    else if (panel && c === 'KeyV') { var p0 = L.pointById(S, panel), sq = p0 && L.squadsAt(S, p0).filter(function (s) { return s.level < 3; })[0]; why(sq ? L.upgrade(S, panel, sq.id) : { ok: false, why: 'far' }); }
  });

  // ---------- рисование UI ----------
  function rr(c, x, y, w, h, r) { var th = g.th(); if (th.pixel) { c.rect(x, y, w, h); return; } c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function box(x, y, w, h, fill, stroke) { var c = g.ctx; c.beginPath(); rr(c, x, y, w, h, 12); c.fillStyle = fill; c.fill(); if (stroke) { c.strokeStyle = stroke; c.lineWidth = 2; c.stroke(); } }
  function button(id, x, y, w, h, label, fn, o) {
    o = o || {}; var th = g.th(), P = RN.PAL[g.themeName] || RN.PAL.modern;
    box(x, y, w, h, o.on ? 'rgba(54,179,168,.32)' : (o.dim ? 'rgba(20,22,28,.55)' : 'rgba(16,20,26,.82)'), o.on ? P.sel : (o.dim ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.18)'));
    if (label) g.text(label, x + w / 2, y + (o.sub ? h / 2 - 2 : h / 2 + 7), { size: o.size || 20, align: 'center', color: o.dim ? th.muted : th.ink });
    if (o.sub) g.text(o.sub, x + w / 2, y + h / 2 + 20, { size: o.subSize || 15, align: 'center', color: o.subColor || th.muted, weight: 600 });
    btns.push({ id: id, x: x, y: y, w: w, h: h, fn: fn });
  }
  function icon(kind, x, y, s) {
    var c = g.ctx, P = RN.PAL[g.themeName] || RN.PAL.modern;
    c.save(); c.translate(x, y); c.scale(s, s);
    if (kind === 'hero_v' || kind === 'hero_z') { c.fillStyle = P.me2; c.fillRect(-9, -6, 18, 16); c.fillStyle = P.linen; c.fillRect(-6, -14, 12, 9); if (kind === 'hero_v') { c.fillStyle = P.amber; c.fillRect(9, -6, 7, 8); } else { c.fillStyle = P.gat; c.fillRect(8, -16, 3, 26); } }
    else if (kind === 'bow') { c.fillStyle = P.me; c.fillRect(-7, -4, 14, 14); c.fillStyle = P.linen; c.fillRect(-5, -11, 10, 7); c.fillStyle = P.gat; c.fillRect(8, -10, 3, 18); c.fillStyle = P.amber; c.fillRect(3, -1, 10, 3); }
    else if (kind === 'shield') { c.fillStyle = P.me; c.fillRect(-7, -4, 14, 14); c.fillStyle = P.linen; c.fillRect(-5, -11, 10, 7); c.fillRect(6, -8, 7, 18); }
    else if (kind === 'cart') { c.fillStyle = P.gat; c.fillRect(-12, -6, 24, 12); c.fillStyle = '#2a2219'; c.fillRect(-10, 6, 6, 5); c.fillRect(4, 6, 6, 5); c.fillStyle = P.amber; c.fillRect(-2, -10, 16, 4); }
    else if (kind === 'tower') { c.fillStyle = P.gat2; c.fillRect(-8, -8, 4, 20); c.fillRect(4, -8, 4, 20); c.fillStyle = P.gat; c.fillRect(-11, -14, 22, 8); }
    else if (kind === 'fire') { c.fillStyle = '#e8743a'; c.fillRect(-6, -10, 12, 16); c.fillStyle = P.amber; c.fillRect(-3, -4, 6, 10); c.fillStyle = P.gat2; c.fillRect(-10, 6, 20, 4); }
    else if (kind === 'barn') { c.fillStyle = P.gat; c.fillRect(-11, -4, 22, 14); c.fillStyle = P.gat2; c.beginPath(); c.moveTo(-14, -4); c.lineTo(0, -14); c.lineTo(14, -4); c.fill(); }
    c.restore();
  }
  function fmt(s) { s = Math.max(0, s | 0); return (s / 60 | 0) + ':' + ('0' + s % 60).slice(-2); }

  function drawHud() {
    var th = g.th(), W = g.W, H = g.H, c = g.ctx, P = RN.PAL[g.themeName] || RN.PAL.modern, h = S.hero, ob = L.objective(S);
    // верх: припас, время, цель
    var tw = Math.min(780, W - 480), tx = W / 2 - tw / 2;
    box(tx, 8, tw, 70, 'rgba(10,14,18,.78)');
    icon('barn', tx + 28, 34, 1);
    g.text(t('supply') + ' ' + (S.supply | 0), tx + 50, 40, { size: 22, color: P.amber });
    g.text('+' + (S.income || 0).toFixed(1) + '/s', tx + 50, 64, { size: 14, color: th.muted, weight: 600 });
    g.text(fmt(S.t), tx + tw - 16, 40, { size: 22, align: 'right' });
    var ox = tx + 210, ow = tw - 300;
    var obj = ob.boss ? t('objBoss') + ': ' + t(S.m.boss.kind) + ' ' + Math.round(ob.bossHp * 100) + '%'
      : t('objCapture') + ' ' + ob.mine + '/' + ob.total + ' · ' + t('objNests') + ' ' + (ob.nests - ob.nestsLeft) + '/' + ob.nests;
    g.text(obj, ox, 36, { size: 17, weight: 800, color: ob.boss ? th.bad : th.ink });
    if (ob.boss && S.boss && !S.boss.dead) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(ox, 50, ow, 12); c.fillStyle = P.foe; c.fillRect(ox, 50, ow * ob.bossHp, 12); }
    else g.text(t('objBossIn') + ' ' + fmt(ob.bossIn) + ' · ' + t('lvl') + ' ' + h.lvl + ' ' + t('hero_' + h.hero.id), ox, 62, { size: 13, color: th.muted, weight: 600 });
    // мини-карта
    var mw = 210, mh = Math.round(mw * S.map.h / S.map.w), mx = W - mw - 14, my = 44;
    RN.minimap(c, S, g.themeName, mx, my, mw, mh, cam, { w: W, h: H });
    btns.push({ id: 'mini', x: mx, y: my, w: mw, h: mh, fn: function () {} , mini: { x: mx, y: my, w: mw, h: mh } });
    // подсказка
    var hint = aim ? (mouse.used ? t('tapTargetM') : t('tapTarget')) : (playT < 40 ? (sel.size ? (mouse.used ? t('selHintM') : t('selHint')) : (g.input.touchOnly || !mouse.used ? t('noSel') : t('noSelM'))) : '');
    if (hint) { c.globalAlpha = aim ? 1 : Math.min(1, (40 - playT) / 4); g.text(hint, W / 2, 100, { size: 17, align: 'center', color: aim ? P.amber : th.ink, weight: 700 }); c.globalAlpha = 1; }
    // тосты
    toasts.forEach(function (o, i) { c.globalAlpha = Math.min(1, (o.d - o.t) * 2); g.text(o.s, W / 2, 132 + i * 26, { size: 19, align: 'center', color: P.amber }); c.globalAlpha = 1; });
    // карточки героя и отрядов
    var list = cards(), cw = 116, ch = 96, cx = 14, cy = H - ch - 14;
    for (var i = 0; i < 5; i++) {
      var sq = list[i], x = cx + i * (cw + 8);
      if (!sq) { (function (x) { button('empty' + i, x, cy + 20, cw, ch - 20, '+', function () { var own = S.points.filter(function (p) { return p.owner === 1; }).sort(function (a, b) { return (b.home ? 1 : 0) - (a.home ? 1 : 0); }); if (own[0]) panel = own[0].id; }, { dim: true, size: 30 }); })(x); continue; }
      (function (sq, i, x) {
        var on = sel.has(sq.id), alive = sq.members.filter(function (u) { return !u.dead; }), hero = sq.type === 'hero';
        button('card' + i, x, cy, cw, ch, '', function () { var now = performance.now(); if (lastKey.code === 'card' + i && now - lastKey.t < 400) centerSq(sq); lastKey = { code: 'card' + i, t: now }; sel = new Set([sq.id]); }, { on: on });
        icon(hero ? h.kind : sq.type, x + 30, cy + 40, 1.5);
        g.text(String(i === 0 ? 'H' : i), x + 8, cy + 20, { size: 13, color: th.muted });
        g.text(hero ? t('lvl') + h.lvl : t('lvl') + sq.level, x + cw - 8, cy + 22, { size: 14, align: 'right', color: P.amber });
        var hp = 0, mhp = 0; alive.forEach(function (u) { hp += u.hp; }); sq.members.forEach(function (u) { mhp += u.maxHp; });
        if (!hero) mhp = Math.max(mhp, L.SQUADS[sq.type].n * (sq.members[0] ? sq.members[0].maxHp : 1));
        c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x + 8, cy + ch - 18, cw - 16, 8);
        c.fillStyle = hp / mhp > 0.4 ? P.hp : P.hpBad; c.fillRect(x + 8, cy + ch - 18, (cw - 16) * Math.max(0, hp / mhp), 8);
        if (hero && h.dead) g.text(Math.ceil(h.respawn) + 's', x + cw - 10, cy + 60, { size: 22, align: 'right', color: th.bad });
        else if (!hero) g.text(alive.length + '/' + L.SQUADS[sq.type].n, x + cw - 10, cy + 60, { size: 16, align: 'right' });
        else { var xpN = L.XP_LVL[h.lvl] || 0, xpP = L.XP_LVL[h.lvl - 1] || 0; c.fillStyle = P.amber; c.fillRect(x + 8, cy + ch - 8, (cw - 16) * (h.lvl >= 5 ? 1 : (h.xp - xpP) / (xpN - xpP)), 3); }
      })(sq, i, x);
    }
    button('all', cx + 5 * (cw + 8), cy + 20, 84, ch - 20, t('all'), selectAll, { size: 18 });
    // способности
    var H0 = h.hero, R = 60, ex = W - 86, ey = H - 86, qx = W - 230, qy = H - 86;
    abil('q', qx, qy, R, h.cdQ, H0.q.cd * (1 - 0.05 * (h.lvl - 1)), t('q_' + H0.id), 'Q', !!aim);
    abil('e', ex, ey, R, h.cdE, H0.e.cd * (1 - 0.05 * (h.lvl - 1)), t('e_' + H0.id), 'E', false);
    if (panel) drawPanel();
  }
  function abil(k, x, y, R, cd, max, name, key, on) {
    var c = g.ctx, th = g.th(), P = RN.PAL[g.themeName] || RN.PAL.modern, dead = S.hero.dead;
    c.fillStyle = on ? 'rgba(242,179,71,.4)' : 'rgba(16,20,26,.85)';
    if (th.pixel) c.fillRect(x - R, y - R, R * 2, R * 2); else { c.beginPath(); c.arc(x, y, R, 0, 7); c.fill(); }
    c.strokeStyle = cd > 0 || dead ? 'rgba(255,255,255,.2)' : P.amber; c.lineWidth = 3; if (th.pixel) c.strokeRect(x - R, y - R, R * 2, R * 2); else { c.beginPath(); c.arc(x, y, R, 0, 7); c.stroke(); }
    if (cd > 0) { c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.moveTo(x, y); c.arc(x, y, R - 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * cd / max); c.closePath(); c.fill(); g.text(Math.ceil(cd) + '', x, y + 10, { size: 30, align: 'center' }); }
    else g.text(name, x, y + 8, { size: 19, align: 'center', color: dead ? th.muted : th.ink });
    g.text(key, x - R + 12, y - R + 22, { size: 15, color: th.muted });
    btns.push({ id: 'ab' + k, x: x - R, y: y - R, w: R * 2, h: R * 2, fn: function () { abilityBtn(k); } });
  }
  function drawPanel() {
    var p = L.pointById(S, panel); if (!p) { panel = null; return; }
    var th = g.th(), W = g.W, P = RN.PAL[g.themeName] || RN.PAL.modern;
    var pw = 440, px = W - pw - 14, py = 44 + Math.round(210 * S.map.h / S.map.w) + 12, mine = p.owner === 1;
    var ph = mine ? 340 : 110;
    if (py + ph > g.H - 160) py = g.H - 160 - ph;
    box(px, py, pw, ph, 'rgba(10,14,18,.9)', 'rgba(255,255,255,.15)');
    g.text((p.home ? t('home') : t('post') + ' ' + p.label) + ' · ' + (mine ? t('yourPost') : (p.nest && !p.nest.dead ? t('enemyPost') : t('neutralPost'))), px + 16, py + 32, { size: 18, color: mine ? P.me : th.ink });
    button('close', px + pw - 50, py + 8, 42, 36, '✕', function () { panel = null; }, { size: 18 });
    btns.push({ id: 'panelbg', x: px, y: py, w: pw, h: ph, fn: function () {} });
    btns.push(btns.splice(btns.length - 2, 1)[0]); // крестик поверх фона
    if (!mine) { g.text(p.nest && !p.nest.dead ? t('nest') + ' ' + Math.ceil(p.nest.hp) : t('selHint'), px + 16, py + 70, { size: 15, color: th.muted, weight: 600 }); return; }
    g.text(t('hire') + ' (' + L.armyCount(S) + '/' + L.MAX_SQUADS + ')', px + 16, py + 64, { size: 15, color: th.muted });
    ['bow', 'shield', 'cart'].forEach(function (k, i) {
      var cost = L.SQUADS[k].cost, x = px + 16 + i * 140;
      button('hire_' + k, x, py + 74, 130, 78, '', function () { why(L.hire(S, p.id, k)); }, { dim: S.supply < cost || L.armyCount(S) >= L.MAX_SQUADS });
      icon(k, x + 20, py + 108, 1.1); g.text(t(k), x + 78, py + 102, { size: t(k).length > 11 ? 11 : 13, align: 'center', weight: 700 }); g.text(cost + '', x + 74, py + 128, { size: 16, align: 'center', color: P.amber });
      g.text(['Z', 'X', 'C'][i], x + 120, py + 146, { size: 11, align: 'right', color: th.muted });
    });
    var sqs = L.squadsAt(S, p);
    g.text(t('upgrade'), px + 16, py + 176, { size: 15, color: th.muted });
    if (!sqs.length) g.text(t('msgFar'), px + 120, py + 176, { size: 13, color: th.muted, weight: 600 });
    sqs.slice(0, 4).forEach(function (sq, i) {
      var x = px + 16 + i * 104, c2 = L.upCost(sq), max = sq.level >= 3;
      button('up_' + sq.id, x, py + 186, 96, 58, '', function () { why(L.upgrade(S, p.id, sq.id)); }, { dim: max || S.supply < c2 });
      icon(sq.type, x + 22, py + 214, 1.1); g.text(max ? '★★★' : t('lvl') + (sq.level + 1), x + 64, py + 210, { size: 13, align: 'center' }); if (!max) g.text(c2 + '', x + 64, py + 232, { size: 15, align: 'center', color: P.amber });
    });
    g.text(t('build'), px + 16, py + 270, { size: 15, color: th.muted });
    if (p.building) { icon(p.building, px + 140, py + 300, 1.3); g.text(t(p.building) + ' — ' + t(p.building + 'd'), px + 170, py + 306, { size: 15 }); return; }
    ['tower', 'fire', 'barn'].forEach(function (k, i) {
      var x = px + 16 + i * 140, cost = L.BUILD[k];
      button('b_' + k, x, py + 278, 130, 52, '', function () { why(L.build(S, p.id, k)); }, { dim: S.supply < cost });
      icon(k, x + 20, py + 306, 1); g.text(t(k), x + 76, py + 300, { size: 13, align: 'center', weight: 700 }); g.text(cost + '', x + 76, py + 320, { size: 14, align: 'center', color: P.amber });
    });
  }

  // ---------- мир ----------
  function drawWorld() {
    var c = g.ctx, ui = { sel: sel, marks: marks, aim: null };
    if (aim && !S.hero.dead && mouse.used && mouse.in) { var w = toWorld(mouse); ui.aim = { x: w.x, y: w.y, r: S.hero.hero.q.r, range: S.hero.hero.q.range }; }
    else if (aim && !S.hero.dead) ui.aim = { x: S.hero.x, y: S.hero.y, r: 6, range: S.hero.hero.q.range };
    if (g.themeName === 'retro') {
      var bw = Math.ceil(g.W / 3), bh = Math.ceil(g.H / 3);
      if (buf.width !== bw || buf.height !== bh) { buf.width = bw; buf.height = bh; }
      bctx.setTransform(1 / 3, 0, 0, 1 / 3, 0, 0); bctx.imageSmoothingEnabled = false;
      RN.world(bctx, S, 'retro', cam, { w: g.W, h: g.H }, ui, g.time);
      c.imageSmoothingEnabled = false; c.drawImage(buf, 0, 0, bw, bh, 0, 0, bw * 3, bh * 3);
    } else RN.world(c, S, 'modern', cam, { w: g.W, h: g.H }, ui, g.time);
    if (gest && gest.k === 'box' && gest.ex != null) { c.strokeStyle = (RN.PAL[g.themeName] || RN.PAL.modern).sel; c.lineWidth = 2; c.setLineDash([6, 4]); c.strokeRect(Math.min(gest.sx, gest.ex), Math.min(gest.sy, gest.ey), Math.abs(gest.ex - gest.sx), Math.abs(gest.ey - gest.sy)); c.setLineDash([]); c.fillStyle = 'rgba(159,243,230,.08)'; c.fillRect(Math.min(gest.sx, gest.ex), Math.min(gest.sy, gest.ey), Math.abs(gest.ex - gest.sx), Math.abs(gest.ey - gest.sy)); }
  }

  // ---------- звук и сообщения по событиям ----------
  function events() {
    var A = g.audio;
    S.events.forEach(function (e) {
      switch (e.e) {
        case 'capture': A.beep(660, 0.08, 'triangle'); A.beep(990, 0.12, 'triangle'); toast(t('msgCapture')); break;
        case 'lost': A.beep(200, 0.25, 'sawtooth'); toast(t('msgLost')); break;
        case 'wave': A.beep(150, 0.3, 'square'); toast(t('msgWave')); break;
        case 'boss': A.beep(90, 0.6, 'sawtooth'); toast(t('msgBoss') + ' ' + t(e.kind), 4); break;
        case 'nest': A.beep(300, 0.2, 'square'); toast(t('msgNest')); break;
        case 'lvl': A.beep(520, 0.08, 'triangle'); A.beep(780, 0.1, 'triangle'); A.beep(1040, 0.14, 'triangle'); toast(t('msgLvl') + ' ' + e.lvl); break;
        case 'herodown': A.beep(160, 0.4, 'sawtooth'); toast(t('msgHeroDown')); break;
        case 'heroup': toast(t('msgHeroUp')); break;
        case 'boom': A.beep(110, 0.18, 'sawtooth'); break;
        case 'ability': A.beep(e.k === 'q' ? 440 : 700, 0.12, 'triangle'); break;
        case 'hire': case 'upgrade': case 'build': A.beep(560, 0.06, 'square'); A.beep(840, 0.08, 'square'); break;
        case 'shot': if (g.time - shotT > 0.09) { shotT = g.time; A.beep(e.side === 0 ? (e.heavy ? 260 : 820) : 360, 0.025, e.ranged ? 'square' : 'triangle'); } break;
      }
    });
    S.events.length = 0;
  }

  // ---------- сцены ----------
  g.menu.addItem({ key: 'play', label: function () { return g.t('play', 'Играть'); }, onSelect: function () { g.state.score = 0; brief.m = Math.min(brief.m, unlocked() - 1); g.goto('brief'); }, index: 0 });
  g.useStandardScreens({ title: 'ГАТЬ', subtitle: 'Гатевая стража против болотной нечисти' });
  g.menu.setHint(function () { return [{ text: g.i18n.lang === 'en' ? 'Light RTS with a hero · 3 missions · touch, mouse, keyboard' : 'Лёгкая стратегия с героем · 3 миссии · тач, мышь, клавиатура', dim: true }]; }, 'title');
  g.menu.addItem({ key: 'restart', label: function () { return g.t('restart', 'Заново'); }, scene: 'pause', before: 'menu', onSelect: function () { setup(S.mi, S.heroIdx); g.goto('play', { keep: true }); } });

  function setHero(i) { brief.h = i; Store.set('arcade.gat.hero', String(i)); }
  function launch() { setup(brief.m, brief.h); g.goto('play', { keep: true }); }
  g.scene('brief', { realtime: true,
    update: function () {},
    draw: function () {
      btns = []; var th = g.th(), W = g.W, P = RN.PAL[g.themeName] || RN.PAL.modern; g.clear();
      g.text(t('brief'), W / 2, 62, { size: 34, align: 'center', color: th.accent });
      g.text(t('pickMission') + ' (1–3)', W / 2, 108, { size: 16, align: 'center', color: th.muted });
      var cw = Math.min(330, (W - 80) / 3), x0 = W / 2 - (cw * 3 + 32) / 2;
      for (var i = 0; i < 3; i++) (function (i) {
        var lock = i >= unlocked(), x = x0 + i * (cw + 16);
        button('m' + i, x, 122, cw, 150, '', function () { if (!lock) brief.m = i; }, { on: brief.m === i && !lock, dim: lock });
        g.text((i + 1) + '. ' + t('m' + (i + 1)), x + 16, 156, { size: 20, color: lock ? th.muted : th.ink });
        wrap(lock ? '🔒 ' + t('locked') : t('m' + (i + 1) + 'd'), x + 16, 186, cw - 32, 15, th.muted);
        var st = +Store.get('arcade.gat.stars.' + (i + 1), '0') || 0; if (st) g.text('★'.repeat(st) + '☆'.repeat(3 - st), x + 16, 258, { size: 18, color: P.amber });
      })(i);
      g.text(t('pickHero') + ' (Q / E)', W / 2, 310, { size: 16, align: 'center', color: th.muted });
      var hw = Math.min(480, (W - 80) / 2), hx = W / 2 - (hw * 2 + 16) / 2;
      [0, 1].forEach(function (k) {
        var x = hx + k * (hw + 16), H0 = L.HEROES[k];
        button('h' + k, x, 324, hw, 170, '', function () { setHero(k); }, { on: brief.h === k });
        icon(H0.kind, x + 52, 400, 2.6);
        g.text(t('hero_' + H0.id), x + 100, 364, { size: 21 });
        wrap(t('hero_' + H0.id + 'd'), x + 100, 394, hw - 120, 15, th.muted);
      });
      button('go', W / 2 - 150, 530, 300, 76, t('go') + ' ▶', launch, { size: 26, on: true });
      button('back', 24, 640, 170, 56, '← ' + t('back'), function () { g.goto('title'); }, { size: 18 });
      g.text('Enter — ' + t('go') + ' · Esc — ' + t('back'), W / 2, 650, { size: 14, align: 'center', color: th.muted, weight: 600 });
    },
    press: function (a) {
      if (a === 'start' || a === 'action') launch();
      else if (a === 'left' || a === 'right') setHero(brief.h ? 0 : 1);
      else if (a === 'up' || a === 'down') { var n = unlocked(); brief.m = (brief.m + (a === 'down' ? 1 : n - 1)) % n; }
      else if (a === 'pause') g.goto('title');
    } });
  function wrap(s, x, y, w, size, color) {
    var c = g.ctx, words = String(s).split(' '), line = '', yy = y; c.font = '600 ' + size + 'px ' + g.th().font;
    words.forEach(function (wd) { var tt = line ? line + ' ' + wd : wd; if (c.measureText(tt).width > w && line) { g.text(line, x, yy, { size: size, color: color, weight: 600 }); line = wd; yy += size + 6; } else line = tt; });
    if (line) g.text(line, x, yy, { size: size, color: color, weight: 600 });
  }

  g.scene('play', { realtime: true,
    enter: function (d) { if (d && (d.resume || d.keep)) return; if (!S) setup(brief.m, brief.h); },
    update: function (dt) {
      if (!S) return;
      playT += dt;
      var dir = g.input.dir; if (dir.x || dir.y) { cam.x += dir.x * 620 * dt / cam.z; cam.y += dir.y * 620 * dt / cam.z; clampCam(); }
      acc += Math.min(dt, 0.1);
      while (acc >= STEP) { acc -= STEP; if (bot) bot.update(STEP); L.step(S, STEP); events(); }
      marks.forEach(function (m) { m.t += dt; }); marks = marks.filter(function (m) { return m.t < 0.6; });
      toasts.forEach(function (o) { o.t += dt; }); toasts = toasts.filter(function (o) { return o.t < o.d; });
      if (S.result) { endT += dt; if (endT > 1.6) finish(); }
    },
    draw: function () {
      btns = []; if (!S) { g.clear(); return; }
      drawWorld(); drawHud();
      if (S.result) { var th = g.th(); g.ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.5, endT / 2) + ')'; g.ctx.fillRect(0, 0, g.W, g.H); g.text(S.result === 'win' ? t('win1') : t('lose1'), g.W / 2, g.H / 2, { size: 44, align: 'center', color: S.result === 'win' ? th.good : th.bad }); }
    },
    press: function (a) {
      if (a === 'pause') { if (aim) { aim = null; return; } if (panel) { panel = null; return; } g.pause(); }
      else if (a === 'action') selectAll();
    } });
  // мини-карта: тап/клик/протяжка двигает камеру
  canvas.addEventListener('pointerdown', function (e) { if (g._sceneName !== 'play' || !gest || gest.k !== 'btn' || gest.b.id !== 'mini') return; miniMove(toLogical(e)); gest.mini = true; });
  canvas.addEventListener('pointermove', function (e) { if (gest && gest.k === 'btn' && gest.b.id === 'mini' && ptrs.has(e.pointerId)) miniMove(toLogical(e)); });
  function miniMove(p) { var b = btns.filter(function (x) { return x.id === 'mini'; })[0]; if (!b) return; var TL = L.TILE; centerOn((p.x - b.x) / b.w * S.map.w * TL, (p.y - b.y) / b.h * S.map.h * TL); }

  function finish() {
    var win = S.result === 'win', st = L.stars(S), mi = S.mi;
    g.state.score += S.stats.kills * 10 + (win ? 300 * st + 200 * (mi + 1) : 0);
    if (win) { Store.set('arcade.gat.progress', String(Math.max(unlocked(), Math.min(3, mi + 2)))); var old = +Store.get('arcade.gat.stars.' + (mi + 1), '0') || 0; if (st > old) Store.set('arcade.gat.stars.' + (mi + 1), String(st)); }
    g.saveBest();
    debrief = { win: win, stars: st, mi: mi, t: S.t, kills: S.stats.kills, lost: S.stats.lost, hero: S.heroIdx };
    g.goto('debrief');
  }
  function later(fn) { setTimeout(fn, 80); } // чтобы «click» после pointerup не нажал пункт меню движка
  g.scene('debrief', { realtime: true, update: function () {},
    draw: function () {
      btns = []; var th = g.th(), W = g.W, P = RN.PAL[g.themeName] || RN.PAL.modern, D = debrief; g.clear();
      g.text(D.win ? t('win1') : t('lose1'), W / 2, 150, { size: 44, align: 'center', color: D.win ? th.good : th.bad });
      g.text((D.mi + 1) + '. ' + t('m' + (D.mi + 1)) + ' · ' + t('hero_' + L.HEROES[D.hero].id), W / 2, 196, { size: 18, align: 'center', color: th.muted });
      if (D.win) g.text('★'.repeat(D.stars) + '☆'.repeat(3 - D.stars), W / 2, 262, { size: 46, align: 'center', color: P.amber });
      g.text(t('time') + ' ' + fmt(D.t) + '   ' + t('kills') + ' ' + D.kills + '   ' + t('losses') + ' ' + D.lost + '   ' + t('score') + ' ' + g.state.score, W / 2, 320, { size: 20, align: 'center' });
      var bw = 230, y = 400;
      if (D.win) button('next', W / 2 - bw * 1.5 - 20, y, bw, 70, t('next') + ' ▶', next, { on: true, size: 22 });
      button('retry', W / 2 - bw / 2, y, bw, 70, t('retry'), function () { brief.m = D.mi; launch(); }, { size: 22, on: !D.win });
      button('tomenu', W / 2 + bw / 2 + 20, y, bw, 70, t('menu'), function () { later(function () { g.goto('title'); }); }, { size: 22 });
      g.text('Enter — ' + (D.win ? t('next') : t('retry')) + ' · Esc — ' + t('menu'), W / 2, 520, { size: 14, align: 'center', color: th.muted, weight: 600 });
    },
    press: function (a) { if (a === 'start' || a === 'action') { if (debrief.win) next(); else { brief.m = debrief.mi; launch(); } } else if (a === 'pause') g.goto('title'); } });
  function next() { if (debrief.mi >= 2) { later(function () { g.win(); }); return; } brief.m = debrief.mi + 1; g.goto('brief'); }

  // тема страницы следует теме движка
  var lastTheme = '';
  (function sync() { if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', g.themeName); } requestAnimationFrame(sync); })();
  var bP = document.getElementById('bPause');
  if (bP) bP.addEventListener('click', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

  // ---------- отладка/тесты ----------
  GAT.debug = {
    get S() { return S; }, get sel() { return Array.from(sel); }, get cam() { return cam; }, get panel() { return panel; }, get aim() { return aim; }, g: g,
    advance: function (sec) { var n = Math.round(sec / STEP); for (var i = 0; i < n && S && !S.result; i++) { if (bot) bot.update(STEP); L.step(S, STEP); events(); } },
    bot: function (on) { bot = on ? GAT.makeBot(S, 5) : null; },
    screen: function (wx, wy) { var r = canvas.getBoundingClientRect(); return { x: r.left + (wx - cam.x) * cam.z * r.width / g.W, y: r.top + (wy - cam.y) * cam.z * r.height / g.H }; },
    btn: function (id) { var b = btns.filter(function (x) { return x.id === id; })[0]; if (!b) return null; var r = canvas.getBoundingClientRect(); return { x: r.left + (b.x + b.w / 2) * r.width / g.W, y: r.top + (b.y + b.h / 2) * r.height / g.H }; },
    centerOn: centerOn,
  };

  layout();
  g.start('title');
  var qm = +Q.get('mission');
  if (qm >= 1 && qm <= 3) { brief.m = qm - 1; if (Q.get('hero')) setHero(Q.get('hero') === 'z' ? 1 : 0); launch(); }
})();
