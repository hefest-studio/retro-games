/* СКОК · рендер обеих тем. SKOK.R — примитивы (герой, враги, предметы, клетки), SKOK.renderLevel(g, ctx, S, ui),
   SKOK.renderMap(g, ctx, M), SKOK.renderShop / renderLever(g, ctx, G).
   modern — мягкие градиенты и тени; retro — 16-цветная палитра ПК конца 80-х, жёсткие пиксели, без сглаживания.
   Облик свой: лис Скок — рыжий, без головного убора, в коричневом кожаном жилете с бирюзовой и горчичной заплатками;
   земля — «заплатная» (лоскуты со стежками и войлочной каймой), ящики — деревянные с выжженным клеймом-шестернёй.
   Статичный слой клеток кэшируется в offscreen-canvas по (уровень, ревизия клеток, тема). */
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
  var SUITC = { m: { apron: '#3c3a40', apronGlow: '#ff8a2a', wing: '#b03a6e', wingD: '#6e1f43', armor: '#c47a3a', armorD: '#8a4f22', rivet: '#ffd9a0', boot: '#d6a640', bootD: '#8f6a1e' },
    r: { apron: E.d, apronGlow: E.y, wing: E.M, wingD: E.m, armor: E.O, armorD: E.n, rivet: E.y, boot: E.y, bootD: E.n } };
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
  // o: { face, run (фаза), air, vy, low, slide, suit, suitHp, glide, pound, flash, inv }
  function hero(ctx, x, y, o, retro, t) {
    if (o.flash && Math.floor(t * 18) % 2) return;
    var K = FOX[retro ? 'r' : 'm'], C = SUITC[retro ? 'r' : 'm'], f = o.face || 1, suit = o.suit;
    ctx.save(); ctx.translate(retro ? Math.round(x) : x, retro ? Math.round(y) : y);
    if (!retro) { ctx.globalAlpha = 0.25; ell(ctx, 0, 0, 8, 2, '#000'); ctx.globalAlpha = 1; }
    ctx.scale(f, 1);
    if (o.low) ctx.scale(1.12, 0.6);
    var ph = o.air ? 0 : Math.sin(o.run || 0), l1 = Math.round(ph * 2), l2 = -l1;
    if (o.air) { l1 = -2; l2 = 2; }
    // хвост (за спиной; в прыжке — торчком)
    var tu = o.air ? -4 : Math.round(Math.sin((o.run || 0) * 0.5) * 1);
    poly(ctx, [-3, -8, -9, -12 + tu, -14, -11 + tu, -13, -6, -6, -5], K.fur);
    poly(ctx, [-11, -12 + tu, -14, -11 + tu, -14, -8, -12, -9 + tu], K.white);
    // ноги
    rect(ctx, -4 + l1, -6, 3, 6, K.leg); rect(ctx, 1 + l2, -6, 3, 6, K.leg);
    if (suit === 'boots') {
      rect(ctx, -5 + l1, -4, 5, 3, C.boot); rect(ctx, 0 + l2, -4, 5, 3, C.boot);
      rect(ctx, -4 + l1, -1, 3, 1, C.bootD); rect(ctx, 1 + l2, -1, 3, 1, C.bootD);
    }
    // зонтик за спиной (сложен)
    if (suit === 'wings' && !o.glide) { line(ctx, -6, -22, -2, -5, C.wingD, 3); line(ctx, -6, -22, -3, -8, C.wing, 2); rect(ctx, -7, -23, 2, 2, C.wingD); }
    // туловище: жилет с заплатками, белая грудка
    rect(ctx, -5, -14, 10, 9, K.vest); rect(ctx, -5, -6, 10, 1, K.vestD);
    rect(ctx, 2, -14, 3, 8, K.white);
    rect(ctx, -4, -12, 3, 3, K.p1); rect(ctx, -1, -9, 3, 2, K.p2);
    if (!retro) { rect(ctx, -4, -12, 1, 1, K.stitch); rect(ctx, -2, -10, 1, 1, K.stitch); rect(ctx, 1, -9, 1, 1, K.stitch); }
    if (suit === 'apron') {
      rect(ctx, -3, -13, 8, 9, C.apron); rect(ctx, 3, -15, 1, 3, C.apron);
      rect(ctx, 0, -9, 3, 2, (o.suitHp || 2) > 1 ? C.apronGlow : K.furD);
      if ((o.suitHp || 2) < 2) { rect(ctx, -2, -12, 2, 1, K.dark); rect(ctx, 2, -6, 2, 1, K.dark); }
    } else if (suit === 'armor') {
      ell(ctx, -5, -10, 4, 6, C.armorD); rect(ctx, -5, -14, 10, 9, C.armor);
      rect(ctx, -5, -11, 10, 1, C.armorD); rect(ctx, -5, -8, 10, 1, C.armorD);
      rect(ctx, -3, -13, 1, 1, C.rivet); rect(ctx, 3, -13, 1, 1, C.rivet); rect(ctx, 0, -7, 1, 1, C.rivet);
      rect(ctx, 2, -15, 4, 3, C.armor);
    }
    // лапа
    var arm = o.air ? -3 : Math.round(-ph * 2);
    if (suit === 'wings' && o.glide) { rect(ctx, 2, -20, 2, 7, K.fur); }
    else rect(ctx, 1 + arm, -12, 2, 5, K.fur);
    // голова: без головного убора, острые уши, белая морда
    rect(ctx, -3, -21, 8, 7, K.fur); rect(ctx, -3, -15, 8, 1, K.furD);
    poly(ctx, [-3, -21, -2, -27, 1, -21], K.fur); poly(ctx, [1, -21, 3, -27, 5, -21], K.fur);
    rect(ctx, -2, -26, 1, 2, K.dark); rect(ctx, 2, -26, 2, 2, K.dark);
    poly(ctx, [4, -20, 10, -17, 4, -15], K.white); rect(ctx, 9, -18, 2, 2, K.dark);
    rect(ctx, 0, -17, 4, 2, K.white);
    rect(ctx, 2, -20, 2, 2, K.eye); if (!retro) rect(ctx, 3, -20, 1, 1, '#ffffff');
    // раскрытый зонтик
    if (suit === 'wings' && o.glide) {
      line(ctx, 3, -14, 2, -33, C.wingD, 1.5);
      ctx.fillStyle = C.wing; ctx.beginPath(); ctx.moveTo(-12, -30); ctx.quadraticCurveTo(2, -44, 16, -30); ctx.closePath(); ctx.fill();
      for (var i = 0; i < 4; i++) { var ex = -12 + i * 7; poly(ctx, [ex, -30, ex + 7, -30, ex + 3.5, -28], C.wingD); }
      line(ctx, 2, -38, -6, -31, C.wingD, 1); line(ctx, 2, -38, 10, -31, C.wingD, 1);
    }
    if (o.slide) { ctx.globalAlpha = 0.6; rect(ctx, -16, -8, 6, 1, K.white); rect(ctx, -20, -4, 7, 1, K.white); ctx.globalAlpha = 1; }
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
      if (e.how === 'stomp') { ctx.translate(x, y); ctx.scale(1.3, 0.35); ctx.translate(-x, -y); }
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
  }

  // ---------- предметы ----------
  var IC = { m: { nut: '#c9cdd4', nutD: '#7d838c', key: '#e7b93a', keyD: '#9a7419', heart: '#e2464f', chest: '#8a5a2b', chestD: '#5a3a18', lamp: '#ffd27a', post: '#5a3a24', bell: '#d19a3a', bellD: '#8f6420' },
    r: { nut: E.l, nutD: E.d, key: E.y, keyD: E.n, heart: E.R, chest: E.n, chestD: '#552a00', lamp: E.y, post: E.n, bell: E.y, bellD: E.n } };
  var SUITICON = { m: { apron: '#ff8a2a', wings: '#d0508a', armor: '#d9884a', boots: '#e8c24a' }, r: { apron: E.R, wings: E.M, armor: E.O, boots: E.y } };
  function nut(ctx, x, y, t, retro, s) {
    var C = IC[retro ? 'r' : 'm'], w = Math.abs(Math.cos(t * 3 + x * 0.05)) * 5 + 1; s = s || 1;
    if (retro) { var X0 = Math.round(x), Y0 = Math.round(y), ww = Math.max(1, Math.round(w)); rect(ctx, X0 - ww, Y0 - 3, ww * 2, 6, C.nut); rect(ctx, X0 - Math.max(1, ww - 2), Y0 - 5, Math.max(2, ww * 2 - 4), 10, C.nut); if (ww > 2) rect(ctx, X0 - 1, Y0 - 1, 2, 2, C.nutD); return; }
    ctx.save(); ctx.translate(x, y); ctx.scale(w / 6 * s, s);
    poly(ctx, [-6, 0, -3, -5, 3, -5, 6, 0, 3, 5, -3, 5], C.nut); circ(ctx, 0, 0, 2, C.nutD); rect(ctx, -4, -4, 3, 1, '#ffffff');
    ctx.restore();
  }
  function keyIcon(ctx, x, y, t, retro) { var C = IC[retro ? 'r' : 'm'], b = Math.sin(t * 3) * 2; circ(ctx, x - 3, y + b, 4, C.key); circ(ctx, x - 3, y + b, 1.6, C.keyD); rect(ctx, x, y - 1 + b, 7, 2, C.key); rect(ctx, x + 4, y + 1 + b, 2, 3, C.key); }
  function heartGear(ctx, x, y, retro) { var C = IC[retro ? 'r' : 'm']; cog(ctx, x, y, 5, 8, C.keyD, 0); circ(ctx, x - 2, y - 1, 2.6, C.heart); circ(ctx, x + 2, y - 1, 2.6, C.heart); poly(ctx, [x - 4.5, y, x + 4.5, y, x, y + 4], C.heart); }
  function chest(ctx, x, y, suit, t, retro) {
    var C = IC[retro ? 'r' : 'm'], c = SUITICON[retro ? 'r' : 'm'][suit] || C.key;
    rect(ctx, x - 7, y - 10, 14, 10, C.chest); rect(ctx, x - 7, y - 10, 14, 3, C.chestD); rect(ctx, x - 7, y - 5, 14, 1, C.chestD);
    cog(ctx, x, y - 4, 2.4, 6, c, t * 2);
    if (!retro) { ctx.globalAlpha = 0.35 + Math.sin(t * 6) * 0.15; circ(ctx, x, y - 5, 9, c); ctx.globalAlpha = 1; }
  }
  function suitIcon(ctx, x, y, suit, retro) {
    var C = SUITC[retro ? 'r' : 'm'];
    if (suit === 'apron') { rect(ctx, x - 4, y - 5, 8, 9, C.apron); rect(ctx, x - 1, y - 1, 3, 2, C.apronGlow); }
    else if (suit === 'wings') { ctx.fillStyle = C.wing; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.quadraticCurveTo(x, y - 10, x + 7, y); ctx.closePath(); ctx.fill(); line(ctx, x, y - 5, x, y + 5, C.wingD, 1.5); }
    else if (suit === 'armor') { ell(ctx, x, y, 6, 5, C.armor); rect(ctx, x - 6, y - 1, 12, 1, C.armorD); rect(ctx, x - 1, y - 4, 1, 1, C.rivet); }
    else if (suit === 'boots') { rect(ctx, x - 5, y - 3, 4, 5, C.boot); rect(ctx, x + 1, y - 3, 4, 5, C.boot); line(ctx, x - 5, y + 4, x - 1, y + 3, C.bootD, 1); line(ctx, x + 1, y + 4, x + 5, y + 3, C.bootD, 1); }
  }
  function lantern(ctx, x, y, lit, t, retro) {
    var C = IC[retro ? 'r' : 'm'];
    rect(ctx, x - 1, y - 26, 2, 26, C.post); rect(ctx, x - 1, y - 27, 6, 2, C.post);
    rect(ctx, x + 2, y - 25, 5, 7, lit ? C.lamp : '#3a3030'); rect(ctx, x + 2, y - 26, 5, 1, C.post);
    if (lit && !retro) { ctx.globalAlpha = 0.25 + Math.sin(t * 5) * 0.06; circ(ctx, x + 4, y - 21, 12, C.lamp); ctx.globalAlpha = 1; }
  }
  function door(ctx, x, y, open, t, retro, glow) {
    var C = IC[retro ? 'r' : 'm'];
    rect(ctx, x - 8, y - 30, 16, 30, retro ? E.k : '#2a1a10');
    rect(ctx, x - 7, y - 28, 14, 28, retro ? E.n : '#7a4c28'); ctx.fillStyle = retro ? E.n : '#7a4c28'; ctx.beginPath(); ctx.arc(x, y - 28, 7, Math.PI, 0); ctx.fill();
    rect(ctx, x - 1, y - 28, 1, 28, retro ? '#552a00' : '#5a3418'); rect(ctx, x - 6, y - 20, 12, 1, retro ? '#552a00' : '#5a3418'); rect(ctx, x - 6, y - 9, 12, 1, retro ? '#552a00' : '#5a3418');
    rect(ctx, x + 3, y - 15, 2, 3, C.key);
    if (glow && Math.floor(t * 3) % 2) { rect(ctx, x - 1, y - 40, 2, 5, C.key); rect(ctx, x - 1, y - 33, 2, 2, C.key); }
  }
  // столб-часовня с колоколом
  function chapel(ctx, x, gy, bellY, t, retro, ring) {
    var C = IC[retro ? 'r' : 'm'], H = L.K.POST_H * T, top = gy - H;
    // часовенка справа
    var wc = retro ? E.l : '#d8c7a8', rc = retro ? E.r : '#8b3a2e';
    rect(ctx, x + 14, gy - 40, 34, 40, wc); poly(ctx, [x + 10, gy - 40, x + 31, gy - 58, x + 52, gy - 40], rc);
    rect(ctx, x + 26, gy - 18, 10, 18, retro ? E.n : '#6b4226'); circ(ctx, x + 31, gy - 30, 5, retro ? E.w : '#fff6e0'); line(ctx, x + 31, gy - 30, x + 31, gy - 33, retro ? E.k : '#2a1a14', 1); line(ctx, x + 31, gy - 30, x + 33, gy - 30, retro ? E.k : '#2a1a14', 1);
    // столб с крышей-навершием
    rect(ctx, x - 2, top, 4, H, C.post); rect(ctx, x - 3, top, 6, 3, C.bellD); poly(ctx, [x - 7, top, x, top - 9, x + 7, top], rc);
    for (var yy = top + 12; yy < gy; yy += 16) rect(ctx, x - 3, yy, 6, 1, C.bellD);
    // колокол на ползунке
    var sw = ring ? Math.sin(t * 25) * 3 : 0;
    rect(ctx, x - 4, bellY - 9, 8, 2, C.bellD);
    poly(ctx, [x - 4 + sw, bellY - 7, x + 4 + sw, bellY - 7, x + 7 + sw, bellY + 5, x - 7 + sw, bellY + 5], C.bell);
    rect(ctx, x - 7 + sw, bellY + 4, 14, 2, C.bellD); circ(ctx, x + sw * 1.6, bellY + 7, 1.6, C.bellD);
    if (!retro) { rect(ctx, x - 2 + sw, bellY - 5, 2, 7, '#f6d48a'); }
  }

  // ---------- клетки ----------
  function crateTile(ctx, X, Y, ch, retro) {
    var wood = retro ? E.n : '#a8672e', woodD = retro ? '#552a00' : '#6e4019', band = retro ? E.d : '#4b4f57', stamp = retro ? E.k : '#3d2210';
    if (ch === 'u') { rect(ctx, X, Y, T, T, retro ? '#552a00' : '#5c3a1e'); rect(ctx, X, Y, T, 1, retro ? E.n : '#7a5230'); rect(ctx, X + 2, Y + 2, 2, 2, band); rect(ctx, X + 12, Y + 2, 2, 2, band); rect(ctx, X + 2, Y + 12, 2, 2, band); rect(ctx, X + 12, Y + 12, 2, 2, band); return; }
    if (ch === 'x') { rect(ctx, X, Y, T, T, retro ? E.y : '#d7b27a'); rect(ctx, X, Y, T, 1, retro ? E.w : '#ecd3a5'); line(ctx, X + 2, Y + 2, X + 14, Y + 14, retro ? E.n : '#8a6a3a', 2); line(ctx, X + 14, Y + 2, X + 2, Y + 14, retro ? E.n : '#8a6a3a', 2); rect(ctx, X, Y + 15, T, 1, retro ? E.n : '#8a6a3a'); return; }
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
    else if (L.isCrate(ch) || ch === 'u' || ch === 'x') crateTile(ctx, X, Y, ch, retro);
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
    for (var ty = 0; ty < LV.h; ty++) for (var tx = 0; tx < LV.w; tx++) { var ch = LV.t[ty].charAt(tx); if (ch !== '.' && ch !== '~') drawTile(c, LV, ch, tx, ty, P, retro); }
    // висячие ящики: верёвка с крюком уходит вверх (ящики подвешены, а не парят)
    var rope = retro ? E.y : '#c9a878', hook = retro ? E.l : '#7d838c';
    for (ty = 1; ty < LV.h; ty++) for (tx = 0; tx < LV.w; tx++) {
      var cc = LV.t[ty].charAt(tx);
      if (!(L.isCrate(cc) || cc === 'u')) continue;
      var below = L.tileAt(LV, tx, ty + 1), above = L.tileAt(LV, tx, ty - 1);
      if (L.isSolid(below) || L.isSolid(above) || above === 'T') continue;
      var X = tx * T, Y = ty * T, top = ty - 1; while (top > 0 && L.tileAt(LV, tx, top - 1) === '.') top--;
      if (LV.fort && top <= 0) continue;
      line(c, X + 3, Y, X + 8, Y - 6, rope, 1); line(c, X + 13, Y, X + 8, Y - 6, rope, 1);
      rect(c, X + 7, Y - 9, 2, 4, hook); rect(c, X + 7.5, top * T, 1, Y - 9 - top * T, rope);
    }
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
  function heroOpts(P, ui, S) { return { face: P.face, run: ui.runPh, air: !P.ground, vy: P.vy, low: P.low, slide: P.slide, suit: P.suit, suitHp: P.suitHp, glide: P.glide, pound: P.pound, flash: P.inv > 0 && S.phase === 'play' }; }
  function renderLevel(g, ctx, S, ui) {
    var retro = rt(g), LV = S.LV, t = g.time, cam = Math.round(ui.cam || 0), reg = regOf(LV);
    ctx.imageSmoothingEnabled = !retro;
    background(ctx, reg, cam, retro, t);
    ctx.save(); ctx.translate(-cam, 0);
    // предметы за клетками: дверь, часовня, фонари
    if (LV.door) door(ctx, LV.door.tx * T + 8, (LV.door.ty + 1) * T, false, t, retro, S.keyGot);
    LV.camps.forEach(function (c) { lantern(ctx, c.tx * T + 8, (c.ty + 1) * T, !!c.lit, t, retro); });
    if (LV.exit) chapel(ctx, S.bell.x, S.bell.gy, S.phase === 'clear' && S.ring && S.ring.bell ? S.ring.y : (S.bell.y || S.bell.gy - 22), t, retro, S.phase === 'clear');
    ctx.drawImage(levelLayer(LV, retro), 0, 0);
    tar(ctx, LV, cam, t, retro);
    // гайки и ключ
    LV.items.forEach(function (it) {
      if (S.got[it.id]) return; var x = it.tx * T + 8, y = it.ty * T + 8;
      if (x < cam - 20 || x > cam + VW + 20) return;
      if (it.k === 'nut') nut(ctx, x, y, t, retro); else keyIcon(ctx, x, y, t, retro);
    });
    S.pickups.forEach(function (q) { if (q.k === 'suit') chest(ctx, q.x, q.y, q.suit, t, retro); else heartGear(ctx, q.x, q.y - 6, retro); });
    S.enemies.forEach(function (e) { if ((e.alive || e.dead > 0) && e.x > cam - 60 && e.x < cam + VW + 60) { if (e.k === 'Z') e.kindName = LV.boss; enemy(ctx, e, t, retro); } });
    // заклёпки и болты
    S.rivets.forEach(function (r) { if (retro) { rect(ctx, Math.round(r.x) - 2, Math.round(r.y) - 2, 4, 4, E.y); rect(ctx, Math.round(r.x) - 1, Math.round(r.y) - 1, 2, 2, E.R); } else { circ(ctx, r.x, r.y, 4, 'rgba(255,140,40,.35)'); circ(ctx, r.x, r.y, 2.4, '#ffd24a'); rect(ctx, r.x - 1, r.y - 1, 2, 2, '#fff3c0'); } });
    S.bolts.forEach(function (b) { rect(ctx, b.x - 3, b.y - 2, 6, 4, retro ? E.R : '#ff6a2a'); rect(ctx, b.x - 1, b.y - 1, 2, 2, retro ? E.y : '#ffe08a'); });
    var P = S.hero;
    var inChapel = S.phase === 'clear' && S.ring && S.ring.bell != null && P.x > S.bell.x + 26;   // вошёл в часовню
    if (inChapel) { /* скрыт */ }
    else if (S.phase !== 'dead' || S.phaseT < 0.15) hero(ctx, P.x, P.y, heroOpts(P, ui, S), retro, t);
    else { var dt2 = S.phaseT - 0.15; hero(ctx, P.x, Math.min(P.y, LV.h * T) - 60 * dt2 + 500 * dt2 * dt2, { face: P.face, air: true, run: 0 }, retro, t); }
    FX.draw(ctx, 0, retro);
    // всплывающие очки
    ui.toasts.forEach(function (q) {
      var a = Math.min(1, q.t / q.life * 2), yy = q.y - (1 - q.t / q.life) * 18;
      ctx.globalAlpha = a; g.text(q.text, q.x, yy, { size: q.big ? 12 : 10, align: 'center', color: q.color, weight: 800 }); ctx.globalAlpha = 1;
    });
    ctx.restore();
    hud(g, ctx, S, ui, retro);
    if (ui.banner) banner(g, ctx, ui.banner, retro);
    if (ui.msg && !ui.banner) { ctx.globalAlpha = Math.min(1, ui.msg.a * 2); g.text(ui.msg.text, VW / 2, VH - 16, { size: 12, align: 'center', color: ui.msg.color, weight: 800 }); ctx.globalAlpha = 1; }
  }
  function foxHead(ctx, x, y, retro) { var K = FOX[retro ? 'r' : 'm']; rect(ctx, x - 4, y - 3, 8, 6, K.fur); poly(ctx, [x - 4, y - 3, x - 3, y - 7, x - 1, y - 3], K.fur); poly(ctx, [x + 1, y - 3, x + 3, y - 7, x + 4, y - 3], K.fur); rect(ctx, x - 2, y + 1, 4, 2, K.white); rect(ctx, x - 2, y - 1, 1, 1, K.dark); rect(ctx, x + 1, y - 1, 1, 1, K.dark); }
  function hud(g, ctx, S, ui, retro) {
    var th = g.th(), P = S.hero;
    if (!retro) { ctx.fillStyle = 'rgba(16,10,8,.55)'; ctx.fillRect(0, 0, VW, 20); } else rect(ctx, 0, 0, VW, 20, E.k);
    foxHead(ctx, 12, 10, retro); g.text('×' + Math.max(0, S.lives), 20, 14, { size: 11, color: th.ink, weight: 800 });
    nut(ctx, 62, 10, 0, retro, 0.8); g.text(String(S.nuts).padStart(2, '0'), 70, 14, { size: 11, color: th.ink, weight: 800 });
    g.text(g.t('score') + ' ' + S.score, 104, 14, { size: 11, color: th.ink, weight: 800 });
    if (P && P.suit) { suitIcon(ctx, 222, 10, P.suit, retro); g.text(g.t('s_' + P.suit) + (P.suit === 'apron' && P.suitHp > 1 ? ' ×2' : ''), 232, 14, { size: 10, color: th.accent, weight: 800 }); }
    if (S.keyGot) keyIcon(ctx, 352, 9, 0, retro);
    g.text(g.t('n_' + S.id), VW - 8, 14, { size: 10, align: 'right', color: th.muted, weight: 700 });
    var B = S.boss;
    if (B && B.st !== 'sleep' && B.alive) {
      var w = 120, x = VW / 2 - w / 2, y = 26;
      rect(ctx, x - 1, y - 1, w + 2, 8, retro ? E.w : 'rgba(0,0,0,.6)'); rect(ctx, x, y, w, 6, retro ? E.k : '#2a1a14'); rect(ctx, x, y, w * B.hp / B.hpMax, 6, retro ? E.R : '#ff6a3a');
      g.text(g.t('b_' + S.LV.boss), VW / 2, y + 18, { size: 10, align: 'center', color: th.ink, weight: 800 });
    }
  }
  function banner(g, ctx, b, retro) {
    var th = g.th(), a = Math.min(1, b.a * 2), y = 70;
    ctx.globalAlpha = a;
    if (retro) { rect(ctx, 60, y, VW - 120, 60 + (b.lines ? b.lines.length * 16 : 0), E.k); ctx.strokeStyle = E.y; ctx.lineWidth = 2; ctx.strokeRect(61, y + 1, VW - 122, 58 + (b.lines ? b.lines.length * 16 : 0)); }
    else { ctx.fillStyle = 'rgba(20,12,10,.72)'; ctx.fillRect(60, y, VW - 120, 60 + (b.lines ? b.lines.length * 16 : 0)); rect(ctx, 60, y, VW - 120, 2, b.color || th.accent); }
    g.text(b.title, VW / 2, y + 28, { size: 20, align: 'center', color: b.color || th.accent, weight: 900 });
    if (b.sub) g.text(b.sub, VW / 2, y + 48, { size: 11, align: 'center', color: th.ink, weight: 700 });
    if (b.lines) b.lines.forEach(function (l, i) { g.text(l, VW / 2, y + 70 + i * 16, { size: 11, align: 'center', color: i === b.lines.length - 1 && b.hiLast ? th.warn : th.muted, weight: 800 }); });
    ctx.globalAlpha = 1;
  }

  // ---------- карта мира ----------
  function nodeIcon(ctx, n, M, t, retro, th, g) {
    var MAP = SK.MAP, p = M.prog, open = MAP.isOpen(p, n.id), done = MAP.done(p, n.id), x = n.x, y = n.y;
    var ring = retro ? (open ? E.y : E.d) : (open ? '#ffd27a' : '#6a6070'), fill = retro ? (done ? E.n : E.k) : (done ? '#8a5a2b' : '#2b2230');
    if (!open) { circ(ctx, x, y, 5, ring); return; }
    if (n.kind === 'level') {
      circ(ctx, x, y, 11, ring); circ(ctx, x, y, 9, fill);
      g.text(n.k, x, y + 4, { size: 11, align: 'center', color: retro ? E.w : '#fff4e6', weight: 900 });
      if (done) { var C = IC[retro ? 'r' : 'm']; poly(ctx, [x + 6, y - 14, x + 10, y - 14, x + 12, y - 8, x + 4, y - 8], C.bell); }
      if (p.secret && p.secret[n.id]) { cog(ctx, x - 10, y - 10, 3, 6, retro ? E.C : '#7fe0d0', t); }
    } else if (n.kind === 'fort') {
      var c = retro ? E.l : '#7d6a66', cd = retro ? E.d : '#4a3c3a';
      rect(ctx, x - 12, y - 16, 24, 26, c); for (var i = 0; i < 4; i++) rect(ctx, x - 12 + i * 7, y - 20, 4, 4, c);
      rect(ctx, x - 4, y - 2, 8, 12, cd); if (done) { rect(ctx, x - 1, y - 32, 2, 14, cd); poly(ctx, [x + 1, y - 32, x + 10, y - 29, x + 1, y - 26], retro ? E.y : '#ffd27a'); }
    } else if (n.kind === 'shop') {
      var a1 = retro ? E.R : '#d9534f', a2 = retro ? E.w : '#f5ecd8';
      rect(ctx, x - 11, y - 4, 22, 13, retro ? E.n : '#8a5a2b');
      for (var s = 0; s < 4; s++) poly(ctx, [x - 13 + s * 6.5, y - 4, x - 6.5 + s * 6.5, y - 4, x - 9.75 + s * 6.5, y + 1], s % 2 ? a1 : a2);
      poly(ctx, [x - 13, y - 4, x, y - 14, x + 13, y - 4], a1);
      if (done) { ctx.globalAlpha = 0.55; rect(ctx, x - 13, y - 14, 26, 24, retro ? E.k : '#000'); ctx.globalAlpha = 1; }
    } else if (n.kind === 'lever') {
      rect(ctx, x - 10, y - 2, 20, 10, retro ? E.d : '#4b4f57'); line(ctx, x - 2, y - 2, x + 6, y - 14, retro ? E.l : '#c9cdd4', 2); circ(ctx, x + 6, y - 14, 3, retro ? E.R : '#d9534f');
    }
    if (M.fresh[n.id] && Math.floor(t * 3) % 2) g.text(g.t('newTag'), x, y - 18, { size: 9, align: 'center', color: th.warn, weight: 800 });
  }
  function wanderer(ctx, x, y, t, retro) {
    // бродяга: ржавый чайник на ножках
    var c = retro ? E.r : '#9a4a32', cd = retro ? E.k : '#5a2a1a', b = Math.abs(Math.sin(t * 6)) * 2;
    rect(ctx, x - 4, y - 2, 2, 4, cd); rect(ctx, x + 2, y - 2, 2, 4, cd);
    ell(ctx, x, y - 7 - b, 7, 6, c); rect(ctx, x - 3, y - 15 - b, 6, 3, cd); poly(ctx, [x + 6, y - 9 - b, x + 12, y - 13 - b, x + 7, y - 6 - b], c);
    rect(ctx, x - 3, y - 9 - b, 2, 2, retro ? E.y : '#ffe07a'); rect(ctx, x + 1, y - 9 - b, 2, 2, retro ? E.y : '#ffe07a');
  }
  function renderMap(g, ctx, M) {
    var retro = rt(g), t = g.time, th = g.th(), MAP = SK.MAP, p = M.prog;
    ctx.imageSmoothingEnabled = !retro;
    var cur = MAP.node(M.sel), r = M.region || cur.r, P = REG[r][retro ? 'r' : 'm'];
    background(ctx, r, t * 6, retro, t);
    if (!retro) { ctx.fillStyle = 'rgba(10,6,4,.25)'; ctx.fillRect(0, 0, VW, VH); }
    // «ткань» края: лоскуты внизу
    for (var i = 0; i < 16; i++) { rect(ctx, i * 32, VH - 18, 32, 18, P.g[i % 4]); rect(ctx, i * 32, VH - 18, 32, 3, P.top); }
    // тропы: стежки-нитки
    MAP.EDGES.forEach(function (e) {
      var a = MAP.node(e.a), b = MAP.node(e.b); if (a.r !== r && b.r !== r) return;
      var open = MAP.edgeOpen(p, e) && MAP.isOpen(p, e.b);
      if (e.secret && !open) return;
      var ax, ay, bx, by;
      if (a.r === r && b.r === r) { ax = a.x; ay = a.y; bx = b.x; by = b.y; }
      else if (a.r === r) { ax = a.x; ay = a.y; bx = VW + 30; by = a.y; }
      else { ax = -30; ay = b.y; bx = b.x; by = b.y; }
      ctx.save(); ctx.setLineDash(open ? [5, 4] : [2, 6]); ctx.lineDashOffset = -t * 8;
      line(ctx, ax, ay, bx, by, open ? (e.secret ? (retro ? E.C : '#7fe0d0') : (retro ? E.y : '#ffe2a8')) : (retro ? E.d : 'rgba(255,255,255,.25)'), open ? 2 : 1.5);
      ctx.restore();
    });
    MAP.NODES.forEach(function (n) { if (n.r === r) nodeIcon(ctx, n, M, t, retro, th, g); });
    // бродяга края
    var w = p.wand && p.wand[r];
    if (w && !w.dead && MAP.isOpen(p, w.at)) { var wn = MAP.node(w.at); wanderer(ctx, wn.x + 12, wn.y + 10, t, retro); }
    // Скок
    var hx = M.pos.x, hy = M.pos.y;
    if (M.pos.r != null && M.pos.r !== r) hx = M.pos.r > r ? VW + 20 : -20;
    hero(ctx, hx, hy - 6, { face: M.face, run: M.moving ? t * 14 : 0, air: false, suit: M.suit }, retro, t);
    // заголовок и подписи
    if (!retro) { ctx.fillStyle = 'rgba(16,10,8,.6)'; ctx.fillRect(0, 0, VW, 22); } else rect(ctx, 0, 0, VW, 22, E.k);
    g.text(g.t('mapTitle') + ' · ' + g.t('r' + r), 10, 15, { size: 12, color: th.accent, weight: 900 });
    foxHead(ctx, VW - 150, 11, retro); g.text('×' + M.lives, VW - 142, 15, { size: 11, color: th.ink, weight: 800 });
    nut(ctx, VW - 110, 11, 0, retro, 0.8); g.text(String(M.nuts).padStart(2, '0'), VW - 102, 15, { size: 11, color: th.ink, weight: 800 });
    if (M.suit) suitIcon(ctx, VW - 70, 11, M.suit, retro);
    var st = SK.save.stats(p); g.text('✓' + st.cleared + '/' + st.total, VW - 8, 15, { size: 10, align: 'right', color: th.muted, weight: 800 });
    var name = g.t('n_' + M.sel), tag = MAP.done(p, M.sel) ? ' ✓' : '';
    if (!retro) { ctx.fillStyle = 'rgba(16,10,8,.55)'; ctx.fillRect(0, VH - 40, VW, 22); } else rect(ctx, 0, VH - 40, VW, 22, E.k);
    g.text(name + tag, VW / 2, VH - 25, { size: 12, align: 'center', color: th.ink, weight: 800 });
    g.text(M.note || g.t('mapHint'), VW / 2, VH - 6, { size: 10, align: 'center', color: M.note ? th.warn : (retro ? E.w : '#fff4e6'), weight: 700 });
  }

  // ---------- мини-игры ----------
  function stall(g, ctx, title, retro) {
    var th = g.th();
    background(ctx, 1, 0, retro, g.time);
    if (!retro) { ctx.fillStyle = 'rgba(20,10,6,.55)'; ctx.fillRect(0, 0, VW, VH); } else rect(ctx, 0, 0, VW, VH, E.k);
    // навес
    for (var s = 0; s < 16; s++) poly(ctx, [s * 32, 24, s * 32 + 32, 24, s * 32 + 16, 40], s % 2 ? (retro ? E.R : '#d9534f') : (retro ? E.w : '#f5ecd8'));
    rect(ctx, 0, 0, VW, 24, retro ? E.R : '#b8423a');
    g.text(title, VW / 2, 17, { size: 14, align: 'center', color: retro ? E.y : '#fff4e6', weight: 900 });
    return th;
  }
  function renderShop(g, ctx, G) {
    var retro = rt(g), t = g.time, th = stall(g, ctx, g.t('shopTitle'), retro);
    rect(ctx, 60, 190, VW - 120, 14, retro ? E.n : '#7a4c28'); rect(ctx, 60, 204, VW - 120, 40, retro ? '#552a00' : '#5a3418');
    for (var i = 0; i < 3; i++) {
      var x = 136 + i * 120, y = 186, sel = G.sel === i, op = G.opened === i || G.reveal;
      var lift = sel && G.opened == null ? Math.sin(t * 6) * 2 - 2 : 0;
      if (op) {
        rect(ctx, x - 26, y - 30, 52, 30, retro ? E.k : '#2b1d14'); rect(ctx, x - 26, y - 34, 52, 6, retro ? E.n : '#8a5a2b');
        var pr = G.boxes[i];
        ctx.save(); if (G.opened !== i) ctx.globalAlpha = 0.5;
        if (pr.k === 'suit') { suitIcon(ctx, x, y - 16, pr.suit, retro); }
        else if (pr.k === 'life') heartGear(ctx, x, y - 16, retro);
        else { nut(ctx, x - 6, y - 16, t, retro); nut(ctx, x + 6, y - 14, t + 1, retro); }
        ctx.restore();
        g.text(pr.k === 'suit' ? g.t('s_' + pr.suit) : g.t('prize_' + pr.k), x, y + 34, { size: 10, align: 'center', color: G.opened === i ? th.good : th.muted, weight: 800 });
      } else {
        crateTile(ctx, x - 24, y - 48 + lift, 'B', retro); crateTile(ctx, x - 8, y - 48 + lift, 'B', retro); crateTile(ctx, x + 8, y - 48 + lift, 'B', retro);
        crateTile(ctx, x - 24, y - 32 + lift, 'B', retro); crateTile(ctx, x - 8, y - 32 + lift, 'B', retro); crateTile(ctx, x + 8, y - 32 + lift, 'B', retro);
        crateTile(ctx, x - 24, y - 16 + lift, 'u', retro); crateTile(ctx, x - 8, y - 16 + lift, 'u', retro); crateTile(ctx, x + 8, y - 16 + lift, 'u', retro);
      }
      if (sel) poly(ctx, [x - 6, y - 64, x + 6, y - 64, x, y - 56], th.accent);
    }
    hero(ctx, 136 + G.sel * 120, 262, { face: 1, run: 0, suit: G.suit }, retro, t);
    g.text(G.msg || g.t('shopHint'), VW / 2, VH - 8, { size: 11, align: 'center', color: G.msg ? th.good : th.ink, weight: 800 });
  }
  function renderLever(g, ctx, G) {
    var retro = rt(g), t = g.time, th = stall(g, ctx, g.t('leverTitle'), retro);
    // ворота
    var gx = VW / 2, gy = 120, open = G.win ? Math.min(1, G.openT || 0) : 0;
    rect(ctx, gx - 60, gy - 60, 120, 70, retro ? E.d : '#4b4f57');
    for (var b = 0; b < 7; b++) rect(ctx, gx - 54 + b * 17, gy - 54 - open * 50, 4, 60, retro ? E.l : '#9aa3ad');
    if (G.win) { heartGear(ctx, gx - 14, gy - 16, retro); nut(ctx, gx + 14, gy - 16, t, retro); }
    for (var i = 0; i < G.n; i++) {
      var x = 116 + i * 94, y = 216, pulled = G.pulled.indexOf(i) >= 0, sel = G.sel === i;
      rect(ctx, x - 14, y, 28, 18, retro ? E.d : '#3a3e47'); rect(ctx, x - 3, y - 2, 6, 4, retro ? E.l : '#7d838c');
      var a = pulled ? 0.7 : -0.7; line(ctx, x, y, x + Math.sin(a) * 30, y - Math.cos(a) * 30, retro ? E.l : '#c9cdd4', 3);
      circ(ctx, x + Math.sin(a) * 30, y - Math.cos(a) * 30, 5, pulled ? (i === G.good ? (retro ? E.G : '#7be08f') : (retro ? E.r : '#8a3a3a')) : (retro ? E.R : '#d9534f'));
      if (sel && !G.done) poly(ctx, [x - 6, y - 50, x + 6, y - 50, x, y - 42], th.accent);
      g.text(String(i + 1), x, y + 32, { size: 11, align: 'center', color: th.muted, weight: 800 });
    }
    g.text(G.msg || g.t('leverHint').replace('{n}', G.tries), VW / 2, VH - 8, { size: 11, align: 'center', color: G.msg ? (G.win ? th.good : th.warn) : th.ink, weight: 800 });
  }

  SK.R = { VW: VW, VH: VH, E: E, FX: FX, REG: REG, hero: hero, enemy: enemy, boss: boss, nut: nut, keyIcon: keyIcon, chest: chest, suitIcon: suitIcon, heartGear: heartGear,
    lantern: lantern, door: door, chapel: chapel, crateTile: crateTile, background: background, cog: cog, wanderer: wanderer, foxHead: foxHead };
  SK.renderLevel = renderLevel; SK.renderMap = renderMap; SK.renderShop = renderShop; SK.renderLever = renderLever;
})(typeof window !== 'undefined' ? window : globalThis);
