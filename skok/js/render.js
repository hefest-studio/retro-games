/* СКОК · рендер обеих тем. SKOK.R — примитивы (герой, враги, предметы, клетки, механизмы), SKOK.renderLevel(g, ctx, S, ui),
   SKOK.renderSelect(g, ctx, M) — Верстак (выбор уровня).
   modern — мягкие градиенты и тени; retro — 16-цветная палитра ПК конца 80-х, жёсткие пиксели, без сглаживания.
   Облик свой: лис Скок — рыжий, без головного убора, в коричневом кожаном жилете с бирюзовой и горчичной заплатками,
   за спиной — большой латунный заводной ключ (удар — взмах ключом вперёд). Остановленный враг — серый, из него торчит ключ,
   над ним тает кольцо-завод; лебёдка — столб с колесом-воротом и кольцом оставшегося завода.
   Статичный слой клеток кэшируется в offscreen-canvas по (уровень, ревизия клеток, тема); механизмы рисуются каждый кадр. */
(function (global) {
  'use strict';
  var SK = global.SKOK = global.SKOK || {};
  var L = SK.logic, T = 16, VW = 512, VH = 288;
  var E = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', n: '#aa5500', l: '#aaaaaa',
    d: '#555555', B: '#5555ff', G: '#55ff55', C: '#55ffff', R: '#ff5555', M: '#ff55ff', y: '#ffff55', w: '#ffffff', o: '#ff8833', O: '#cc5500' };
  var FOX = {
    m: { fur: '#e8772e', furD: '#b5531c', white: '#fff4e6', dark: '#2a1a14', vest: '#6b4226', vestD: '#4e2e19', p1: '#3f8f86', p2: '#d9b13b', stitch: '#f2e2c4', leg: '#3a2418', eye: '#1b120d' },
    r: { fur: E.o, furD: E.O, white: E.w, dark: E.k, vest: E.n, vestD: '#552a00', p1: E.c, p2: E.y, stitch: E.w, leg: E.k, eye: E.k }
  };
  var REG = {
    1: { m: { sky0: '#3b2a4f', sky1: '#f2a65a', far: '#8a4f3d', mid: '#5e3a2e', g: ['#9a5b3a', '#87503a', '#a8673f', '#7b4a33'], top: '#d9862f', topD: '#a85f1c', stitch: '#f0cf9a' },
         r: { sky0: E.k, sky1: E.b, far: '#552a00', mid: E.d, g: [E.n, E.n, '#552a00', E.n], top: E.y, topD: E.O, stitch: E.y } },
    2: { m: { sky0: '#17323c', sky1: '#5fa3a0', far: '#2f5b5e', mid: '#24434a', g: ['#6b3e6e', '#5a3460', '#7a4a7c', '#4f2f55'], top: '#d4a83a', topD: '#9c7a22', stitch: '#f2d9a8' },
         r: { sky0: E.k, sky1: E.c, far: E.b, mid: E.k, g: [E.m, E.m, E.r, E.m], top: E.y, topD: E.n, stitch: E.M } },
    3: { m: { sky0: '#2e2c48', sky1: '#a99bc4', far: '#6f6a8e', mid: '#4b4866', g: ['#5d6b3a', '#4f5c32', '#6a7a42', '#56633a'], top: '#c3b26a', topD: '#8a7c3e', stitch: '#ece2b0' },
         r: { sky0: E.k, sky1: E.d, far: E.b, mid: E.k, g: [E.d, E.g, E.d, E.d], top: E.c, topD: E.b, stitch: E.C } },
    4: { m: { sky0: '#070b1d', sky1: '#2c3a6e', far: '#1b2346', mid: '#141a36', g: ['#4a5068', '#3f455c', '#555b75', '#383d52'], top: '#d6a640', topD: '#9a7424', stitch: '#e9d7a6' },
         r: { sky0: E.k, sky1: E.b, far: E.b, mid: E.k, g: [E.d, E.d, E.k, E.d], top: E.y, topD: E.n, stitch: E.l } },
    F: { m: { sky0: '#140c0d', sky1: '#2b1715', far: '#2a1c1e', mid: '#20150f', g: ['#5b4a48', '#4f403e', '#665452', '#473a38'], top: '#7d6a66', topD: '#3a2c2a', stitch: '#8e7b76' },
         r: { sky0: E.k, sky1: E.k, far: E.r, mid: E.k, g: [E.d, E.d, E.d, E.d], top: E.l, topD: E.d, stitch: E.l } }
  };
  function rt(g) { return g.themeName === 'retro'; }
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function ell(ctx, x, y, rx, ry, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function poly(ctx, pts, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); }
  function line(ctx, x0, y0, x1, y1, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w || 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function regOf(LV) { return LV && LV.fort ? 'F' : (LV ? LV.r : 1); }
  // шестерёнка (клеймо, враг-катун, фон)
  function cog(ctx, x, y, r, teeth, c, rot, hole, holeC) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.fillStyle = c; ctx.beginPath();
    for (var i = 0; i < teeth * 2; i++) { var a = i * Math.PI / teeth, rr = i % 2 ? r : r * 1.28; var a0 = a - Math.PI / teeth / 2, a1 = a + Math.PI / teeth / 2; ctx.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr); ctx.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr); }
    ctx.closePath(); ctx.fill();
    if (hole && holeC) { ctx.fillStyle = holeC; ctx.beginPath(); ctx.arc(0, 0, hole, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  // ---------- Скок ----------
  // o: { face, run (фаза), air, swing (0..1 — взмах ключом), flash, inv }
  var KEYC = { m: { brass: '#e0b040', brassD: '#9a7420', shine: '#fff0b0' }, r: { brass: E.y, brassD: E.n, shine: E.w } };
  function windKey(ctx, x, y, a, s, C) {   // заводной ключ: стержень + бородка + кольцо-«бабочка»
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    rect(ctx, -1, -1, 12, 2, C.brass); rect(ctx, 8, 1, 3, 3, C.brassD);
    ctx.fillStyle = C.brass; ctx.beginPath(); ctx.ellipse(-4, -3, 3.2, 2.4, -0.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(-4, 3, 3.2, 2.4, 0.5, 0, Math.PI * 2); ctx.fill();
    circ(ctx, -1, 0, 1.8, C.brassD); rect(ctx, 1, -1, 4, 1, C.shine);
    ctx.restore();
  }
  function hero(ctx, x, y, o, retro, t) {
    if (o.flash && Math.floor(t * 18) % 2) return;
    var K = FOX[retro ? 'r' : 'm'], C = KEYC[retro ? 'r' : 'm'], f = o.face || 1;
    ctx.save(); ctx.translate(retro ? Math.round(x) : x, retro ? Math.round(y) : y);
    if (!retro) { ctx.globalAlpha = 0.25; ell(ctx, 0, 0, 8, 2, '#000'); ctx.globalAlpha = 1; }
    ctx.scale(f, 1);
    var ph = o.air ? 0 : Math.sin(o.run || 0), l1 = Math.round(ph * 2), l2 = -l1;
    if (o.air) { l1 = -2; l2 = 2; }
    var sw = o.swing || 0;
    // ключ за спиной (вне взмаха)
    if (!sw) windKey(ctx, -6, -16, -1.2 + Math.sin((o.run || 0) * 0.5) * 0.05, 0.8, C);
    // хвост (за спиной; в прыжке — торчком)
    var tu = o.air ? -4 : Math.round(Math.sin((o.run || 0) * 0.5) * 1);
    poly(ctx, [-3, -8, -9, -12 + tu, -14, -11 + tu, -13, -6, -6, -5], K.fur);
    poly(ctx, [-11, -12 + tu, -14, -11 + tu, -14, -8, -12, -9 + tu], K.white);
    rect(ctx, -4 + l1, -6, 3, 6, K.leg); rect(ctx, 1 + l2, -6, 3, 6, K.leg);
    // туловище: жилет с заплатками, белая грудка
    rect(ctx, -5, -14, 10, 9, K.vest); rect(ctx, -5, -6, 10, 1, K.vestD);
    rect(ctx, 2, -14, 3, 8, K.white);
    rect(ctx, -4, -12, 3, 3, K.p1); rect(ctx, -1, -9, 3, 2, K.p2);
    if (!retro) { rect(ctx, -4, -12, 1, 1, K.stitch); rect(ctx, -2, -10, 1, 1, K.stitch); rect(ctx, 1, -9, 1, 1, K.stitch); }
    // голова: без головного убора, острые уши, белая морда
    rect(ctx, -3, -21, 8, 7, K.fur); rect(ctx, -3, -15, 8, 1, K.furD);
    poly(ctx, [-3, -21, -2, -27, 1, -21], K.fur); poly(ctx, [1, -21, 3, -27, 5, -21], K.fur);
    rect(ctx, -2, -26, 1, 2, K.dark); rect(ctx, 2, -26, 2, 2, K.dark);
    poly(ctx, [4, -20, 10, -17, 4, -15], K.white); rect(ctx, 9, -18, 2, 2, K.dark);
    rect(ctx, 0, -17, 4, 2, K.white);
    rect(ctx, 2, -20, 2, 2, K.eye); if (!retro) rect(ctx, 3, -20, 1, 1, '#ffffff');
    // лапа (во взмахе — вперёд с ключом)
    if (sw) {
      var a = -1.4 + sw * 1.9;
      rect(ctx, 2, -13, 6, 2, K.fur);
      windKey(ctx, 9, -12, a, 1.05, C);
      if (!retro) { ctx.globalAlpha = 0.35 * (1 - sw); ctx.strokeStyle = C.shine; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(9, -12, 15, -1.4, a); ctx.stroke(); ctx.globalAlpha = 1; }
    } else { var arm = o.air ? -3 : Math.round(-ph * 2); rect(ctx, 1 + arm, -12, 2, 5, K.fur); }
    ctx.restore();
  }

  // ---------- враги ----------
  var EC = { m: { steel: '#9aa3ad', steelD: '#5d6670', tin: '#8c8f9a', tinD: '#5e616b', pink: '#e79aa6', gold: '#e2b23a', can: '#3f7f8f', canD: '#285561', spring: '#c9cdd4', velvet: '#b8323a', velvetD: '#7e1f26', pin: '#e6e9ee', brass: '#c9a227', brassD: '#8a6c12', eye: '#ffffff', pupil: '#1b120d', iron: '#5a5f6b', ironD: '#3a3e47', warn: '#f2c14e' },
    r: { steel: E.l, steelD: E.d, tin: E.l, tinD: E.d, pink: E.M, gold: E.y, can: E.c, canD: E.b, spring: E.w, velvet: E.r, velvetD: '#550000', pin: E.w, brass: E.y, brassD: E.n, eye: E.w, pupil: E.k, iron: E.d, iron2: E.l, ironD: E.k, warn: E.y } };
  function eyes(ctx, x, y, dir, C, gap) { gap = gap || 4; rect(ctx, x - gap / 2 - 1, y, 3, 3, C.eye); rect(ctx, x + gap / 2 - 1, y, 3, 3, C.eye); rect(ctx, x - gap / 2 + (dir > 0 ? 1 : -1) * 0 + (dir > 0 ? 1 : 0), y + 1, 1, 2, C.pupil); rect(ctx, x + gap / 2 + (dir > 0 ? 1 : 0), y + 1, 1, 2, C.pupil); }
  function enemy(ctx, e, t, retro) {
    var C = EC[retro ? 'r' : 'm'], x = retro ? Math.round(e.x) : e.x, y = retro ? Math.round(e.y) : e.y, d = e.dir || 1;
    if (!e.alive) {
      if (!(e.dead > 0)) return;
      ctx.save(); ctx.globalAlpha = Math.min(1, e.dead / 0.4);
      if (e.how === 'key') { var k = Math.min(1, e.dead / 0.7); ctx.translate(x, y); ctx.scale(0.4 + k * 0.6, 0.4 + k * 0.6); ctx.translate(-x, -y); }
      else { ctx.translate(x, y - e.h / 2 - (0.7 - e.dead) * 30); ctx.rotate((0.7 - e.dead) * 8); ctx.translate(-x, -y + e.h / 2); }
    } else ctx.save();
    if (!retro && e.alive && e.k !== 'v' && e.k !== 'P') { ctx.globalAlpha = 0.22; ell(ctx, x, y, e.hw + 1, 2, '#000'); ctx.globalAlpha = 1; }
    switch (e.k) {
      case 'g':   // шестерёнка-катун
        cog(ctx, x, y - 6, 5, 8, C.steelD, e.x / 6); cog(ctx, x, y - 6, 4.2, 8, C.steel, e.x / 6);
        circ(ctx, x, y - 6, 3, C.steelD); eyes(ctx, x, y - 8, d, C, 3); break;
      case 'm': { // заводная мышь
        var sh = e.st === 'tell' ? Math.sin(t * 60) * 1 : 0;
        ctx.save(); ctx.translate(x + sh, y); ctx.scale(d, 1);
        line(ctx, -6, -3, -11, -5 + Math.sin(t * 9), C.tinD, 1);
        ell(ctx, 0, -4, 7, 4.5, C.tin); rect(ctx, -6, -1, 12, 1, C.tinD);
        circ(ctx, 4, -8, 2.5, C.tin); circ(ctx, 4, -8, 1.3, C.pink); poly(ctx, [5, -6, 9, -3, 5, -2], C.tin); rect(ctx, 8, -4, 2, 2, C.pupil); rect(ctx, 4, -5, 1, 1, C.pupil);
        var kr = e.st === 'wind' ? t * 14 : t * 4; rect(ctx, -2, -11, 2, 3, C.gold); ctx.save(); ctx.translate(-1, -12); ctx.scale(Math.cos(kr), 1); rect(ctx, -4, -2, 8, 3, C.gold); ctx.restore();
        rect(ctx, -4, 0, 2, 1, C.tinD); rect(ctx, 2, 0, 2, 1, C.tinD);
        ctx.restore(); break;
      }
      case 'h': { // пружинник: жестяная банка на пружине
        var air = !e.ground, sq = air ? 3 : Math.max(0, Math.sin(e.stT * 6)) * 2;
        for (var i = 0; i < 3; i++) line(ctx, x - 4, y - 1 - i * (2 + sq / 3) - 1, x + 4, y - 2 - i * (2 + sq / 3), C.spring, 1.5);
        var top = y - 7 - sq; rect(ctx, x - 5, top - 8, 10, 8, C.can); rect(ctx, x - 5, top - 8, 10, 2, C.canD); rect(ctx, x - 5, top - 1, 10, 1, C.canD);
        eyes(ctx, x, top - 6, d, C, 4); break;
      }
      case 'n': { // игольник: бархатная подушечка с булавками
        ctx.fillStyle = C.velvet; ctx.beginPath(); ctx.ellipse(x, y - 3, 8, 7, 0, Math.PI, 0); ctx.fill(); rect(ctx, x - 8, y - 3, 16, 3, C.velvetD);
        for (var p = 0; p < 6; p++) { var a = Math.PI + 0.35 + p * 0.5, px0 = x + Math.cos(a) * 6, py0 = y - 3 + Math.sin(a) * 5; var px1 = x + Math.cos(a) * 11, py1 = y - 3 + Math.sin(a) * 9; line(ctx, px0, py0, px1, py1, C.pin, 1); rect(ctx, px1 - 1, py1 - 1, 2, 2, C.pin); }
        eyes(ctx, x + d * 3, y - 6, d, C, 3); rect(ctx, x - 6, y - 1, 2, 1, C.velvetD); rect(ctx, x + 4, y - 1, 2, 1, C.velvetD); break;
      }
      case 'v': { // флюгерник: латунная стрела с вертушкой
        ctx.save(); ctx.translate(x, y - 5); ctx.scale(d, 1);
        poly(ctx, [8, 0, 2, -4, 2, 4], C.brass); rect(ctx, -6, -1, 9, 2, C.brass); poly(ctx, [-6, 0, -10, -5, -8, 0, -10, 5], C.brassD);
        rect(ctx, 3, -1, 2, 1, C.pupil);
        var pw = Math.cos(t * 30) * 7; rect(ctx, 0, -8, 1, 7, C.brassD); rect(ctx, -pw / 2, -9, Math.abs(pw) + 1, 2, C.spring);
        ctx.restore(); break;
      }
      case 'P': { // давильный молот на цепи
        for (var cy = e.top; cy < e.y - 16; cy += 4) rect(ctx, x - 1, cy, 3, 3, (cy / 4) % 2 ? C.ironD : C.steelD);
        rect(ctx, x - 9, e.y - 16, 18, 14, C.iron); rect(ctx, x - 9, e.y - 16, 18, 2, C.steel);
        for (var s = 0; s < 4; s++) poly(ctx, [x - 9 + s * 4.5, e.y - 2, x - 4.5 + s * 4.5, e.y - 2, x - 6.75 + s * 4.5, e.y + 1], C.steel);
        rect(ctx, x - 6, e.y - 11, 12, 3, C.warn); break;
      }
      case 'Z': boss(ctx, e, t, retro); break;
    }
    ctx.restore();
    if (e.alive && e.stop > 0) stopped(ctx, e, t, retro);
  }
  // остановленный враг: серая вуаль, ключ сверху, тающее кольцо оставшегося завода; перед пуском — дрожит
  function stopped(ctx, e, t, retro) {
    var C = KEYC[retro ? 'r' : 'm'], x = e.x, top = e.y - e.h, k = Math.max(0, Math.min(1, e.stop / L.K.STOP));
    if (!retro) { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#8a9099'; ctx.fillRect(x - e.hw - 1, top, e.hw * 2 + 2, e.h); ctx.restore(); }
    else { for (var i = 0; i < e.h; i += 2) rect(ctx, x - e.hw, top + i, e.hw * 2, 1, E.d); }
    windKey(ctx, x, top - 4, -Math.PI / 2 + (e.stop < 1.2 ? Math.sin(t * 30) * 0.3 : 0), 0.7, C);
    ctx.strokeStyle = e.stop < 1.2 && Math.floor(t * 8) % 2 ? (retro ? E.R : '#ff6b5b') : C.brass; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, top - 6, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
  }
  var BC = { rust: ['#8a4b2a', '#5e3019', '#e07a3a'], boiler: ['#6d6f78', '#43454c', '#ff9a3a'], vane: ['#b7902a', '#7a5f17', '#ffe07a'], pendulum: ['#4d4a7a', '#2f2d50', '#9fe0ff'] };
  var BCr = { rust: [E.n, E.k, E.R], boiler: [E.l, E.d, E.y], vane: [E.y, E.n, E.w], pendulum: [E.B, E.b, E.C] };
  function boss(ctx, b, t, retro) {
    var kind = b.kindName || 'rust', C = (retro ? BCr : BC)[kind], x = b.x, y = b.y, d = b.dir || 1, EC0 = EC[retro ? 'r' : 'm'];
    if (b.inv > 0 && Math.floor(t * 16) % 2) return;
    var bob = b.ground ? Math.sin(t * 8) * 1 : 0;
    // ноги-поршни
    rect(ctx, x - 9, y - 8, 5, 8, C[1]); rect(ctx, x + 4, y - 8, 5, 8, C[1]);
    // корпус-бочка
    rect(ctx, x - 13, y - 28 + bob, 26, 21, C[0]); rect(ctx, x - 13, y - 22 + bob, 26, 2, C[1]); rect(ctx, x - 13, y - 13 + bob, 26, 2, C[1]);
    for (var i = 0; i < 4; i++) rect(ctx, x - 11 + i * 7, y - 27 + bob, 2, 2, C[2]);
    // глаза-окошки
    rect(ctx, x - 7 + d * 2, y - 20 + bob, 5, 4, C[2]); rect(ctx, x + 2 + d * 2, y - 20 + bob, 5, 4, C[2]);
    rect(ctx, x - 6 + d * 3, y - 19 + bob, 2, 2, EC0.pupil); rect(ctx, x + 3 + d * 3, y - 19 + bob, 2, 2, EC0.pupil);
    rect(ctx, x - 6, y - 11 + bob, 12, 2, C[1]);
    if (kind === 'boiler') { rect(ctx, x + 6, y - 36 + bob, 4, 8, C[1]); if (!retro) { ctx.globalAlpha = 0.4; circ(ctx, x + 8 + Math.sin(t * 3) * 2, y - 40 - (t * 20 % 10), 3, '#ccc'); ctx.globalAlpha = 1; } }
    else if (kind === 'vane') { rect(ctx, x - 1, y - 38 + bob, 2, 10, C[1]); ctx.save(); ctx.translate(x, y - 38 + bob); ctx.scale(Math.cos(t * 2), 1); poly(ctx, [-9, 0, 7, -3, 9, 0, 7, 3], C[2]); ctx.restore(); }
    else if (kind === 'pendulum') { var a = Math.sin(t * 3) * 0.6; line(ctx, x, y - 28 + bob, x + Math.sin(a) * 12, y - 28 + bob - Math.cos(a) * 12 - 2, C[1], 2); circ(ctx, x + Math.sin(a) * 14, y - 28 + bob - Math.cos(a) * 14 - 2, 4, C[2]); }
    else { cog(ctx, x, y - 31 + bob, 4, 6, C[1], t); }
    if (b.st === 'wind') {   // подзаводится: на спине крутится большой ключ — бей!
      var KC = KEYC[retro ? 'r' : 'm'];
      ctx.save(); ctx.translate(x - d * 15, y - 18 + bob); ctx.scale(Math.cos(t * 14), 1); windKey(ctx, 0, 0, Math.PI, 1.3, KC); ctx.restore();
      if (Math.floor(t * 6) % 2) { ctx.strokeStyle = KC.shine; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x - d * 15, y - 18 + bob, 11, 0, Math.PI * 2); ctx.stroke(); }
    }
  }

  // ---------- предметы ----------
  var IC = { m: { nut: '#c9cdd4', nutD: '#7d838c', heart: '#e2464f', gold: '#e7b93a', goldD: '#9a7419', lamp: '#ffd27a', post: '#5a3a24', stone: '#9a8f86', stoneD: '#5e554f' },
    r: { nut: E.l, nutD: E.d, heart: E.R, gold: E.y, goldD: E.n, lamp: E.y, post: E.n, stone: E.l, stoneD: E.d } };
  function nut(ctx, x, y, t, retro, s) {
    var C = IC[retro ? 'r' : 'm'], w = Math.abs(Math.cos(t * 3 + x * 0.05)) * 5 + 1; s = s || 1;
    if (retro) { var X0 = Math.round(x), Y0 = Math.round(y), ww = Math.max(1, Math.round(w)); rect(ctx, X0 - ww, Y0 - 3, ww * 2, 6, C.nut); rect(ctx, X0 - Math.max(1, ww - 2), Y0 - 5, Math.max(2, ww * 2 - 4), 10, C.nut); if (ww > 2) rect(ctx, X0 - 1, Y0 - 1, 2, 2, C.nutD); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(w / 6 * s, s);
    poly(ctx, [-6, 0, -3, -5, 3, -5, 6, 0, 3, 5, -3, 5], C.nut); circ(ctx, 0, 0, 2, C.nutD); rect(ctx, -4, -4, 3, 1, '#ffffff');
    ctx.restore();
  }
  function heartGear(ctx, x, y, retro, s) { var C = IC[retro ? 'r' : 'm']; s = s || 1; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); cog(ctx, 0, 0, 5, 8, C.goldD, 0); circ(ctx, -2, -1, 2.6, C.heart); circ(ctx, 2, -1, 2.6, C.heart); poly(ctx, [-4.5, 0, 4.5, 0, 0, 4], C.heart); ctx.restore(); }
  function heartIcon(ctx, x, y, full, retro) { var c = full ? IC[retro ? 'r' : 'm'].heart : (retro ? E.d : 'rgba(255,255,255,.22)'); circ(ctx, x - 2.2, y - 1, 2.8, c); circ(ctx, x + 2.2, y - 1, 2.8, c); poly(ctx, [x - 5, y, x + 5, y, x, y + 5], c); }
  function lantern(ctx, x, y, lit, t, retro) {
    var C = IC[retro ? 'r' : 'm'];
    rect(ctx, x - 1, y - 26, 2, 26, C.post); rect(ctx, x - 1, y - 27, 6, 2, C.post);
    rect(ctx, x + 2, y - 25, 5, 7, lit ? C.lamp : '#3a3030'); rect(ctx, x + 2, y - 26, 5, 1, C.post);
    if (lit && !retro) { ctx.globalAlpha = 0.25 + Math.sin(t * 5) * 0.06; circ(ctx, x + 4, y - 21, 12, C.lamp); ctx.globalAlpha = 1; }
  }
  // финиш: деталь Большого Механизма — золотая шестерня с циферблатом на каменном постаменте
  function finishPart(ctx, x, gy, t, retro, done) {
    var C = IC[retro ? 'r' : 'm'], lift = done ? Math.min(30, t * 0) : 0, y = gy - 40 - Math.sin(t * 2) * 2 - lift;
    rect(ctx, x - 12, gy - 14, 24, 14, C.stone); rect(ctx, x - 14, gy - 16, 28, 4, C.stoneD); rect(ctx, x - 10, gy - 4, 20, 1, C.stoneD);
    if (!retro) { ctx.globalAlpha = 0.25 + Math.sin(t * 4) * 0.1; circ(ctx, x, y, 22, '#ffd27a'); ctx.globalAlpha = 1; }
    cog(ctx, x, y, 13, 10, C.goldD, t * 0.6); cog(ctx, x, y, 11.5, 10, C.gold, t * 0.6);
    circ(ctx, x, y, 7, retro ? E.w : '#fff6e0'); line(ctx, x, y, x + Math.cos(t * 2) * 5, y + Math.sin(t * 2) * 5, retro ? E.k : '#2a1a14', 1.5); line(ctx, x, y, x, y - 4, retro ? E.k : '#2a1a14', 1.5);
  }
  // лебёдка: столб, колесо-ворот с ручкой, над ним — кольцо оставшегося завода (или мигающий ключ-подсказка)
  function winch(ctx, x, gy, gr, t, retro) {
    var C = KEYC[retro ? 'r' : 'm'], on = gr.t > 0, k = on ? gr.t / L.K.WIND : 0, wy = gy - 16;
    rect(ctx, x - 2, gy - 22, 4, 22, retro ? E.n : '#6b4426'); rect(ctx, x - 6, gy - 3, 12, 3, retro ? '#552a00' : '#4a2e18');
    var rot = on ? t * 6 : 0;
    cog(ctx, x, wy, 6, 8, retro ? E.l : '#8a9099', rot, 2, retro ? E.d : '#4b4f57');
    line(ctx, x, wy, x + Math.cos(rot) * 9, wy + Math.sin(rot) * 9, C.brass, 2); circ(ctx, x + Math.cos(rot) * 9, wy + Math.sin(rot) * 9, 2, C.brassD);
    if (on) { ctx.strokeStyle = gr.t < 2 && Math.floor(t * 8) % 2 ? (retro ? E.R : '#ff6b5b') : C.brass; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, wy - 18, 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke(); }
    else { var b = Math.sin(t * 5) * 2; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 5); windKey(ctx, x, wy - 20 + b, Math.PI / 2, 0.8, C); ctx.globalAlpha = 1; }
  }
  // механизмы куска: звенья моста (выдвинуты / контур-подсказка) и пружинные плиты
  function mechTiles(ctx, LV, gr, t, retro) {
    var on = gr.t > 0, warn = on && gr.t < 2 && Math.floor(t * 8) % 2;
    gr.tiles.forEach(function (q) {
      var X = q.tx * T, Y = q.ty * T, ch = L.tileAt(LV, q.tx, q.ty);
      if (q.k === 'b') {
        if (ch === 'Y') { var pw = retro ? E.n : (warn ? '#d07a45' : '#b07a45'); rect(ctx, X, Y, T, 5, pw); rect(ctx, X, Y + 4, T, 1, retro ? '#552a00' : '#6b4524'); rect(ctx, X + 7, Y + 5, 2, 3, retro ? E.l : '#7d838c'); rect(ctx, X + 1, Y + 1, 2, 2, retro ? E.l : '#c9cdd4'); }
        else if (!retro || Math.floor(t * 2) % 2) { ctx.globalAlpha = 0.28; ctx.strokeStyle = retro ? E.y : '#ffe2a8'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.strokeRect(X + 0.5, Y + 0.5, T - 1, 4); ctx.setLineDash([]); ctx.globalAlpha = 1; }
      } else {
        var act = ch === 'Q', sq = act ? Math.abs(Math.sin(t * 10)) * 2 : 0;
        rect(ctx, X, Y + 6, T, 10, retro ? E.d : '#4b4f57');
        for (var i = 0; i < 3; i++) line(ctx, X + 2, Y + 7 + i * 2 - sq / 2, X + 14, Y + 8 + i * 2 - sq / 2, retro ? E.w : '#c9cdd4', 1.5);
        rect(ctx, X - 1, Y + 2 - sq, T + 2, 4, act ? (retro ? E.y : '#e0b040') : (retro ? E.l : '#8a9099')); rect(ctx, X - 1, Y + 2 - sq, T + 2, 1, retro ? E.w : '#ffffff');
        if (act && !retro) { ctx.globalAlpha = 0.25; circ(ctx, X + 8, Y + 2, 10, '#ffd27a'); ctx.globalAlpha = 1; }
      }
    });
  }

  // ---------- клетки ----------
  function crateTile(ctx, X, Y, ch, retro) {
    var wood = retro ? E.n : '#a8672e', woodD = retro ? '#552a00' : '#6e4019', band = retro ? E.d : '#4b4f57', stamp = retro ? E.k : '#3d2210';
    if (ch === 'u') { rect(ctx, X, Y, T, T, retro ? '#552a00' : '#5c3a1e'); rect(ctx, X, Y, T, 1, retro ? E.n : '#7a5230'); rect(ctx, X + 2, Y + 2, 2, 2, band); rect(ctx, X + 12, Y + 2, 2, 2, band); rect(ctx, X + 2, Y + 12, 2, 2, band); rect(ctx, X + 12, Y + 12, 2, 2, band); return; }
    if (ch === 'X') { rect(ctx, X, Y, T, T, retro ? E.y : '#d7b27a'); rect(ctx, X, Y, T, 1, retro ? E.w : '#ecd3a5'); line(ctx, X + 2, Y + 2, X + 14, Y + 14, retro ? E.n : '#8a6a3a', 2); line(ctx, X + 14, Y + 2, X + 2, Y + 14, retro ? E.n : '#8a6a3a', 2); rect(ctx, X, Y + 15, T, 1, retro ? E.n : '#8a6a3a'); return; }
    rect(ctx, X, Y, T, T, wood); rect(ctx, X, Y + 5, T, 1, woodD); rect(ctx, X, Y + 10, T, 1, woodD);
    rect(ctx, X, Y, T, 2, band); rect(ctx, X, Y + 14, T, 2, band); rect(ctx, X, Y, 2, T, band); rect(ctx, X + 14, Y, 2, T, band);
    cog(ctx, X + 8, Y + 8, 3.2, 6, stamp, 0.3, retro ? 0 : 1.2, wood);
    if (!retro) { rect(ctx, X + 2, Y + 2, 12, 1, 'rgba(255,255,255,.18)'); }
  }
  function earth(ctx, LV, tx, ty, X, Y, P, retro) {
    var c = P.g[Math.floor(hash(tx >> 1, ty >> 1) * 4)];
    rect(ctx, X, Y, T, T, c);
    var up = L.tileAt(LV, tx, ty - 1), airUp = !(L.isSolid(up) || up === '/' || up === '\\');
    // стежки на швах лоскутов (каждые 2×2 клетки)
    ctx.fillStyle = P.stitch;
    if ((tx & 1) === 0) for (var i = 1; i < T; i += 4) ctx.fillRect(X, Y + i, 1, 2);
    if ((ty & 1) === 0 && !airUp) for (var j = 1; j < T; j += 4) ctx.fillRect(X + j, Y, 2, 1);
    if (!retro) { ctx.fillStyle = 'rgba(0,0,0,' + (0.06 + (ty - 12) * 0.02) + ')'; ctx.fillRect(X, Y, T, T); }
    var lf = L.tileAt(LV, tx - 1, ty), rg = L.tileAt(LV, tx + 1, ty);
    if (!(L.isSolid(lf) || L.isSlope(lf)) && tx > 0) rect(ctx, X, Y, 2, T, P.topD);
    if (!(L.isSolid(rg) || L.isSlope(rg)) && tx < LV.w - 1) rect(ctx, X + T - 2, Y, 2, T, P.topD);
    if (airUp) { rect(ctx, X, Y, T, 4, P.top); rect(ctx, X, Y + 4, T, 1, P.topD); if (!retro) { rect(ctx, X, Y, T, 1, 'rgba(255,255,255,.25)'); } for (var k = 2; k < T; k += 5) rect(ctx, X + k, Y + 6, 2, 1, P.stitch); }
  }
  function stone(ctx, tx, ty, X, Y, P, retro) {
    rect(ctx, X, Y, T, T, P.g[Math.floor(hash(tx, ty) * 4)]);
    var off = (ty & 1) * 8, mc = retro ? E.k : 'rgba(0,0,0,.35)';
    rect(ctx, X, Y + 7, T, 1, mc); rect(ctx, X, Y + 15, T, 1, mc);
    rect(ctx, X + ((off + 4) % 16), Y, 1, 7, mc); rect(ctx, X + ((off + 12) % 16), Y + 8, 1, 7, mc);
    if (!retro) rect(ctx, X, Y, T, 1, 'rgba(255,255,255,.08)');
  }
  function slopeTile(ctx, ch, X, Y, P, retro, tx, ty) {
    var c = P.g[Math.floor(hash(tx >> 1, ty >> 1) * 4)];
    if (ch === '/') { poly(ctx, [X, Y + T, X + T, Y, X + T, Y + T], c); ctx.strokeStyle = P.top; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X - 0.5, Y + T + 1.5); ctx.lineTo(X + T + 0.5, Y + 1.5); ctx.stroke(); }
    else { poly(ctx, [X, Y, X + T, Y + T, X, Y + T], c); ctx.strokeStyle = P.top; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X - 0.5, Y + 1.5); ctx.lineTo(X + T + 0.5, Y + T + 1.5); ctx.stroke(); }
    if (!retro) { ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(X, Y + T - 2, T, 2); }
  }
  function drawTile(ctx, LV, ch, tx, ty, P, retro) {
    var X = tx * T, Y = ty * T;
    if (ch === '#') earth(ctx, LV, tx, ty, X, Y, P, retro);
    else if (ch === '=') stone(ctx, tx, ty, X, Y, P, retro);
    else if (ch === '/' || ch === '\\') slopeTile(ctx, ch, X, Y, P, retro, tx, ty);
    else if (ch === 'T') { var pw = retro ? E.n : '#b07a45'; rect(ctx, X, Y, T, 5, pw); rect(ctx, X, Y + 4, T, 1, retro ? '#552a00' : '#6b4524'); rect(ctx, X + 2, Y + 1, 1, 1, retro ? E.y : '#e9c98f'); rect(ctx, X + 13, Y + 1, 1, 1, retro ? E.y : '#e9c98f'); if (L.tileAt(LV, tx - 1, ty) !== 'T') rect(ctx, X, Y, 1, 5, retro ? '#552a00' : '#6b4524'); }
    else if (ch === '^') { rect(ctx, X, Y + 6, T, 10, P.g[1]); rect(ctx, X, Y + 6, T, 1, P.topD); var sc = retro ? E.w : '#cfd6de', sd = retro ? E.l : '#8b939d'; for (var i = 0; i < 4; i++) { poly(ctx, [X + i * 4, Y + 7, X + i * 4 + 2, Y + 1, X + i * 4 + 4, Y + 7], sc); rect(ctx, X + i * 4 + 2, Y + 3, 1, 4, sd); } }
    else if (ch === 'x') crateTile(ctx, X, Y, ch, retro);
  }
  var cache = { key: null, cv: null };
  function levelLayer(LV, retro) {
    var key = LV.id + '|' + (LV.rev | 0) + '|' + retro;
    if (cache.key === key) return cache.cv;
    var cv = cache.cv || document.createElement('canvas');
    if (cv.width !== LV.w * T) cv.width = LV.w * T;
    cv.height = LV.h * T;
    var c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); c.imageSmoothingEnabled = !retro;
    var P = REG[regOf(LV)][retro ? 'r' : 'm'];
    for (var ty = 0; ty < LV.h; ty++) for (var tx = 0; tx < LV.w; tx++) { var ch = LV.t[ty].charAt(tx); if (ch !== '.' && ch !== '~' && ch !== 'b' && ch !== 'Y' && ch !== 'S' && ch !== 'Q') drawTile(c, LV, ch, tx, ty, P, retro); }
    cache.key = key; cache.cv = cv; return cv;
  }
  // ---------- фон ----------
  function sky(ctx, P, retro, h) {
    h = h || VH;
    if (retro) { var bands = 6; for (var i = 0; i < bands; i++) { rect(ctx, 0, i * h / bands, VW, h / bands + 1, i < bands / 2 ? P.sky0 : P.sky1); } for (var y = h / 2 - 8; y < h / 2 + 8; y += 2) for (var x = (y / 2) % 4; x < VW; x += 4) rect(ctx, x, y, 2, 2, P.sky0); return; }
    var gr = ctx.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, P.sky0); gr.addColorStop(1, P.sky1); ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, h);
  }
  function background(ctx, reg, camX, retro, t) {
    var P = REG[reg][retro ? 'r' : 'm'];
    sky(ctx, P, retro);
    var i, x, k;
    if (reg === 4 || reg === 'F') { for (i = 0; i < 40; i++) { var sx = (hash(i, 7) * VW * 2 - camX * 0.05) % VW; if (sx < 0) sx += VW; var tw = reg === 4 && Math.sin(t * 2 + i) > 0.6 ? 2 : 1; if (reg === 4) rect(ctx, Math.round(sx), Math.round(hash(i, 3) * 150), tw, tw, retro ? E.w : '#e9ecff'); } }
    if (reg === 1) {
      // дальние медные холмы с заклёпками
      for (k = 0; k < 6; k++) { x = ((k * 220 - camX * 0.15) % (6 * 220) + 6 * 220) % (6 * 220) - 160; ell(ctx, x + 100, 230, 150, 70 + (k % 3) * 18, P.far); if (!retro) for (i = 0; i < 5; i++) circ(ctx, x + 40 + i * 30, 175 - (k % 3) * 14 + Math.abs(i - 2) * 6, 1.4, '#c27a55'); }
      // водонапорные баки и трубы
      for (k = 0; k < 5; k++) { x = ((k * 260 - camX * 0.4) % 1300 + 1300) % 1300 - 120; rect(ctx, x + 20, 150, 6, 90, P.mid); rect(ctx, x + 60, 150, 6, 90, P.mid); rect(ctx, x + 10, 120, 66, 34, P.mid); poly(ctx, [x + 6, 120, x + 43, 100, x + 80, 120], P.mid); if (!retro) { ctx.globalAlpha = 0.18; circ(ctx, x + 43 + Math.sin(t + k) * 4, 90 - (t * 8 + k * 7) % 30, 6, '#fff'); ctx.globalAlpha = 1; } }
    } else if (reg === 2) {
      // лоскутные деревья: стволы и кроны из прямоугольных заплат
      var pc = retro ? [E.m, E.r, E.b] : ['#3f6e6a', '#56406a', '#7a5a2e', '#2f5257'];
      for (k = 0; k < 8; k++) { x = ((k * 150 - camX * 0.25) % 1200 + 1200) % 1200 - 100; rect(ctx, x + 30, 120, 10, 130, P.far); for (i = 0; i < 4; i++) rect(ctx, x + 6 + (i % 2) * 26, 70 + Math.floor(i / 2) * 26, 30, 28, pc[(k + i) % pc.length]); if (!retro) { ctx.fillStyle = 'rgba(255,240,200,.25)'; for (i = 0; i < 6; i++) ctx.fillRect(x + 8 + i * 9, 96, 4, 1); } }
      for (k = 0; k < 6; k++) { x = ((k * 230 - camX * 0.5) % 1380 + 1380) % 1380 - 120; rect(ctx, x + 40, 170, 14, 90, P.mid); rect(ctx, x + 14, 140, 66, 40, P.mid); }
    } else if (reg === 3) {
      // паровые трубы, туман, вентили
      for (k = 0; k < 6; k++) { x = ((k * 210 - camX * 0.22) % 1260 + 1260) % 1260 - 100; rect(ctx, x + 30, 110, 14, 150, P.far); rect(ctx, x + 30, 110, 60, 12, P.far); rect(ctx, x + 78, 110, 12, 60, P.far); circ(ctx, x + 37, 140, 9, P.far); if (!retro) { ctx.globalAlpha = 0.25; for (i = 0; i < 3; i++) circ(ctx, x + 37 + Math.sin(t * 1.4 + i) * 6, 100 - ((t * 14 + i * 12) % 40), 7 + i * 2, '#ffffff'); ctx.globalAlpha = 1; } }
      if (!retro) { ctx.fillStyle = 'rgba(230,225,245,.18)'; for (i = 0; i < 3; i++) ctx.fillRect(0, 180 + i * 22 + Math.sin(t * 0.5 + i) * 3, VW, 10); }
      for (k = 0; k < 10; k++) { x = ((k * 90 - camX * 0.5) % 900 + 900) % 900 - 40; rect(ctx, x, 200, 2, 50, P.mid); rect(ctx, x - 2, 196, 6, 8, P.mid); }
    } else if (reg === 4) {
      for (k = 0; k < 5; k++) { x = ((k * 280 - camX * 0.12) % 1400 + 1400) % 1400 - 140; cog(ctx, x + 80, 170 + (k % 2) * 40, 60 + (k % 3) * 14, 12, P.far, t * 0.1 * (k % 2 ? 1 : -1), 18, P.mid); }
      for (k = 0; k < 6; k++) { x = ((k * 240 - camX * 0.45) % 1440 + 1440) % 1440 - 120; cog(ctx, x + 60, 250, 40, 10, P.mid, -t * 0.2, 0); }
    } else {
      // крепость: кладка и пламя в нишах
      var bc = retro ? E.k : '#2a1c1e', mc = retro ? E.r : '#3a2626';
      rect(ctx, 0, 0, VW, VH, bc);
      var ox = -(camX * 0.5) % 32;
      for (var yy = 0; yy < VH; yy += 16) for (x = ox - 32 + ((yy / 16) % 2) * 16; x < VW; x += 32) rect(ctx, x, yy, 1, 16, mc);
      for (yy = 0; yy < VH; yy += 16) rect(ctx, 0, yy, VW, 1, mc);
      for (k = 0; k < 4; k++) { x = ((k * 200 - camX * 0.5) % 800 + 800) % 800 - 40; rect(ctx, x, 150, 18, 26, retro ? E.k : '#120a0a'); var fl = Math.sin(t * 12 + k) * 2; poly(ctx, [x + 4, 170, x + 9, 156 + fl, x + 14, 170], retro ? E.y : '#ffb347'); }
    }
  }
  function tar(ctx, LV, camX, t, retro) {   // ctx уже сдвинут на камеру; camX — только для отсечения
    var c0 = retro ? E.R : '#ff7a1a', c1 = retro ? E.y : '#ffd24a';
    var x0 = Math.max(0, Math.floor(camX / T) - 1), x1 = Math.min(LV.w, x0 + VW / T + 3);
    for (var ty = 0; ty < LV.h; ty++) for (var tx = x0; tx < x1; tx++) {
      if (LV.t[ty].charAt(tx) !== '~') continue;
      var X = tx * T, Y = ty * T, top = L.tileAt(LV, tx, ty - 1) !== '~';
      rect(ctx, X, Y + (top ? 3 : 0), T, T - (top ? 3 : 0), c0);
      if (top) { var w = Math.sin(t * 4 + tx) * 1.5; rect(ctx, X, Y + 3 + w, T, 2, c1); if ((Math.floor(t * 3) + tx) % 5 === 0) circ(ctx, X + 8, Y + 6, 2, c1); }
    }
  }
  // ---------- частицы ----------
  var FX = { list: [],
    add: function (x, y, o) { o = o || {}; for (var i = 0; i < (o.n || 8); i++) { var a = (o.a != null ? o.a : 0) + (Math.random() - 0.5) * (o.spread != null ? o.spread : Math.PI * 2), s = (o.sp || 80) * (0.4 + Math.random() * 0.6);
      this.list.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: o.life || 0.5, life: o.life || 0.5, c: o.c || '#fff', r: o.r || 2, g: o.g != null ? o.g : 200 }); } if (this.list.length > 300) this.list.splice(0, this.list.length - 300); },
    step: function (dt) { for (var i = this.list.length - 1; i >= 0; i--) { var p = this.list[i]; p.t -= dt; if (p.t <= 0) { this.list.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } },
    draw: function (ctx, cx, retro) { for (var i = 0; i < this.list.length; i++) { var p = this.list[i], a = p.t / p.life; if (retro) { if (a > 0.25) rect(ctx, Math.round((p.x - cx) / 2) * 2, Math.round(p.y / 2) * 2, 2, 2, p.c); } else { ctx.globalAlpha = a; circ(ctx, p.x - cx, p.y, p.r * (0.5 + a * 0.5), p.c); } } ctx.globalAlpha = 1; },
    clear: function () { this.list = []; } };

  // ---------- уровень ----------
  function heroOpts(P, ui, S) { return { face: P.face, run: ui.runPh, air: !P.ground, swing: S.key && S.key.t > 0 ? 1 - S.key.t / L.K.KEY_T : 0, flash: P.inv > 0 && S.phase === 'play' }; }
  function renderLevel(g, ctx, S, ui) {
    var retro = rt(g), LV = S.LV, t = g.time, cam = Math.round(ui.cam || 0), reg = regOf(LV);
    ctx.imageSmoothingEnabled = !retro;
    background(ctx, reg, cam, retro, t);
    ctx.save(); ctx.translate(-cam, 0);
    LV.camps.forEach(function (c) { lantern(ctx, c.tx * T + 8, (c.ty + 1) * T, !!c.lit, t, retro); });
    if (LV.exit) finishPart(ctx, LV.exit.tx * T + 8, (LV.exit.ty + 1) * T, t, retro, S.phase === 'clear');
    ctx.drawImage(levelLayer(LV, retro), 0, 0);
    tar(ctx, LV, cam, t, retro);
    LV.groups.forEach(function (gr) { mechTiles(ctx, LV, gr, t, retro); winch(ctx, gr.winch.tx * T + 8, (gr.winch.ty + 1) * T, gr, t, retro); });
    LV.items.forEach(function (it) {
      if (S.got[it.id]) return; var x = it.tx * T + 8, y = it.ty * T + 8;
      if (x < cam - 20 || x > cam + VW + 20) return;
      if (it.k === 'nut') nut(ctx, x, y, t, retro); else heartGear(ctx, x, y + Math.sin(t * 3) * 1.5, retro, 1.2);
    });
    S.enemies.forEach(function (e) { if ((e.alive || e.dead > 0) && e.x > cam - 60 && e.x < cam + VW + 60) { if (e.k === 'Z') e.kindName = LV.boss; var sh = e.stop > 0 && e.stop < 1.2 ? Math.sin(t * 60) * 1 : 0; e.x += sh; enemy(ctx, e, e.stop > 0 ? 0 : t, retro); e.x -= sh; } });
    S.bolts.forEach(function (b) { rect(ctx, b.x - 3, b.y - 2, 6, 4, retro ? E.R : '#ff6a2a'); rect(ctx, b.x - 1, b.y - 1, 2, 2, retro ? E.y : '#ffe08a'); });
    var P = S.hero;
    if (S.phase !== 'dead' || S.phaseT < 0.15) hero(ctx, P.x, P.y, heroOpts(P, ui, S), retro, t);
    else { var dt2 = S.phaseT - 0.15; hero(ctx, P.x, Math.min(P.y, LV.h * T) - 60 * dt2 + 500 * dt2 * dt2, { face: P.face, air: true, run: 0 }, retro, t); }
    FX.draw(ctx, 0, retro);
    ui.toasts.forEach(function (q) {
      var a = Math.min(1, q.t / q.life * 2), yy = q.y - (1 - q.t / q.life) * 18;
      ctx.globalAlpha = a; g.text(q.text, q.x, yy, { size: q.big ? 12 : 10, align: 'center', color: q.color, weight: 800 }); ctx.globalAlpha = 1;
    });
    ctx.restore();
    hud(g, ctx, S, ui, retro);
    if (ui.banner) banner(g, ctx, ui.banner, retro);
    if (ui.msg && !ui.banner) { ctx.globalAlpha = Math.min(1, ui.msg.a * 2); g.text(ui.msg.text, VW / 2, VH - 16, { size: 12, align: 'center', color: ui.msg.color, weight: 800, maxWidth: VW - 24, minSize: 8 }); ctx.globalAlpha = 1; }
  }
  function foxHead(ctx, x, y, retro) { var K = FOX[retro ? 'r' : 'm']; rect(ctx, x - 4, y - 3, 8, 6, K.fur); poly(ctx, [x - 4, y - 3, x - 3, y - 7, x - 1, y - 3], K.fur); poly(ctx, [x + 1, y - 3, x + 3, y - 7, x + 4, y - 3], K.fur); rect(ctx, x - 2, y + 1, 4, 2, K.white); rect(ctx, x - 2, y - 1, 1, 1, K.dark); rect(ctx, x + 1, y - 1, 1, 1, K.dark); }
  function hud(g, ctx, S, ui, retro) {
    var th = g.th();
    if (!retro) { ctx.fillStyle = 'rgba(16,10,8,.55)'; ctx.fillRect(0, 0, VW, 20); } else rect(ctx, 0, 0, VW, 20, E.k);
    foxHead(ctx, 12, 10, retro); g.text('×' + Math.max(0, S.lives), 20, 14, { size: 11, color: th.ink, weight: 800 });
    for (var i = 0; i < L.K.HEARTS; i++) heartIcon(ctx, 54 + i * 13, 9, i < S.hearts, retro);
    nut(ctx, 104, 10, 0, retro, 0.8); g.text(String(S.nuts).padStart(2, '0'), 112, 14, { size: 11, color: th.ink, weight: 800 });
    g.text(g.t('score') + ' ' + S.score, 146, 14, { size: 11, color: th.ink, weight: 800 });
    g.text(g.t('n_' + S.id), VW - 8, 14, { size: 10, align: 'right', color: th.muted, weight: 700, maxWidth: 200, minSize: 8 });
    var B = S.boss;
    if (B && B.st !== 'sleep' && B.alive) {
      var w = 120, x = VW / 2 - w / 2, y = 26;
      rect(ctx, x - 1, y - 1, w + 2, 8, retro ? E.w : 'rgba(0,0,0,.6)'); rect(ctx, x, y, w, 6, retro ? E.k : '#2a1a14'); rect(ctx, x, y, w * B.hp / B.hpMax, 6, retro ? E.R : '#ff6a3a');
      g.text(g.t('b_' + S.LV.boss), VW / 2, y + 18, { size: 10, align: 'center', color: th.ink, weight: 800 });
    }
  }
  // строки плашки — переносом по словам в ширину плашки (длинная вводная фраза и EN/TR/ES/PT не вылезают за холст);
  // выделенная (последняя) строка после переноса может занять несколько строк — выделяются все её части (hiFrom)
  function wrapLine(ctx, l, maxW) {
    var out = [], cur = '';
    String(l).split(' ').forEach(function (w) { var nx = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(nx).width > maxW) { out.push(cur); cur = w; } else cur = nx; });
    if (cur) out.push(cur); return out;
  }
  function banner(g, ctx, b, retro) {
    var th = g.th(), a = Math.min(1, b.a * 2), y = 70;
    if (b.lines && !b._wrapped) {
      ctx.save(); ctx.font = '800 11px ' + th.font; var out = [], from = 0;
      b.lines.forEach(function (l, i) { if (i === b.lines.length - 1) from = out.length; out.push.apply(out, wrapLine(ctx, l, VW - 140)); });
      ctx.restore(); b.lines = out; b.hiFrom = from; b._wrapped = true;
    }
    ctx.globalAlpha = a;
    if (retro) { rect(ctx, 60, y, VW - 120, 60 + (b.lines ? b.lines.length * 16 : 0), E.k); ctx.strokeStyle = E.y; ctx.lineWidth = 2; ctx.strokeRect(61, y + 1, VW - 122, 58 + (b.lines ? b.lines.length * 16 : 0)); }
    else { ctx.fillStyle = 'rgba(20,12,10,.72)'; ctx.fillRect(60, y, VW - 120, 60 + (b.lines ? b.lines.length * 16 : 0)); rect(ctx, 60, y, VW - 120, 2, b.color || th.accent); }
    g.text(b.title, VW / 2, y + 28, { size: 20, align: 'center', color: b.color || th.accent, weight: 900 });
    if (b.sub) g.text(b.sub, VW / 2, y + 48, { size: 11, align: 'center', color: th.ink, weight: 700 });
    if (b.lines) b.lines.forEach(function (l, i) { g.text(l, VW / 2, y + 70 + i * 16, { size: 11, align: 'center', color: b.hiLast && i >= b.hiFrom ? th.warn : th.muted, weight: 800, maxWidth: VW - 132, minSize: 9 }); });
    ctx.globalAlpha = 1;
  }

  // ---------- Верстак: выбор уровня ----------
  // M = { prog, sel (id), note, noteA }; клетки 5 в ряд на край, звёзды и рекорд уровня
  function star(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); }
  var SEL = { x0: 132, dx: 72, y0: 62, dy: 50, w: 58, h: 40 };
  function selCell(id) { var n = SK.MAP.node(id); return { x: SEL.x0 + (n.n - 1) * SEL.dx, y: SEL.y0 + (n.r - 1) * SEL.dy }; }
  function renderSelect(g, ctx, M) {
    var retro = rt(g), t = g.time, th = g.th(), MAP = SK.MAP, p = M.prog, cur = MAP.node(M.sel);
    ctx.imageSmoothingEnabled = !retro;
    background(ctx, cur.r, t * 6, retro, t);
    if (!retro) { ctx.fillStyle = 'rgba(10,6,4,.45)'; ctx.fillRect(0, 0, VW, VH); }
    if (!retro) { ctx.fillStyle = 'rgba(16,10,8,.6)'; ctx.fillRect(0, 0, VW, 24); } else rect(ctx, 0, 0, VW, 24, E.k);
    g.text(g.t('selTitle'), 10, 16, { size: 13, color: th.accent, weight: 900 });
    var st = SK.save.stats(p);
    g.text('★ ' + st.stars + '/' + st.maxStars + '   ' + g.t('total') + ': ' + SK.save.total(p), VW - 10, 16, { size: 11, align: 'right', color: th.ink, weight: 800, maxWidth: 300, minSize: 8 });
    for (var r = 1; r <= MAP.REGIONS; r++) {
      var y = SEL.y0 + (r - 1) * SEL.dy, P = REG[r][retro ? 'r' : 'm'];
      g.text(g.t('r' + r), 12, y + 4, { size: 10, color: r === cur.r ? th.accent : th.muted, weight: 800, maxWidth: SEL.x0 - SEL.w / 2 - 18, minSize: 7 });
      MAP.region(r).forEach(function (id) {
        var c = selCell(id), n = MAP.node(id), open = MAP.isOpen(p, id), stars = p.cleared[id] | 0, sel = id === M.sel;
        var X = c.x - SEL.w / 2, Y = c.y - SEL.h / 2;
        rect(ctx, X, Y, SEL.w, SEL.h, open ? P.g[n.n % 4] : (retro ? E.k : 'rgba(40,30,30,.8)'));
        rect(ctx, X, Y, SEL.w, 3, open ? P.top : (retro ? E.d : '#4a3c3a'));
        if (sel) { ctx.strokeStyle = retro ? E.w : '#fff4e6'; ctx.lineWidth = 2; ctx.strokeRect(X - 2, Y - 2, SEL.w + 4, SEL.h + 4); }
        if (!open) { rect(ctx, c.x - 4, c.y - 2, 8, 7, retro ? E.d : '#6a6070'); ctx.strokeStyle = retro ? E.d : '#6a6070'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y - 3, 3.5, Math.PI, 0); ctx.stroke(); return; }
        if (n.kind === 'fort') { var fc = retro ? E.l : '#d8c7a8'; rect(ctx, c.x - 9, c.y - 12, 18, 16, fc); for (var i = 0; i < 3; i++) rect(ctx, c.x - 9 + i * 7, c.y - 15, 4, 3, fc); rect(ctx, c.x - 3, c.y - 4, 6, 8, retro ? E.k : '#4a3c3a'); }
        else g.text(String(n.n), c.x, c.y + 2, { size: 16, align: 'center', color: retro ? E.w : '#fff4e6', weight: 900 });
        for (var s2 = 0; s2 < 3; s2++) star(ctx, c.x - 12 + s2 * 12, c.y + 13, 4.2, s2 < stars ? (retro ? E.y : '#ffd34d') : (retro ? E.d : 'rgba(0,0,0,.35)'));
      });
    }
    var sc = selCell(M.sel);
    hero(ctx, sc.x + SEL.w / 2 - 6, sc.y + SEL.h / 2 - 1, { face: -1, run: 0, air: false }, retro, t);
    if (!retro) { ctx.fillStyle = 'rgba(16,10,8,.6)'; ctx.fillRect(0, VH - 40, VW, 40); } else rect(ctx, 0, VH - 40, VW, 40, E.k);
    var best = p.best[M.sel] | 0, tag = (p.cleared[M.sel] ? '  ★' + p.cleared[M.sel] : '') + (best ? '  ' + g.t('best') + ': ' + best : '');
    g.text(g.t('n_' + M.sel) + tag, VW / 2, VH - 24, { size: 12, align: 'center', color: th.ink, weight: 800, maxWidth: VW - 20, minSize: 8 });
    g.text(M.note || g.t('selHint'), VW / 2, VH - 8, { size: 10, align: 'center', color: M.note ? th.warn : th.muted, weight: 700, maxWidth: VW - 20, minSize: 7 });
  }
  // клик/тап по клетке Верстака → id уровня или null
  function selectAt(x, y) { var hit = null; SK.MAP.NODES.forEach(function (n) { var c = selCell(n.id); if (Math.abs(x - c.x) <= SEL.w / 2 + 3 && Math.abs(y - c.y) <= SEL.h / 2 + 3) hit = n.id; }); return hit; }

  SK.R = { VW: VW, VH: VH, E: E, FX: FX, REG: REG, hero: hero, enemy: enemy, boss: boss, nut: nut, heartGear: heartGear, heartIcon: heartIcon, windKey: windKey,
    lantern: lantern, finishPart: finishPart, winch: winch, crateTile: crateTile, background: background, cog: cog, foxHead: foxHead, star: star, selectAt: selectAt, KEYC: KEYC };
  SK.renderLevel = renderLevel; SK.renderSelect = renderSelect;
})(typeof window !== 'undefined' ? window : globalThis);
