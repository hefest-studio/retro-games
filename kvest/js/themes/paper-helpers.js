/* МАЯЧНИЦА · themes/paper-helpers.js — расширение темы «бумага» для движка помощников (глава 3+), подключается после paper.js.
   Через paper._ext (тот же «станок» вырезок, кэш спрайтов и палитры) добавляет:
   — помощников в отряде: пёс Вьюн (песочно-серый, тёмное ухо, белая грудь, красный платок) и чайка Кира (белая, серые крылья
     с тёмными кончиками, жёлтый клюв с красной точкой, бирюзовое колечко на лапке — её узнают с главы 1); позы — см. theme-api HELPER_POSES;
   — портреты-переключатели героев над сценой (активный — крупнее, с охристым ободком; держит — значок «держать»; умение — значок);
   — метку активного героя (бумажный флажок над головой, когда героев в сцене больше одного);
   — kind движка помощников: windmill, vane, millstone, millgear, telescope, shutter, mound, crate, nest, burrow, bollard, ropebridge, npc tern;
     tower.state.dome — башня с куполом, house.state.glass — теплица, wall.state.dome — рёбра купола изнутри, gate.state.grille — решётка-заслонка;
   — палитры: isle (ветреный день у моря), cliffs (светлые скалы), orchard (пасмурный сад), hilltop (холм под вечер),
     millroom (деревянный интерьер), domeroom (каменный купол). След пса и обзор чайки рисует ink-sketch.js (тушью). */
(function (global) {
  'use strict';
  var KV = global.KVEST = global.KVEST || {}, th = KV.themes && KV.themes.paper; if (!th || !th._ext || th._helpers) return; th._helpers = true;
  var X = th._ext, C = X.C, K = X.K, LIVE = X.LIVE, NPC = X.NPC, TAU = Math.PI * 2;
  var cut = X.cut, flat = X.flat, poly = X.poly, ell = X.ell, rectP = X.rectP, rrP = X.rrP, lump = X.lump, rotP = X.rotP, band = X.band;
  var Rig = X.Rig, M = X.M, tr = X.tr, ro = X.ro, pin = X.pin, q12 = X.q12, actor = X.actor, sprite = X.sprite, blit = X.blit, addGlow = X.addGlow;
  var strokeL = X.strokeL, stitch = X.stitch, brad = X.brad, ghostIcon = X.ghostIcon, gearPtsP = X.gearPtsP, starPts = X.starPts;
  var drawIcon = X.drawIcon, drawIconRaw = X.drawIconRaw, dark = X.dark, light = X.light, rng = X.rng, clamp = X.clamp;

  // ---------- палитры ----------
  var P = X.PALS;
  P.isle = { bands: ['#8fb8c8', '#a8cad2', '#c6dbd6', '#e2e8d8'], bandY: [0, 90, 170, 236], sun: '#f4d98a', sunY: 110, sunX: 830,
    hillFar: '#a3b59a', hillNear: '#7e9a6a', grass: '#7c9450', earth: '#c9ad7c', sand: '#d6bf8e', cloud: '#fbf6ea', cloudB: '#dfe6e4', water: '#5a93a0',
    glow: '255,220,150', tint: null, fog: 0.1, rock: '#9a948a', rockL: '#b6b0a4' };
  P.cliffs = { bands: ['#7fb0c6', '#9fc4d2', '#c2d9da', '#e0e8de'], bandY: [0, 96, 176, 240], sun: '#f6e2a2', sunY: 90, sunX: 160,
    hillFar: '#b8bfae', hillNear: '#8d9a80', grass: '#7e8f55', earth: '#b8a68a', sand: '#d2c4a4', cloud: '#fbf8f0', cloudB: '#dde6e8', water: '#4f8a9c',
    glow: '255,220,150', tint: null, fog: 0.06, rock: '#c9c3b5', rockL: '#e2ddd0' };
  P.orchard = { bands: ['#b4c1b6', '#c6d0c0', '#d6dbc8', '#e4e2cf'], bandY: [0, 110, 190, 250], sun: null,
    hillFar: '#93a57a', hillNear: '#6f8a4e', field1: '#b8b074', field2: '#94a46a', grass: '#5f7d3a', earth: '#9b7a52', cloud: '#eeeadc', cloudB: '#cdd2c6', water: '#6f9393',
    glow: '255,214,150', tint: null, fog: 0.04, rock: '#8f8a7c', rockL: '#aaa596' };
  P.hilltop = { bands: ['#7d8fb0', '#a69bb0', '#d6ab92', '#efcd9c'], bandY: [0, 90, 165, 232], sun: '#f0a85a', sunY: 228, sunX: 190,
    hillFar: '#8d8a86', hillNear: '#5e6a52', grass: '#647a44', earth: '#a3825c', cloud: '#f4dcc0', cloudB: '#c7a8a8', water: '#5d7590',
    glow: '255,190,110', tint: 'rgba(80,50,30,0.05)', fog: 0.22, rock: '#857a70', rockL: '#a39484' };
  P.millroom = { bands: ['#4a3a2a'], wall: ['#b99f78', '#ae9470', '#c2a882', '#a98f6a'], wallD: '#7e6648', floor: ['#8a7254', '#816a4e', '#93795b'], floorD: '#5f4c36',
    win: 'sea', glow: '255,214,150', tint: null, vign: 'rgba(40,24,10,0.38)' };
  P.domeroom = { bands: ['#232838'], wall: ['#5d6478', '#565d70', '#666d82', '#50566a'], wallD: '#3c4152', floor: ['#4f4c55', '#48454e', '#57545d'], floorD: '#36343b',
    win: 'night', glow: '255,210,140', tint: 'rgba(20,30,70,0.08)', vign: 'rgba(10,12,30,0.5)', stone: true };
  X.INDOOR.millroom = 1; X.INDOOR.domeroom = 1;
  X.ANIM_BREAK.windmill = 1;   // мельница в слое — живая (крылья)

  // ---------- рамки спрайтов новых kind ----------
  X.BOX_EXT.push(function (it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {};
    switch (it.kind) {
      case 'windmill': if (st.still) { var Rw = w * 1.12 + 20, hx = x + w / 2, hy = y + h * 0.17; return [Math.min(x - 40, hx - Rw), hy - Rw, Math.max(w + 80, Rw * 2), Math.max(h + 70, y + h + 20 - (hy - Rw))]; } return [x - 40, y - 50, w + 80, h + 70];
      case 'vane': return [x - 40, y - 30, w + 80, h + 50];
      case 'telescope': return [x - 40, y - 60, w + 80, h + 90];
      case 'shutter': return [x - 30, y - 20, w + 60, h + 240];
      case 'ropebridge': return [x - 20, y - 30, w + 40, h + 110];
      case 'millgear': return [x - 30, y - 30, w + 60, h + 60];
      case 'tower': if (st.dome) return [x - w * 0.6, y - 40, w * 2.2, h + 60]; break;
      case 'house': if (st.glass) return [x - 20, y - 30, w + 40, h + 50]; break;
      case 'gate': if (st.grille) return [x - 20, y - h - 40, w + 40, h * 2 + 60]; break;
      case 'wall': if (st.dome) return [-10, -10, 980, (it.y || 0) + it.h + 20]; break;
    }
    return null;
  });

  // ================= kind движка помощников =================
  // мельница: деревянная башня-шатёр, колпак, дверь; крылья — живые (LIVE.windmill)
  function hubOf(it) { return [it.x + it.w / 2, it.y + it.h * 0.17]; }
  K.windmill = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2, R = rng(it.seed || 5);
    var body = [[x + w * 0.12, y + h], [x + w * 0.88, y + h], [x + w * 0.72, y + h * 0.2], [x + w * 0.28, y + h * 0.2]];
    var b = cut(g, body, '#d9c39a', { seed: 9000, lift: 6, sh: 0.32 });
    g.save(); poly(g, b); g.clip();
    for (var i = 0; i < 9; i++) { var yy = y + h * 0.2 + i * h * 0.09; strokeL(g, [[x, yy], [x + w, yy + 2]], 'rgba(90,60,30,0.28)', 1.4); }
    flat(g, [[cx + w * 0.06, y + h * 0.2], [x + w * 0.72, y + h * 0.2], [x + w * 0.88, y + h], [cx + w * 0.12, y + h]], 'rgba(60,40,30,0.13)');
    g.restore();
    cut(g, [[x + w * 0.2, y + h * 0.22], [cx, y - h * 0.02], [x + w * 0.8, y + h * 0.22]], C.rustD, { seed: 9001, lift: 4 });   // колпак
    cut(g, rectP(x + w * 0.18, y + h * 0.2, w * 0.64, 8), C.brown, { seed: 9002, lift: 2 });
    var dw = w * 0.3, dh = h * 0.26, dx = cx - dw / 2, dy = y + h - dh;
    cut(g, rrP(dx - 5, dy - 5, dw + 10, dh + 5, 8), C.dbrown, { seed: 9003, lift: 2.5 });
    if (st.open) cut(g, rrP(dx, dy, dw, dh, 6), '#2a1c12', { seed: 9004, lift: 0 });
    else { cut(g, rrP(dx, dy, dw, dh, 6), '#8a6040', { seed: 9004, lift: 1.5 }); brad(g, dx + dw * 0.78, dy + dh * 0.55, 2.4); }
    if (st.sand) cut(g, ell(cx, y + h, dw * 0.8, dh * 0.42, 22, Math.PI, TAU), '#d6bf8e', { seed: 9006, lift: 2, sh: 0.25 });   // дверь занесло песком
    cut(g, ell(cx, y + h * 0.42, 9, 11, 14), '#3e4f57', { seed: 9007, lift: 1.5 });
    for (var r2 = 0; r2 < 3; r2++) cut(g, ell(x + w * (0.25 + R() * 0.5), y + h * (0.5 + R() * 0.3), 4, 2.5, 8), '#b9a27e', { seed: 9010 + r2, lift: 0.6, raw: true });
    brad(g, hubOf(it)[0], hubOf(it)[1], 5);
    if (st.still) { var hb = hubOf(it); g.save(); g.translate(hb[0], hb[1]); g.rotate(0.35); blit(g, sailsSprite(w * 1.12, st.full ? 4 : st.sails == null ? 4 : st.sails)); g.restore(); }
  };
  function sailsSprite(Rr, n) {
    return sprite('mill-sails|' + Math.round(Rr) + '|' + n, -Rr - 14, -Rr - 14, Rr * 2 + 28, Rr * 2 + 28, function (g) {
      for (var a = 0; a < 4; a++) {
        var ang = a * Math.PI / 2, m = function (p) { return rotP(p, 0, 0, ang); };
        cut(g, m([[-3, -4], [Rr, -4], [Rr, 4], [-3, 4]]), '#6b4630', { seed: 9100 + a, lift: 3, raw: true });   // махи
        var sx0 = Rr * 0.22, sw = Rr * 0.78, sh2 = Rr * 0.3;
        if (a < n) cut(g, m([[sx0, 5], [sx0 + sw, 5], [sx0 + sw, 5 + sh2], [sx0, 5 + sh2 * 0.8]]), '#efe5cc', { seed: 9110 + a, lift: 2, sh: 0.25 });
        else { g.save(); g.globalAlpha = 0.9; for (var k = 0; k <= 4; k++) strokeL(g, m([[sx0 + k * sw / 4, 5], [sx0 + k * sw / 4, 5 + sh2]]), '#7a5a3a', 1.6); strokeL(g, m([[sx0, 5 + sh2 * 0.5], [sx0 + sw, 5 + sh2 * 0.5]]), '#7a5a3a', 1.4); g.restore(); var gc = m([[sx0 + sw * 0.5, 5 + sh2 * 0.5]])[0]; ghostIcon(g, 'sail', gc[0], gc[1], 24); }
        for (var l = 1; l < 5; l++) strokeL(g, m([[sx0 + l * sw / 5, 5], [sx0 + l * sw / 5, 5 + sh2 * (a < n ? 1 : 0.9)]]), 'rgba(110,80,50,0.45)', 1);
      }
      cut(g, ell(0, 0, 9, 9, 16), C.dbrown, { seed: 9120, lift: 2 });
    });
  }
  LIVE.windmill = function (ctx, it, t) {
    var st = it.state || {}; if (st.still) return;
    var h = hubOf(it), Rr = it.w * 1.12, n = st.full ? 4 : st.sails == null ? 4 : st.sails, s = sailsSprite(Rr, n);
    var ang = st.turn ? t * 1.7 : 0.35 + (st.brake ? 0 : Math.sin(t * 1.3) * 0.02);
    ctx.save(); ctx.translate(h[0], h[1]); ctx.rotate(ang); blit(ctx, s); ctx.restore();
    brad(ctx, h[0], h[1], 4);
  };
  // флюгер: шест, роза стрелок; стрелка — живая, смотрит туда, откуда дует (state.west — на запад)
  K.vane = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, cx = x + w / 2;
    cut(g, rectP(cx - 3, y + 26, 6, h - 26), C.iron, { seed: 9200, lift: 2.5 });
    cut(g, rectP(cx - w * 0.38, y + 40, w * 0.76, 4), C.ironL, { seed: 9201, lift: 1.2, raw: true });
    cut(g, ell(cx - w * 0.38, y + 42, 5, 5, 10), '#c0442e', { seed: 9202, lift: 1 }); cut(g, ell(cx + w * 0.38, y + 42, 5, 5, 10), '#4f7472', { seed: 9203, lift: 1 });
    cut(g, ell(cx, y + h, 14, 5, 14), C.stoneD, { seed: 9204, lift: 2 });
  };
  function vaneArrow(len) {
    return sprite('vane-arrow|' + Math.round(len), -len / 2 - 14, -20, len + 28, 40, function (g) {
      cut(g, rectP(-len / 2, -2, len, 4), C.iron, { seed: 9210, lift: 2, raw: true });
      cut(g, [[-len / 2 - 12, 0], [-len / 2 + 6, -10], [-len / 2 + 6, 10]], C.brass, { seed: 9211, lift: 2 });   // остриё — откуда ветер
      cut(g, [[len / 2 - 4, 0], [len / 2 + 12, -14], [len / 2 + 8, 0], [len / 2 + 12, 14]], '#efe5cc', { seed: 9212, lift: 2 });   // хвост-перо
      brad(g, 0, 0, 3);
    });
  }
  LIVE.vane = function (ctx, it, t) {
    var st = it.state || {}, cx = it.x + it.w / 2, y = it.y + 22, d = st.west ? 1 : -1, wob = st.stuck ? 0 : Math.sin(t * 3.1) * 0.05 + Math.sin(t * 7.3) * 0.02;
    ctx.save(); ctx.translate(cx, y); ctx.scale(d, 1); ctx.rotate(wob); blit(ctx, vaneArrow(it.w * 0.9)); ctx.restore();
  };
  // жернов: два камня и ковш; на камне — линза (шлифуется)
  K.millstone = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, cx = x + w / 2, by = y + h, st = it.state || {};
    cut(g, rectP(x - 6, by - 26, w + 12, 26), '#6b4e38', { seed: 9300, lift: 3 });
    cut(g, ell(cx, by - 32, w * 0.5, 14, 30), C.stoneD, { seed: 9301, lift: 3 });
    cut(g, ell(cx, by - 44, w * 0.48, 14, 30), C.stone, { seed: 9302, lift: 2.5 });
    cut(g, [[cx - 30, y], [cx + 30, y], [cx + 8, y + 34], [cx - 8, y + 34]], '#a8794c', { seed: 9303, lift: 3 });   // ковш
    cut(g, rectP(cx - 3, y + 34, 6, h - 80), '#6b4630', { seed: 9304, lift: 1.5, raw: true });
    if (st.still && (st.lens || st.done)) drawIconRaw(g, st.done ? 'lens' : 'lens_dirty', cx + 18, by - 50, 30);
  };
  LIVE.millstone = function (ctx, it, t) {
    var st = it.state || {}, cx = it.x + it.w / 2, cy = it.y + it.h - 44, a = st.turn ? t * 2.2 : 0;
    ctx.save(); ctx.strokeStyle = 'rgba(70,60,50,0.55)'; ctx.lineWidth = 1.4;
    for (var k = 0; k < 6; k++) { var an = a + k * TAU / 6; ctx.beginPath(); ctx.moveTo(cx + Math.cos(an) * 8, cy + Math.sin(an) * 2.4); ctx.lineTo(cx + Math.cos(an) * it.w * 0.44, cy + Math.sin(an) * 12); ctx.stroke(); }
    ctx.restore();
    if ((st.lens || st.done) && !st.still) { var lb = Math.sin(a * 2) * 2; drawIcon(ctx, st.done ? 'lens' : 'lens_dirty', cx + Math.cos(a) * 18, cy - 6 + lb * 0.3, 30); if (st.turn && st.lens && !st.done) addGlow(ctx, cx, cy - 6, 40, '255,236,180', 0.25 + 0.15 * Math.sin(t * 9)); }
    if (st.turn) for (var p = 0; p < 5; p++) { var f = (t * 0.7 + p / 5) % 1; ctx.fillStyle = 'rgba(250,246,236,' + (0.6 * (1 - f)) + ')'; ctx.beginPath(); ctx.arc(cx - it.w * 0.45 + p * it.w * 0.22, cy + 10 - f * 40, 2 + f * 3, 0, TAU); ctx.fill(); }   // мучная пыль
  };
  // передача мельницы: стойки и вал; колесо с зубцами — живое (вертится); без зубца — пунктирное гнездо
  K.millgear = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, cx = x + w / 2;
    cut(g, rectP(x, y + h - 20, w, 20), '#5d402c', { seed: 9400, lift: 3 });
    cut(g, rectP(x + 6, y + 10, 12, h - 20), '#6b4630', { seed: 9401, lift: 3 }); cut(g, rectP(x + w - 18, y + 10, 12, h - 20), '#6b4630', { seed: 9402, lift: 3 });
    cut(g, rectP(cx - 6, -10, 12, y + h * 0.45 + 10), '#7a5a3c', { seed: 9403, lift: 3 });   // вертикальный вал сверху
    var st = it.state || {}; if (st.still) { g.save(); g.translate(cx, y + h * 0.45); blit(g, wheelSprite(Math.min(w, h) * 0.36, !!st.cog)); g.restore(); }
  };
  function wheelSprite(r, cog) {
    return sprite('millwheel|' + Math.round(r) + '|' + (cog ? 1 : 0), -r - 16, -r - 16, r * 2 + 32, r * 2 + 32, function (g) {
      cut(g, ell(0, 0, r, r, 40), '#9a7046', { seed: 9410, lift: 4, sh: 0.4 });
      cut(g, ell(0, 0, r * 0.78, r * 0.78, 36), '#b48a5c', { seed: 9411, lift: 1 });
      for (var s = 0; s < 4; s++) cut(g, rotP(rectP(-r * 0.76, -4, r * 1.52, 8), 0, 0, s * Math.PI / 4), '#7a5636', { seed: 9412 + s, lift: 1.5, raw: true });
      for (var k = 0; k < 16; k++) { if (!cog && k === 3) continue; var a = k * TAU / 16; cut(g, rotP(rectP(r - 2, -5, 14, 10), 0, 0, a), '#6b4630', { seed: 9420 + k, lift: 1.5, raw: true }); }
      if (!cog) { var ga = 3 * TAU / 16; ghostIcon(g, 'gear', Math.cos(ga) * (r + 6), Math.sin(ga) * (r + 6), 22); }
      brad(g, 0, 0, 6);
    });
  }
  LIVE.millgear = function (ctx, it, t) {
    var st = it.state || {}; if (st.still) return;
    var cx = it.x + it.w / 2, cy = it.y + it.h * 0.45, r = Math.min(it.w, it.h) * 0.36, a = st.turn ? t * 1.1 : (st.brake ? 0 : 0.05 * Math.sin(t * 2));
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(a); blit(ctx, wheelSprite(r, !!st.cog)); ctx.restore();
    if (st.brake) { cut(ctx, rectP(cx + r - 6, cy - 22, 16, 44), C.red, { live: true, lift: 2, seed: 9430 }); drawIcon(ctx, 'hold', cx + r + 2, cy - 36, 22); }
  };
  // телескоп: латунная труба на тумбе; объектив и окуляр — гнёзда, пока их нет
  K.telescope = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, bx = x + w * 0.42, by = y + h * 0.62, a = st.aim ? -0.78 : -0.42, L = w * 0.95;
    cut(g, [[bx - 34, y + h], [bx + 34, y + h], [bx + 16, by + 6], [bx - 16, by + 6]], '#5a4a3c', { seed: 9500, lift: 4 });
    cut(g, rectP(bx - 44, y + h - 10, 88, 10), '#4a3c30', { seed: 9501, lift: 2 });
    var tube = rotP([[bx - L * 0.4, by - 13], [bx + L * 0.6, by - 18], [bx + L * 0.6, by + 18], [bx - L * 0.4, by + 13]], bx, by, a);
    cut(g, tube, C.brass, { seed: 9502, lift: 4, sh: 0.4 });
    for (var r = 0; r < 4; r++) { var f = -0.3 + r * 0.28; cut(g, rotP(rectP(bx + L * f - 3, by - 18, 6, 36), bx, by, a), '#8e6e2a', { seed: 9503 + r, lift: 1, raw: true }); }
    var front = rotP([[bx + L * 0.6, by]], bx, by, a)[0], back = rotP([[bx - L * 0.42, by]], bx, by, a)[0];
    if (st.lens) { cut(g, ell(front[0], front[1], 12, 18, 18).map(function (q) { return rotP([q], front[0], front[1], a)[0]; }), '#e2f1f4', { seed: 9510, lift: 1.5 }); }
    else ghostIcon(g, 'lens', front[0] + 6, front[1] - 8, 28);
    if (st.eye) cut(g, rotP(rectP(back[0] - 16, back[1] - 7, 18, 14), back[0], back[1], a), '#4a423b', { seed: 9511, lift: 2 });
    else ghostIcon(g, 'eyepiece', back[0] - 14, back[1] + 6, 26);
    brad(g, bx, by, 5);
  };
  LIVE.telescope = function (ctx, it, t) { var st = it.state || {}; if (st.lens && st.eye && st.aim) addGlow(ctx, it.x + it.w * 0.9, it.y + it.h * 0.1, 60, '200,220,255', 0.18 + 0.06 * Math.sin(t * 2)); };
  // прорезь купола: закрыта — створки из досок; открыта — ночное небо с туманом; верёвка — спущена вниз или под куполом
  K.shutter = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2;
    cut(g, rectP(x - 12, y - 6, w + 24, h + 12), '#3c4152', { seed: 9600, lift: 3 });
    if (st.open) {
      flat(g, rectP(x, y, w, h), '#1c2338'); var R = rng(9601);
      for (var s = 0; s < 9; s++) { g.fillStyle = 'rgba(245,235,200,0.85)'; g.beginPath(); g.arc(x + 6 + R() * (w - 12), y + 6 + R() * h * 0.6, 1 + R() * 1.4, 0, TAU); g.fill(); }
      cut(g, rectP(x - 4, y + h * 0.72, w + 8, h * 0.3), '#c9cfd2', { seed: 9602, torn: true, lift: 1, rim: '#eef0ec' });   // полоса тумана
      cut(g, rectP(x - 8, y - h * 0.4, w + 16, h * 0.42), '#4f5568', { seed: 9603, lift: 4 });   // створка поднята
    } else {
      for (var b = 0; b < 3; b++) cut(g, rectP(x + 2 + b * (w - 4) / 3, y, (w - 4) / 3 - 2, h), b % 2 ? '#5d6478' : '#666d82', { seed: 9604 + b, lift: 1.5 });
      cut(g, rectP(x, y + h * 0.5 - 4, w, 8), C.iron, { seed: 9607, lift: 1.5 });
    }
    var rope = st.rope ? [[cx + w * 0.3, y + 8], [cx + w * 0.32, y + h + 120], [cx + w * 0.3, y + h + 196]] : [[cx + w * 0.3, y + 8], [cx + w * 0.36, y + 34], [cx + w * 0.42, y + 20]];
    cut(g, band(rope, 4), '#d9c18e', { seed: 9608, lift: 1.5, raw: true });
    if (st.rope) cut(g, ell(rope[2][0], rope[2][1] + 6, 6, 8, 12), '#c49a64', { seed: 9609, lift: 1.5 });
    else cut(g, ell(rope[2][0] + 4, rope[2][1] + 4, 10, 6, 12), '#d9c18e', { seed: 9609, lift: 1.5 });
  };
  LIVE.shutter = function (ctx, it, t) { var st = it.state || {}; if (!st.open) return; ctx.save(); ctx.globalCompositeOperation = 'lighter'; var gx = it.x + it.w / 2, gr = ctx.createLinearGradient(gx, it.y, gx, it.y + it.h + 260); gr.addColorStop(0, 'rgba(170,190,240,0.22)'); gr.addColorStop(1, 'rgba(170,190,240,0)'); ctx.fillStyle = gr; poly(ctx, [[it.x, it.y], [it.x + it.w, it.y], [it.x + it.w + 70, it.y + it.h + 260], [it.x - 70, it.y + it.h + 260]]); ctx.fill(); ctx.restore(); };
  // холмик песка/земли; разрыт — яма с отвалом
  K.mound = function (g, it, sc, P0) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2, by = y + h, earth = (P0 && (P0.sand || P0.earth)) || '#c9ad7c';
    if (st.dug) {
      cut(g, lump(cx - w * 0.42, by - 8, w * 0.22, 9700, 4, 0.3), dark(earth, 0.1), { seed: 9701, lift: 2 }); cut(g, lump(cx + w * 0.44, by - 7, w * 0.2, 9702, 4, 0.3), dark(earth, 0.08), { seed: 9703, lift: 2 });
      cut(g, ell(cx, by - 6, w * 0.32, 8, 20), '#3a2a1e', { seed: 9704, lift: 0 });
    } else {
      cut(g, ell(cx, by - h * 0.3, w * 0.5, h * 0.42, 24, Math.PI, TAU).concat([[cx + w * 0.5, by], [cx - w * 0.5, by]]), light(earth, 0.08), { seed: 9705 + (it.seed || 0), lift: 3, sh: 0.3 });
      for (var k = 0; k < 4; k++) cut(g, ell(cx - w * 0.3 + k * w * 0.2, by - h * 0.25 - (k % 2) * 4, 3, 2, 8), dark(earth, 0.25), { seed: 9710 + k, lift: 0.5, raw: true });
    }
  };
  // ящик, обвязанный верёвкой с узлом; развязан — крышка откинута
  K.crate = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {};
    cut(g, rectP(x, y + 10, w, h - 10), '#a87e52', { seed: 9800, lift: 4, sh: 0.35 });
    for (var b = 1; b < 4; b++) strokeL(g, [[x + 2, y + 10 + b * (h - 10) / 4], [x + w - 2, y + 10 + b * (h - 10) / 4]], 'rgba(70,45,25,0.45)', 1.4);
    cut(g, band([[x + 4, y + 12], [x + w - 4, y + h - 4]], 7), '#8a6040', { seed: 9801, lift: 1, raw: true });
    if (st.open) {
      cut(g, rectP(x + 4, y + 8, w - 8, 10), '#2a1c12', { seed: 9802, lift: 0 });
      cut(g, rotP(rectP(x - 6, y - 16, w + 4, 12), x - 6, y - 4, -0.55), '#b88a58', { seed: 9803, lift: 3 });
      if (!st.empty) drawIconRaw(g, 'sail', x + w / 2, y + 6, 34);
      cut(g, band([[x - 20, y + h], [x - 6, y + h - 6], [x + 10, y + h + 2]], 4), '#d9c18e', { seed: 9804, lift: 1, raw: true });
    } else {
      cut(g, rectP(x - 4, y, w + 8, 12), '#b88a58', { seed: 9805, lift: 3 });
      cut(g, band([[x + w * 0.3, y - 2], [x + w * 0.3, y + h]], 4), '#d9c18e', { seed: 9806, lift: 1.5, raw: true }); cut(g, band([[x - 2, y + h * 0.55], [x + w + 2, y + h * 0.55]], 4), '#d9c18e', { seed: 9807, lift: 1.5, raw: true });
      cut(g, ell(x + w * 0.3, y + h * 0.55, 8, 7, 12), '#c9ae74', { seed: 9808, lift: 2 }); cut(g, band([[x + w * 0.3, y + h * 0.55], [x + w * 0.38, y + h + 14]], 4), '#d9c18e', { seed: 9809, lift: 1.5, raw: true });   // узел и хвост верёвки
    }
  };
  // гнездо на уступе: птенец, блестящее стёклышко
  K.nest = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2, by = y + h;
    if (st.shiny && !st.empty) drawIconRaw(g, 'lens_dirty', cx + w * 0.15, by - h * 0.62, Math.min(30, w * 0.5));
    cut(g, ell(cx, by - h * 0.32, w * 0.5, h * 0.34, 22, 0, Math.PI).concat([[cx - w * 0.5, by - h * 0.32]]), '#9a7046', { seed: 9900 + (it.seed || 0), lift: 3 });
    for (var k = 0; k < 7; k++) strokeL(g, [[x + 4 + k * w / 7, by - h * 0.3], [x + 10 + k * w / 7, by - h * 0.05]], '#6b4630', 1.4);
    if (st.chick) drawIconRaw(g, 'chick', cx - w * 0.12, by - h * 0.55, Math.min(34, w * 0.5));
  };
  // лаз под забором
  K.burrow = function (g, it, sc, P0) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2, by = y + h, earth = (P0 && P0.earth) || '#9b7a52';
    if (st.open) { cut(g, ell(cx, by - 2, w * 0.46, h * 0.6, 22, Math.PI, TAU), '#24160e', { seed: 9950, lift: 0 }); cut(g, lump(cx + w * 0.62, by - 4, w * 0.24, 9951, 4, 0.3), earth, { seed: 9952, lift: 2 }); }
    else { cut(g, ell(cx, by - 2, w * 0.46, h * 0.5, 22, Math.PI, TAU), dark(earth, 0.2), { seed: 9953, lift: 1 }); for (var k = 0; k < 3; k++) cut(g, ell(cx - 10 + k * 10, by - h * 0.3, 2.5, 2, 6), '#3a2a20', { seed: 9954 + k, lift: 0, raw: true }); }
  };
  // причальная тумба; привязана — петли верёвки
  K.bollard = function (g, it) {
    var x = it.x, y = it.y, w = it.w, h = it.h, st = it.state || {}, cx = x + w / 2;
    cut(g, rrP(x, y + 6, w, h - 6, 6), '#6b4630', { seed: 9960, lift: 3 }); cut(g, ell(cx, y + 8, w * 0.6, 6, 16), '#8a6448', { seed: 9961, lift: 2 });
    if (st.tied) { for (var k = 0; k < 3; k++) cut(g, band([[x - 2, y + 18 + k * 7], [x + w + 2, y + 22 + k * 7]], 4), '#d9c18e', { seed: 9962 + k, lift: 1, raw: true }); cut(g, band([[x, y + 24], [x - 60, y + 20]], 4), '#d9c18e', { seed: 9966, lift: 1, raw: true }); }
  };
  // верёвочный мостик: натянут — ровный настил; провис — дуга, доски висят вкривь
  K.ropebridge = function (g, it) {
    var x = it.x, y = it.y, w = it.w, st = it.state || {}, sag = st.taut ? 6 : 64, n = 11, rope = [], rope2 = [];
    for (var i = 0; i <= 20; i++) { var f = i / 20, s = Math.sin(f * Math.PI) * sag; rope.push([x + w * f, y + s]); rope2.push([x + w * f, y - 34 + s * 0.85]); }
    strokeL(g, rope2, '#c9ae74', 3);
    for (var k = 0; k < n; k++) { var f2 = (k + 0.5) / n, px = x + w * f2, py = y + Math.sin(f2 * Math.PI) * sag, tl = st.taut ? 0 : (k % 2 ? 0.25 : -0.2);
      cut(g, rotP(rectP(px - w / n * 0.42, py - 2, w / n * 0.84, 9), px, py, tl), k % 3 ? '#a87e52' : '#94693f', { seed: 9970 + k, lift: 2.5 });
      strokeL(g, [[px, py], [px + (k % 2 ? 2 : -2), y - 34 + Math.sin(f2 * Math.PI) * sag * 0.85]], 'rgba(120,90,50,0.8)', 1.2); }
    strokeL(g, rope, '#d9c18e', 3.2);
    cut(g, rectP(x - 6, y - 50, 10, 66), '#6b4630', { seed: 9990, lift: 3 }); cut(g, rectP(x + w - 4, y - 50, 10, 66), '#6b4630', { seed: 9991, lift: 3 });
  };
  // башня с куполом (tower.state.dome), теплица (house.state.glass), рёбра купола изнутри (wall.state.dome)
  var baseTower = K.tower, baseHouse = K.house, baseWall = K.wall, baseGate = K.gate;
  // решётка-заслонка перед дверью (gate.state.grille): только прутья — видно, что за ней; поднята — прутья вверху
  K.gate = function (g, it, sc, P0) {
    var st = it.state || {}; if (!st.grille) return baseGate(g, it, sc, P0);
    var x = it.x, y = it.y, w = it.w, h = it.h, oy = st.open ? -h * 0.82 : 0;
    for (var i = 10; i < w; i += 18) cut(g, rectP(x + i - 3, y + oy, 6, h), C.ironL, { seed: 9500 + i, lift: 2.5, raw: true });
    [0.2, 0.55, 0.92].forEach(function (f, k) { cut(g, rectP(x, y + h * f - 5 + oy, w, 8), C.iron, { seed: 9540 + k, lift: 2 }); });
    cut(g, rectP(x - 8, y - 14 - (st.open ? h * 0.1 : 0), w + 16, 14), C.iron, { seed: 9550, lift: 3 });
  };
  K.tower = function (g, it, sc, P0) {
    var st = it.state || {}; if (!st.dome) return baseTower(g, it, sc, P0);
    var x = it.x, y = it.y, w = it.w, h = it.h, cx = x + w / 2, dr = w * 0.52, dy = y + dr;
    cut(g, rectP(x, dy, w, h - dr), '#cfc2a4', { seed: 9700 + 50, lift: 6, sh: 0.32 });
    for (var r = 0; r < 7; r++) for (var c = 0; c < 4; c++) cut(g, rectP(x + 2 + c * w / 4 + (r % 2) * w / 8 - (r % 2 && c === 3 ? w / 8 : 0), dy + 4 + r * (h - dr) / 7, w / 4 - 4, (h - dr) / 7 - 4), (r + c) % 2 ? '#bfb294' : '#d6cab0', { seed: 9760 + r * 4 + c, lift: 1, amp: 0.5 });
    var dome = ell(cx, dy, dr, dr * 0.92, 36, Math.PI, TAU).concat([[cx + dr, dy + 6], [cx - dr, dy + 6]]);
    cut(g, dome, st.open ? '#8d97a2' : '#9fa9b2', { seed: 9790, lift: 5, sh: 0.35 });
    for (var k = 1; k < 5; k++) strokeL(g, ell(cx, dy, dr * k / 5, dr * 0.92, 18, Math.PI, TAU), 'rgba(60,70,80,0.35)', 1.2);
    cut(g, [[cx - 7, dy - dr * 0.92], [cx + 7, dy - dr * 0.92], [cx + 9, dy + 2], [cx - 9, dy + 2]], st.open ? '#1c2338' : '#5d6478', { seed: 9791, lift: 1 });   // прорезь
    cut(g, rectP(x - 8, dy, w + 16, 10), C.iron, { seed: 9792, lift: 3 });
    cut(g, rrP(cx - w * 0.16, y + h - h * 0.3, w * 0.32, h * 0.3, 12), C.dbrown, { seed: 9793, lift: 2 });
    cut(g, ell(cx - w * 0.25, dy + (h - dr) * 0.35, 8, 11, 14), '#2c3546', { seed: 9794, lift: 1 });
  };
  K.house = function (g, it, sc, P0) {
    var st = it.state || {}; if (!st.glass) return baseHouse(g, it, sc, P0);
    var x = it.x, y = it.y, w = it.w, h = it.h, roofY = y + h * 0.3;
    cut(g, rectP(x, y + h - 22, w, 22), '#8f8670', { seed: 9800 + 80, lift: 3 });
    cut(g, [[x, roofY], [x + w / 2, y], [x + w, roofY], [x + w, y + h - 20], [x, y + h - 20]], 'rgba(205,226,222,0.55)', { seed: 9881, lift: 3, tex: false });
    for (var k = 0; k <= 6; k++) { var px = x + k * w / 6; strokeL(g, [[px, k === 0 || k === 6 ? roofY : roofY - (k <= 3 ? k : 6 - k) * (roofY - y) / 3], [px, y + h - 20]], '#5d6a5a', 3); }
    strokeL(g, [[x, roofY], [x + w / 2, y], [x + w, roofY]], '#5d6a5a', 3.5); strokeL(g, [[x, y + h * 0.62], [x + w, y + h * 0.62]], '#5d6a5a', 2.5);
    for (var p = 0; p < 5; p++) cut(g, lump(x + 18 + p * (w - 36) / 4, y + h - 30, 12, 9883 + p, 5, 0.3), p % 2 ? '#6f8a4e' : '#5f7d3a', { seed: 9884 + p, lift: 1.5 });
  };
  K.wall = function (g, it, sc, P0) {
    baseWall(g, it, sc, P0); var st = it.state || {}; if (!st.dome) return;
    var cx = 480, top = it.y || 0;
    for (var k = -4; k <= 4; k++) { if (!k) continue; var x0 = cx + k * 120; cut(g, band([[x0, top + it.h], [x0 + k * 4, top + 140], [cx + k * 28, top - 10]], 10), '#3c4152', { seed: 9895 + k, lift: 3, raw: true }); }
    cut(g, band([[0, top + it.h * 0.36], [960, top + it.h * 0.36]], 12), '#3c4152', { seed: 9894, lift: 3, raw: true });
  };

  // морские птицы на скале: стайка из state.n птиц; alarm — кружат, down — слетели вниз (к лающему псу)
  function ternRig(g, x, y, s, dir, flap, sit) {
    var R = new Rig(), root = M(dir * s, 0, 0, s, x, y);
    R.add(root, ell(0, 0, 13, 6, 16), '#f6f3ea', 1); R.add(root, [[10, -3], [20, -2], [12, 2]], '#f6f3ea', 0.9);
    R.add(root, [[11, -1], [24, -4], [24, 3]], '#e9e5da', 0.8);   // хвост-вилочка
    var hd = tr(root, -12, -4); R.add(hd, ell(0, 0, 6, 5, 12), '#f6f3ea', 2); R.add(hd, ell(-1, -2, 6, 3.4, 10, Math.PI, TAU), '#2a2622', 2.1);
    R.add(hd, [[-5, 0], [-14, 1], [-5, 2]], '#c0442e', 2.2); R.add(hd, ell(-2.5, -0.5, 1, 1, 6), '#fff', 2.3, { flat: true });
    var wg = ro(tr(root, 2, -2), sit ? 0.2 : -0.9 + flap); R.add(wg, [[-4, 0], [6, -22], [12, -20], [6, 2]], '#b9bdc2', 1.5); R.add(wg, [[5, -21], [12, -20], [10, -15]], '#2a2622', 1.6);
    R.draw(g);
  }
  NPC.tern = function (g, o, pose, t) {
    var st = o.state || {}, n = st.n || 3, tq = q12(t);
    for (var i = 0; i < n; i++) {
      var f = (i + 0.5) / n, px, py, flap, sit = false, dir = i % 2 ? 1 : -1;
      if (st.down) { px = o.x + o.w * f + Math.sin(tq * 3 + i) * 4; py = o.y + o.h - 8 - Math.abs(Math.sin(tq * 6 + i)) * 6; flap = Math.sin(tq * 14 + i) * 0.5; }
      else if (st.alarm) { var a = tq * 1.3 + i * TAU / n; px = o.x + o.w / 2 + Math.cos(a) * o.w * 0.42; py = o.y + o.h * 0.35 + Math.sin(a) * o.h * 0.25; dir = Math.sin(a) > 0 ? 1 : -1; flap = Math.sin(tq * 18 + i) * 0.7; }
      else { px = o.x + o.w * f; py = o.y + o.h - 6; flap = 0; sit = true; }
      ternRig(g, px, py, 1, dir, flap, sit);
    }
  };

  // ================= помощники =================
  var DOG = { fur: '#c8b996', furD: '#a8977a', chest: '#f1ead8', ear: '#5d4a3c', scarf: '#c0442e', nose: '#2c1d16' };
  function dogRig(g, x, y, dir, pose, t) {
    var tq = q12(t), R = new Rig(), k = 0.82, root = M(dir * k, 0, 0, k, x, y), walk = pose === 'walk', happy = pose === 'happy';
    var dig = pose === 'dig', sniff = pose === 'sniff' || pose === 'reach', pull = pose === 'pull' || pose === 'hold', bark = pose === 'bark', sit = pose === 'think';
    var ph = tq * 12, bob = walk ? -Math.abs(Math.sin(ph)) * 3 : happy ? -Math.abs(Math.sin(tq * 8)) * 6 : bark ? -Math.abs(Math.sin(tq * 6)) * 2 : Math.sin(tq * 1.5) * 0.8;
    var lean = pull ? -0.16 : dig ? 0.22 : sniff ? 0.12 : 0, wag = Math.sin(tq * (happy || bark ? 16 : walk ? 10 : 4)) * (pull ? 0.15 : 0.5);
    var body = ro(tr(root, 0, bob - 30), lean); body = tr(body, 0, 30);
    var tail = ro(tr(body, -32, -36), (sit ? -0.2 : -0.6) + wag); R.add(tail, [[-3, 0], [3, 0], [8, -24], [0, -30], [-6, -22]], DOG.furD, 0.5);
    // ноги: при ходьбе — шаг, при рытье — передние гребут
    [[-24, 0, 1], [-14, 1, 0], [16, 2, 1], [26, 3, 0]].forEach(function (l) {
      var sw = walk ? Math.sin(ph + l[1] * 1.6) * 0.45 : dig && l[0] > 0 ? Math.sin(tq * 22 + l[1]) * 0.8 - 0.5 : pull && l[0] > 0 ? 0.35 : 0;
      var lg = ro(tr(body, l[0], -30 + (sit && l[0] < 0 ? 12 : 0)), sw), len = sit && l[0] < 0 ? 18 : 30;
      R.add(lg, [[-4, 0], [4, 0], [4, len], [-4, len]], l[2] ? DOG.fur : DOG.furD, 0.8); R.add(lg, ell(1, len - 1, 5.5, 3, 8), DOG.chest, 0.9);
    });
    R.add(body, ell(0, sit ? -34 : -40, 34, 17, 24), DOG.fur, 1); R.add(body, ell(14, -38, 14, 12, 16), DOG.chest, 1.2, { lift: 0.4 });
    R.add(body, [[18, -54], [30, -52], [28, -44], [20, -46]], DOG.scarf, 1.4);
    var ha = happy ? -0.2 + Math.sin(tq * 8) * 0.06 : bark ? -0.45 + Math.sin(tq * 9) * 0.08 : dig ? 0.75 : sniff ? 0.55 + Math.sin(tq * 9) * 0.06 : pull ? -0.1 : Math.sin(tq * 0.7) * 0.06;
    var hd = ro(tr(body, 30, sit ? -60 : -56), ha);
    R.add(hd, ell(0, -6, 15, 13, 20), DOG.fur, 2); R.add(hd, [[6, -6], [24, -2], [24, 6], [8, 6]], '#e9e2d2', 2.1);
    R.add(hd, ell(23, -1, 3.6, 3, 8), DOG.nose, 2.3, { flat: true });
    var earA = walk || happy || bark ? Math.sin(tq * 10) * 0.2 : 0, ear = ro(tr(hd, -6, -12), earA);
    R.add(ear, [[-4, -4], [-12, 14], [0, 8]], DOG.ear, 2.2); R.add(hd, [[4, -18], [10, -28], [12, -14]], DOG.furD, 1.9);
    if (happy || bark) R.add(hd, [[12, 6], [20, 4], [18, 12], [13, 12]], bark ? '#7a2e22' : '#d9807a', 2.25, { flat: true });
    if (pull) { R.add(hd, [[14, 3], [40, -2], [40, 3], [14, 7]], '#d9c18e', 2.4); }   // верёвка в зубах
    R.add(hd, (pose === 'think' || dig) ? [[3, -9], [9, -9], [9, -8], [3, -8]] : ell(6, -8, 2.2, 2.4, 8), '#2c1d16', 2.4, { flat: true, hl: !(pose === 'think' || dig) });
    R.draw(g);
    if (dig) { for (var d = 0; d < 4; d++) { var f = (t * 2.4 + d / 4) % 1; g.fillStyle = 'rgba(120,90,55,' + (0.8 * (1 - f)) + ')'; g.beginPath(); g.arc(x - dir * (10 + f * 46), y - 6 - Math.sin(f * Math.PI) * 30, 3 + d % 2, 0, TAU); g.fill(); } }
    if (bark) { for (var b = 0; b < 3; b++) strokeL(g, [[x + dir * (42 + b * 6), y - 66 - b * 6], [x + dir * (52 + b * 8), y - 74 - b * 9]], '#33241b', 2); }
    if (sniff) { for (var s = 0; s < 3; s++) { var fs = (t * 1.6 + s / 3) % 1; g.strokeStyle = 'rgba(51,36,27,' + (0.6 * (1 - fs)) + ')'; g.lineWidth = 1.4; g.beginPath(); g.arc(x + dir * (34 + fs * 22), y - 38 - fs * 8, 3 + fs * 4, -1, 1); g.stroke(); } }
  }
  var GULL = { body: '#f6f3ea', wing: '#a9adb3', tip: '#3a3a40', beak: '#e8b444', dot: '#c0442e', leg: '#e8a060', ring: '#4f7472' };
  function gullRig(g, x, y, alt, dir, pose, t) {
    var tq = q12(t), fly = y - alt > 6, R = new Rig(), happy = pose === 'happy', hold = pose === 'hold', by = fly ? alt : y;
    var flap = fly ? Math.sin(tq * (pose === 'reach' ? 15 : 11)) * 0.8 : (happy ? Math.sin(tq * 14) * 0.6 : 0), root = M(dir, 0, 0, 1, x, by - (fly ? 0 : 20));
    if (!fly) { [-5, 4].forEach(function (lx) { R.add(root, [[lx - 1.5, 6], [lx + 1.5, 6], [lx + 1.5, 20], [lx - 1.5, 20]], GULL.leg, 0.4); R.add(root, [[lx - 5, 19], [lx + 5, 19], [lx + 4, 21], [lx - 5, 21]], GULL.leg, 0.45); }); R.add(root, [[-6.5, 12], [-3.5, 12], [-3.5, 15], [-6.5, 15]], GULL.ring, 0.5, { flat: true }); }
    else if (pose === 'carry' || pose === 'reach') { [-4, 4].forEach(function (lx) { R.add(root, [[lx - 1.4, 6], [lx + 1.4, 6], [lx + 1, 18], [lx - 1, 18]], GULL.leg, 0.4); }); }
    R.add(root, ell(0, 0, 18, 10, 20), GULL.body, 1);
    R.add(root, [[-14, -4], [-30, -8], [-28, 2], [-14, 4]], GULL.body, 0.9); R.add(root, [[-26, -7], [-32, -8], [-30, -1]], GULL.tip, 0.95);
    var wFar = ro(tr(root, -2, -6), fly ? -1.2 - flap : -0.1), wNear = ro(tr(root, 2, -4), fly ? -0.9 + flap : 0.05);
    if (fly) { R.add(wFar, [[0, 0], [-6, -30], [2, -42], [8, -6]], dark(GULL.wing, 0.1), 0.6); R.add(wFar, [[-6, -30], [2, -42], [-2, -34]], GULL.tip, 0.65); }
    R.add(wNear, fly ? [[0, 0], [-10, -32], [0, -46], [10, -4]] : [[6, -2], [-20, -6], [-24, 2], [4, 6]], GULL.wing, 2);
    R.add(wNear, fly ? [[-10, -32], [0, -46], [-4, -36]] : [[-20, -6], [-26, -2], [-22, 3]], GULL.tip, 2.05);
    var hd = ro(tr(root, 16, -10), happy ? Math.sin(tq * 10) * 0.12 : hold ? 0.3 : Math.sin(tq * 0.9) * 0.08);
    R.add(hd, ell(0, -4, 9, 8, 14), GULL.body, 3); R.add(hd, [[6, -4], [18, -2], [7, 0]], GULL.beak, 3.1); R.add(hd, ell(14, -1.5, 1.6, 1.3, 6), GULL.dot, 3.2, { flat: true });
    if (happy) R.add(hd, [[6, -1], [16, 2], [7, 2]], GULL.beak, 3.05);
    R.add(hd, ell(2, -6, 1.8, 2, 8), '#2c1d16', 3.3, { flat: true, hl: true });
    R.draw(g);
  }
  function drawHelper(ctx, p, pose, t) {
    pose = pose || 'idle'; var dir = p.dir < 0 ? -1 : 1, x = p.x, y = p.y;
    if (p.id === 'gull') {
      var alt = p.alt == null ? y : p.alt, fly = y - alt > 6;
      ctx.fillStyle = 'rgba(40,22,10,' + (fly ? 0.12 : 0.22) + ')'; ctx.beginPath(); ctx.ellipse(x, y + 1, fly ? 14 : 12, 3.5, 0, 0, TAU); ctx.fill();
      actor(ctx, x - 50, (fly ? alt : y - 20) - 60, 100, 100, function (g) { gullRig(g, x, y, alt, dir, pose, t || 0); }, 'helper|gull', Math.floor((t || 0) * 12) + '|' + pose + '|' + dir + '|' + (fly ? 1 : 0));
      return;
    }
    if (p.id === 'dog') {
      ctx.fillStyle = 'rgba(40,22,10,0.26)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 32, 5, 0, 0, TAU); ctx.fill();
      actor(ctx, x - 70, y - 100, 140, 112, function (g) { dogRig(g, x, y, dir, pose, t || 0); }, 'helper|dog', Math.floor((t || 0) * 12) + '|' + pose + '|' + dir);
      return;
    }
    th.drawNpc(ctx, { id: p.id, kind: 'npc', x: x - 30, y: y - 60, w: 60, h: 60, state: { type: p.id } }, pose, t);
  }
  // метка активного героя: бумажный флажок над головой (покачивается)
  function drawActiveMark(ctx, p, t) {
    var top = p.id === 'taya' ? p.y - 150 : p.id === 'dog' ? p.y - 88 : (p.alt == null ? p.y : Math.min(p.alt, p.y - 20)) - 52, bob = Math.sin((t || 0) * 3) * 2.5;
    var s = sprite('activemark', -12, -16, 24, 30, function (g) { cut(g, [[-9, -10], [9, -10], [0, 8]], C.mustard, { seed: 9999, lift: 2.5, sh: 0.35 }); brad(g, 0, -7, 2); });
    ctx.save(); ctx.translate(p.x, top + bob); blit(ctx, s); ctx.restore();
  }
  // портреты-переключатели героев (LAYOUT.heroes): активный — крупнее, с охристым ободком; не в сцене — бледный; держит — значок
  function drawPortraits(ctx, ui, L, t) {
    var LH = L.heroes; if (!LH || !ui.heroes || ui.heroes.length < 2 || ui.mode === 'mini' || ui.mode === 'walk') return;
    ui.heroes.forEach(function (h, i) {
      var x = LH.x + i * LH.gap, y = LH.y, r = h.active ? LH.r + 3 : LH.r - 1;
      var s = sprite('portrait|' + h.id + '|' + (h.active ? 1 : 0) + '|' + (h.here ? 1 : 0) + '|' + r, -r - 10, -r - 10, r * 2 + 22, r * 2 + 22, function (g) {
        cut(g, ell(0, 0, r, r, 28), h.active ? C.mustard : h.here ? '#a88052' : '#7a6a58', { seed: 9600 + i, lift: h.active ? 4.5 : 3, sh: 0.4 });
        cut(g, ell(0, 0, r - 5, r - 5, 26), h.here ? '#f6ecd4' : '#b9ad98', { seed: 9610 + i, lift: 1.5 });
        drawIconRaw(g, h.icon || h.id, 0, 1, r * 1.45);
      });
      ctx.save(); ctx.translate(x, y); if (!h.here && !h.active) ctx.globalAlpha = 0.55; blit(ctx, s); ctx.restore();
      if (h.busy) drawIcon(ctx, 'hold', x + r * 0.72, y + r * 0.72, 22);
      if (h.ability) { var pu = 1 + 0.08 * Math.sin((t || 0) * 4); addGlow(ctx, x + r * 0.78, y - r * 0.7, 18, '255,220,120', 0.35); drawIcon(ctx, h.ability, x + r * 0.78, y - r * 0.7, 22 * pu); }
    });
  }
  var baseUI = th.drawUI;
  th.drawUI = function (ctx, ui, t) { baseUI.call(th, ctx, ui, t); if (ui && ui.heroes) drawPortraits(ctx, ui, ui.layout || (KV.ThemeAPI && KV.ThemeAPI.LAYOUT), t); };
  th.drawHelper = drawHelper;
  th.drawActiveMark = drawActiveMark;
  KV.PaperHelpers = { dogRig: dogRig, gullRig: gullRig };
})(typeof window !== 'undefined' ? window : globalThis);
