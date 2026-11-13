/* ЛЕДНИК · рендер обеих тем. LEDNIK.R — примитивы (герои, враги, предметы), LEDNIK.renderLevel(g, ctx, S, ui),
   LEDNIK.renderMap(g, ctx, M). modern — мягкие градиенты и формы; retro — 16-цветная палитра ПК начала 90-х,
   жёсткие пиксели (кратные 2 px), без сглаживания. Статичный слой клеток уровня кэшируется в offscreen-canvas
   по (уровень, тема); вода, мосты, сугробы и предметы рисуются поверх каждый кадр. */
(function (global) {
  'use strict';
  var LD = global.LEDNIK = global.LEDNIK || {};
  var L = LD.logic, T = 16, VW = 512, VH = 288;
  // палитра retro (EGA-подобная) + пара тёплых оттенков кожи/меха
  var E = { k: '#000000', b: '#0000aa', g: '#00aa00', c: '#00aaaa', r: '#aa0000', m: '#aa00aa', n: '#aa5500', l: '#aaaaaa',
    d: '#555555', B: '#5555ff', G: '#55ff55', C: '#55ffff', R: '#ff5555', M: '#ff55ff', y: '#ffff55', w: '#ffffff', s: '#ffaa77' };
  // облик Искры: охристо-брусничная парка с белым мехом капюшона, сапожки из оленьей шкуры, костяной бумеранг
  var HERO = {
    m: { parka: '#b8423a', parkaD: '#8e2f2b', fur: '#f4efe6', furD: '#d9d0c2', skin: '#f0c49c', cheek: '#e58a74', hair: '#3b2418', leg: '#4a3b55', boot: '#a07a56', bone: '#efe3c8', eye: '#20160f', bead: '#3fb6a8' },
    r: { parka: E.r, parkaD: '#550000', fur: E.w, furD: E.l, skin: E.s, cheek: E.R, hair: E.n, leg: E.m, boot: E.n, bone: E.y, eye: E.k, bead: E.C }
  };
  var REG = {
    1: { m: { sky0: '#26375f', sky1: '#e9a99b', far: '#7d7fb0', mid: '#3f5a73', ground: '#6a4936', groundD: '#4c3326', cap: '#f7f9ff', capD: '#cfdcef', tree: '#1f4a4a' },
         r: { sky0: E.b, sky1: E.B, far: E.l, mid: E.d, ground: E.n, groundD: '#552a00', cap: E.w, capD: E.l, tree: E.g } },
    2: { m: { sky0: '#4f9fcf', sky1: '#e6f5fb', far: '#b7d3e6', mid: '#7aa2bf', ground: '#3f5868', groundD: '#2c3f4c', cap: '#f5fbff', capD: '#cfe3ee', tree: '#2e5b66' },
         r: { sky0: E.c, sky1: E.C, far: E.l, mid: E.d, ground: E.d, groundD: E.k, cap: E.w, capD: E.l, tree: E.c } },
    3: { m: { sky0: '#071531', sky1: '#244a86', far: '#3b5c9a', mid: '#5d86c4', ground: '#35629c', groundD: '#24467a', cap: '#dff3ff', capD: '#9fd0f5', tree: '#1c3b6b' },
         r: { sky0: E.k, sky1: E.b, far: E.B, mid: E.b, ground: E.c, groundD: '#005555', cap: E.w, capD: E.C, tree: E.b } }
  };
  function rt(g) { return g.themeName === 'retro'; }
  function px(v, r) { return r ? Math.round(v / 2) * 2 : v; }
  function rect(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function circ(ctx, x, y, r, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function ell(ctx, x, y, rx, ry, c, a) { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, a || 0, 0, Math.PI * 2); ctx.fill(); }
  function poly(ctx, pts, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); ctx.fill(); }

  // retro: тёмный контур 1 px вокруг спрайта (чтобы белый мех не терялся на снегу)
  var olA = null, olB = null;
  function outlined(ctx, x, y, fn) {
    if (!olA) { olA = document.createElement('canvas'); olA.width = 72; olA.height = 56; olB = document.createElement('canvas'); olB.width = 72; olB.height = 56; }
    var a = olA.getContext('2d'), b = olB.getContext('2d');
    a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, 72, 56); a.imageSmoothingEnabled = false;
    fn(a, 36, 44);
    b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, 72, 56); b.drawImage(olA, 0, 0);
    b.globalCompositeOperation = 'source-in'; b.fillStyle = '#000000'; b.fillRect(0, 0, 72, 56); b.globalCompositeOperation = 'source-over';
    var m = ctx.getTransform ? ctx.getTransform() : null, sx = m ? Math.abs(m.a) : 1;
    var X = Math.round(x) - 36, Y = Math.round(y) - 44, d = 1 / Math.max(1, sx) * Math.max(1, sx);
    ctx.drawImage(olB, X - d, Y); ctx.drawImage(olB, X + d, Y); ctx.drawImage(olB, X, Y - d); ctx.drawImage(olB, X, Y + d);
    ctx.drawImage(olA, X, Y);
  }
  // ---------- Искра ----------
  // o: { face, run (фаза бега), air, low, slide, climb, throwT, hasBoom, flash }
  function hero(ctx, x, y, o, retro, t) {
    if (retro && !o._raw) { if (o.flash && Math.floor(t * 16) % 2) return; var o2 = Object.assign({}, o, { _raw: true, flash: false }); outlined(ctx, x, y, function (c, ax, ay) { hero(c, ax, ay, o2, true, t); }); return; }
    var K = HERO[retro ? 'r' : 'm'], f = o.face || 1;
    if (o.flash && Math.floor(t * 16) % 2) return;
    ctx.save(); ctx.translate(retro ? Math.round(x) : x, retro ? Math.round(y) : y); ctx.scale(f, 1);
    if (o.low) {   // подкат / пригнулась
      var sl = o.slide;
      if (retro) {
        rect(ctx, -8, -4, 6, 4, K.boot); rect(ctx, -2, -6, 6, 4, K.leg);
        rect(ctx, -6, -11, 12, 7, K.parka); rect(ctx, -6, -5, 12, 1, K.fur);
        rect(ctx, 2, -14, 8, 8, K.fur); rect(ctx, 4, -12, 5, 5, K.skin); rect(ctx, 7, -11, 1, 1, K.eye);
        if (sl) { rect(ctx, -14, -3, 4, 1, E.w); rect(ctx, -18, -7, 4, 1, E.w); }
      } else {
        ell(ctx, -6, -2, 4, 2.4, K.boot); ell(ctx, -1, -4, 5, 2.6, K.leg);
        ell(ctx, 0, -7, 7.5, 4.6, K.parka); rect(ctx, -6, -4, 12, 1.6, K.fur);
        circ(ctx, 6, -9, 5, K.fur); circ(ctx, 6.6, -8.8, 3.4, K.skin); circ(ctx, 8.2, -9.4, 0.8, K.eye); circ(ctx, 7.6, -7.6, 0.9, K.cheek);
        if (sl) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-10 - i * 4, -3 - i * 3); ctx.lineTo(-18 - i * 5, -3 - i * 3); ctx.stroke(); } }
      }
      ctx.restore(); return;
    }
    var ph = o.run || 0, step = o.air ? 0.6 : Math.sin(ph), lift = o.air ? 0 : Math.abs(Math.cos(ph)) * 1;
    if (o.climb) step = Math.sin(ph) * 0.8;
    if (retro) {
      var a = Math.round(step * 2);
      // ноги
      rect(ctx, -4 + a, -6, 3, 4, K.leg); rect(ctx, 1 - a, -6, 3, 4, K.leg);
      rect(ctx, -5 + a, -2, 4, 2, K.boot); rect(ctx, 1 - a, -2, 4, 2, K.boot);
      // парка
      rect(ctx, -5, -15, 10, 9, K.parka); rect(ctx, -6, -8, 12, 2, K.fur); rect(ctx, -1, -14, 1, 6, K.parkaD);
      rect(ctx, 0, -13, 1, 1, K.bead); rect(ctx, 0, -11, 1, 1, K.bead);
      // рука + бумеранг
      if (o.climb) { rect(ctx, -6, -20, 2, 6, K.parka); rect(ctx, 4, -21, 2, 6, K.parka); }
      else { rect(ctx, 3, -14, 3, 6, K.parka); rect(ctx, 3, -9, 3, 1, K.fur);
        if (o.hasBoom) { rect(ctx, -8, -16, 2, 7, K.bone); rect(ctx, -8, -16, 5, 2, K.bone); } }
      // капюшон и лицо
      rect(ctx, -6, -23, 11, 9, K.fur); rect(ctx, -5, -24, 9, 1, K.furD); rect(ctx, -6, -21, 2, 5, K.parka);
      rect(ctx, -3, -21, 7, 6, K.skin); rect(ctx, 2, -19, 1, 1, K.eye); rect(ctx, 3, -17, 1, 1, K.cheek);
      rect(ctx, -3, -22, 5, 2, K.hair);
      rect(ctx, -8, -18, 2, 5, K.hair);   // коса из-под капюшона
    } else {
      // ноги
      ctx.strokeStyle = K.leg; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-1.5, -7); ctx.lineTo(-1.5 + step * 3, -2.5 - lift); ctx.moveTo(1.5, -7); ctx.lineTo(1.5 - step * 3, -2.5); ctx.stroke();
      ell(ctx, -1 + step * 3, -1.6 - lift, 3, 1.8, K.boot); ell(ctx, 2 - step * 3, -1.6, 3, 1.8, K.boot);
      // парка (колокол) с меховым подолом
      poly(ctx, [-4.5, -16, 4.5, -16, 6.5, -6.5, -6.5, -6.5], K.parka);
      poly(ctx, [-1, -16, 1, -16, 1.4, -7, -1.4, -7], K.parkaD);
      ell(ctx, 0, -6.6, 7, 1.8, K.fur);
      circ(ctx, 2.6, -13, 0.8, K.bead); circ(ctx, 2.8, -10.6, 0.8, K.bead);
      // руки
      ctx.strokeStyle = K.parka; ctx.lineWidth = 3;
      if (o.climb) { ctx.beginPath(); ctx.moveTo(-3, -14); ctx.lineTo(-4, -21 + step * 2); ctx.moveTo(3, -14); ctx.lineTo(4, -21 - step * 2); ctx.stroke(); }
      else if (o.throwT > 0) { ctx.beginPath(); ctx.moveTo(2, -14); ctx.lineTo(8, -17); ctx.stroke(); circ(ctx, 8.4, -17.2, 1.4, K.fur); }
      else { ctx.beginPath(); ctx.moveTo(2.5, -14); ctx.lineTo(4 - step * 2, -9); ctx.stroke(); circ(ctx, 4 - step * 2, -8.6, 1.5, K.fur);
        if (o.hasBoom) { ctx.save(); ctx.translate(-5, -12); ctx.rotate(-0.5); boomShape(ctx, 0, 0, K.bone, 0.9); ctx.restore(); } }
      // капюшон с меховой оторочкой
      circ(ctx, -0.5, -19.5, 6.6, K.parka);
      circ(ctx, 1.2, -19.2, 5.4, K.fur); circ(ctx, 1.6, -19, 4.2, K.furD);
      circ(ctx, 1.8, -19, 3.7, K.skin);
      ctx.fillStyle = K.hair; ctx.beginPath(); ctx.arc(1.8, -20.4, 3.6, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      circ(ctx, 3.4, -19.2, 0.75, K.eye); circ(ctx, 3.6, -17.4, 0.9, K.cheek);
      // коса
      ctx.strokeStyle = K.hair; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-5.5, -18); ctx.quadraticCurveTo(-8.5, -14, -7, -10.5); ctx.stroke();
      circ(ctx, -7, -10.2, 1.1, K.bead);
    }
    ctx.restore();
  }
  function boomShape(ctx, x, y, c, s) {
    s = s || 1; ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-6, -2); ctx.quadraticCurveTo(0, -5, 6, -2); ctx.lineTo(6.5, 0.5); ctx.quadraticCurveTo(0, -2, -5, 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(120,90,50,.45)'; circ(ctx, 0, -2.6, 0.8, ctx.fillStyle);
    ctx.restore();
  }
  function boomerang(ctx, B, retro, K) {
    if (retro) {
      ctx.save(); ctx.translate(Math.round(B.x), Math.round(B.y));
      var a = Math.floor(B.spin) % 4;
      if (a === 0) { rect(ctx, -4, -1, 8, 2, E.y); rect(ctx, -4, -1, 2, 4, E.y); }
      else if (a === 1) { rect(ctx, -1, -4, 2, 8, E.y); rect(ctx, -1, -4, 4, 2, E.y); }
      else if (a === 2) { rect(ctx, -4, -1, 8, 2, E.y); rect(ctx, 2, -3, 2, 4, E.y); }
      else { rect(ctx, -1, -4, 2, 8, E.y); rect(ctx, -3, 2, 4, 2, E.y); }
      ctx.restore(); return;
    }
    ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.spin);
    ctx.fillStyle = 'rgba(255,255,255,.18)'; circ(ctx, 0, 0, 8, ctx.fillStyle);
    boomShape(ctx, 0, 0, K.bone, 1.1); ctx.restore();
  }

  // ---------- песец Бураш ----------
  function fox(ctx, x, y, dir, t, retro, carry, raw) {
    if (retro && !raw) { outlined(ctx, x, y, function (c, ax, ay) { fox(c, ax, ay, dir, t, true, carry, true); }); return; }
    ctx.save(); ctx.translate(retro ? Math.round(x) : x, retro ? Math.round(y) : y); ctx.scale(dir || 1, 1);
    var b = Math.abs(Math.sin(t * 18)) * 1.5;
    if (retro) {
      rect(ctx, -12, -7 - b, 6, 4, E.w); rect(ctx, -14, -6 - b, 2, 2, E.l);   // хвост
      rect(ctx, -6, -8 - b, 11, 5, E.w); rect(ctx, -5, -3, 2, 3, E.l); rect(ctx, 2, -3, 2, 3, E.l);
      rect(ctx, 4, -11 - b, 6, 5, E.w); rect(ctx, 4, -13 - b, 2, 2, E.w); rect(ctx, 7, -13 - b, 2, 2, E.w);
      rect(ctx, 9, -9 - b, 2, 1, E.k); rect(ctx, 7, -10 - b, 1, 1, E.k);
    } else {
      ctx.fillStyle = '#e9eef6'; ctx.beginPath(); ctx.moveTo(-5, -6 - b); ctx.quadraticCurveTo(-16, -12 - b, -15, -3 - b); ctx.quadraticCurveTo(-10, -2, -5, -4); ctx.fill();
      circ(ctx, -14.4, -4.6 - b, 1.8, '#b9c7da');
      ctx.strokeStyle = '#cdd7e6'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      var s = Math.sin(t * 18) * 2;
      ctx.beginPath(); ctx.moveTo(-3, -4); ctx.lineTo(-3 + s, -0.5); ctx.moveTo(3, -4); ctx.lineTo(3 - s, -0.5); ctx.stroke();
      ell(ctx, 0, -6 - b, 7, 3.8, '#f6f8fc');
      circ(ctx, 6, -8.5 - b, 3.6, '#f6f8fc');
      poly(ctx, [3.6, -10.5 - b, 4.6, -15 - b, 6.6, -11 - b], '#f6f8fc'); poly(ctx, [6.4, -10.8 - b, 8.2, -14.6 - b, 8.8, -10 - b], '#f6f8fc');
      poly(ctx, [7.6, -8.6 - b, 11.4, -7.6 - b, 7.6, -6.6 - b], '#f6f8fc');
      circ(ctx, 11.2, -7.6 - b, 0.9, '#1d1d24'); circ(ctx, 7.2, -9.4 - b, 0.8, '#1d1d24');
    }
    if (carry) { ctx.save(); ctx.translate(10, -6 - b); ctx.scale(0.7, 0.7); item(ctx, carry.k, 0, 0, t, retro); ctx.restore(); }
    ctx.restore();
  }

  // ---------- предметы ----------
  function item(ctx, k, x, y, t, retro) {
    if (retro) {
      x = Math.round(x); y = Math.round(y);
      if (k === 'food' || k === 'hidden') { rect(ctx, x - 5, y - 2, 8, 4, E.C); rect(ctx, x + 3, y - 3, 3, 6, E.c); rect(ctx, x - 4, y - 1, 1, 1, E.k); }
      else if (k === 'hide') { rect(ctx, x - 5, y - 4, 10, 8, E.n); rect(ctx, x - 4, y - 3, 8, 2, '#ffaa55'); rect(ctx, x - 6, y - 4, 1, 8, E.n); rect(ctx, x + 5, y - 4, 1, 8, E.n); }
      else if (k === 'flint') { poly(ctx, [x - 5, y + 3, x - 1, y - 5, x + 5, y + 1, x + 1, y + 4], E.l); rect(ctx, x - 1, y - 3, 2, 2, E.w); rect(ctx, x - 3, y + 1, 4, 2, E.d); }
      else if (k === 'key') { rect(ctx, x - 6, y - 1, 9, 2, E.y); rect(ctx, x + 3, y - 3, 4, 6, E.y); rect(ctx, x + 4, y - 1, 2, 2, E.k); rect(ctx, x - 6, y + 1, 2, 2, E.y); rect(ctx, x - 3, y + 1, 2, 2, E.y); }
      else if (k === 'heart') { rect(ctx, x - 4, y - 3, 3, 3, E.R); rect(ctx, x + 1, y - 3, 3, 3, E.R); rect(ctx, x - 4, y, 8, 2, E.R); rect(ctx, x - 2, y + 2, 4, 2, E.R); }
      return;
    }
    if (k === 'food' || k === 'hidden') {   // рыба
      var w = Math.sin(t * 6 + x) * 0.15;
      ctx.save(); ctx.translate(x, y); ctx.rotate(w);
      poly(ctx, [4, 0, 8, -4, 8, 4], '#7fa6c8'); ell(ctx, -0.5, 0, 6, 3.4, '#cfe0ef'); ell(ctx, -0.5, 1, 5, 1.8, '#a7c3dc');
      circ(ctx, -3.6, -0.8, 0.9, '#1d2a38'); ctx.restore();
    } else if (k === 'hide') {
      ctx.save(); ctx.translate(x, y);
      ctx.fillStyle = '#8a5a3c'; ctx.beginPath(); ctx.moveTo(-6, -4); ctx.quadraticCurveTo(0, -6, 6, -4); ctx.lineTo(5, 4); ctx.quadraticCurveTo(0, 6, -5, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#c99a6b'; ctx.fillRect(-4, -2.4, 8, 1.6); ctx.fillRect(-4, 0.8, 8, 1.2);
      ctx.restore();
    } else if (k === 'flint') {
      poly(ctx, [x - 5, y + 3.5, x - 1.5, y - 5, x + 5, y + 1, x + 1.5, y + 4.5], '#59626f');
      poly(ctx, [x - 1.5, y - 5, x + 5, y + 1, x + 0.5, y - 0.5], '#b4bdca'); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 5, y + 3.5); ctx.lineTo(x - 1.5, y - 5); ctx.lineTo(x + 5, y + 1); ctx.stroke();
      var tw = (Math.sin(t * 5 + x * 0.3) + 1) / 2; circ(ctx, x + 1, y - 2, 0.8 + tw, 'rgba(255,255,255,' + (0.4 + tw * 0.5) + ')');
    } else if (k === 'key') {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 3) * 0.2);
      ctx.fillStyle = '#f3e7c6'; ctx.fillRect(-6, -1.2, 9, 2.4); circ(ctx, 4.5, 0, 3.4, '#f3e7c6'); circ(ctx, 4.5, 0, 1.3, '#7a5a30');
      ctx.fillRect(-6, 1, 2, 2.6); ctx.fillRect(-2.6, 1, 2, 2); ctx.restore();
      circ(ctx, x, y, 9, 'rgba(255,230,140,' + (0.15 + Math.sin(t * 4) * 0.08) + ')');
    } else if (k === 'heart') {
      ctx.save(); ctx.translate(x, y); var s = 1 + Math.sin(t * 5) * 0.08; ctx.scale(s, s);
      ctx.fillStyle = '#ff5a6e'; ctx.beginPath(); ctx.moveTo(0, 5); ctx.bezierCurveTo(-8, -1, -4, -7, 0, -2.5); ctx.bezierCurveTo(4, -7, 8, -1, 0, 5); ctx.fill(); ctx.restore();
    }
  }

  // ---------- враги ----------
  function kitten(ctx, e, t, retro) {
    var x = e.x, y = e.y, f = e.face, crouch = e.st === 'crouch', st = e.st === 'stun';
    ctx.save(); ctx.translate(retro ? Math.round(x) : x, retro ? Math.round(y) : y); ctx.scale(f, 1);
    if (crouch) ctx.scale(1.15, 0.8);
    if (retro) {
      rect(ctx, -8, -9, 3, 2, E.n); rect(ctx, -6, -8, 11, 6, E.s); rect(ctx, -5, -2, 2, 2, E.n); rect(ctx, 2, -2, 2, 2, E.n);
      rect(ctx, 3, -12, 6, 6, E.s); rect(ctx, 3, -14, 2, 2, E.n); rect(ctx, 7, -14, 2, 2, E.n);
      rect(ctx, 7, -10, 1, 1, E.k); rect(ctx, 6, -6, 1, 2, E.w); rect(ctx, 8, -6, 1, 2, E.w);
      rect(ctx, -2, -8, 1, 3, E.n); rect(ctx, 1, -8, 1, 3, E.n);
    } else {
      var w = Math.sin(t * 10) * (e.st === 'walk' ? 1.5 : 0);
      ctx.strokeStyle = '#c98a4f'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-6, -6); ctx.quadraticCurveTo(-11, -9, -10, -13 + w); ctx.stroke();
      ctx.strokeStyle = '#b77940'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(-4, -4); ctx.lineTo(-4 + w, 0); ctx.moveTo(3, -4); ctx.lineTo(3 - w, 0); ctx.stroke();
      ell(ctx, -0.5, -5.6, 6.6, 3.6, '#e2ad74'); ell(ctx, -0.5, -4.4, 5, 1.8, '#f1d2ab');
      ctx.fillStyle = '#b77940'; ctx.fillRect(-3, -9, 1.3, 3); ctx.fillRect(0, -9, 1.3, 3);
      circ(ctx, 5.4, -9, 4, '#e2ad74');
      poly(ctx, [2.8, -11.8, 3.6, -15, 5.6, -12.4], '#c98a4f'); poly(ctx, [6, -12.6, 7.8, -15, 8.4, -11.6], '#c98a4f');
      circ(ctx, 6.8, -9.6, 1, st ? '#fff' : '#20160f'); ell(ctx, 7.8, -7.6, 1.8, 1.2, '#f1d2ab');
      poly(ctx, [6.6, -7, 7.2, -3.6, 7.8, -7], '#ffffff'); poly(ctx, [8.2, -7, 8.8, -4, 9.4, -7], '#ffffff');
    }
    ctx.restore();
    if (st) stars(ctx, x, y - 16, t, retro);
  }
  function beetle(ctx, e, t, retro) {
    var x = e.x, y = e.y, st = e.st === 'stun';
    ctx.save(); ctx.translate(retro ? Math.round(x) : x, retro ? Math.round(y) : y); ctx.scale(e.face, 1);
    if (st) { ctx.translate(0, -5); ctx.scale(1, -1); ctx.translate(0, 5); }
    if (retro) {
      rect(ctx, -7, -2, 2, 2, E.k); rect(ctx, -1, -2, 2, 2, E.k); rect(ctx, 5, -2, 2, 2, E.k);
      rect(ctx, -7, -8, 14, 6, E.C); rect(ctx, -5, -10, 10, 2, E.C); rect(ctx, -4, -12, 2, 2, E.w); rect(ctx, 0, -12, 2, 2, E.w); rect(ctx, 4, -11, 2, 1, E.w);
      rect(ctx, 6, -6, 3, 3, E.b); rect(ctx, 8, -5, 1, 1, E.y);
    } else {
      var l = Math.sin(t * 14) * 1.2;
      ctx.strokeStyle = '#1c3550'; ctx.lineWidth = 1.4;
      for (var i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 4, -3); ctx.lineTo(i * 4 + (i % 2 ? l : -l) - 1, 0); ctx.stroke(); }
      ctx.fillStyle = '#7fd3ff'; ctx.beginPath(); ctx.ellipse(-0.5, -4, 7.5, 6, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#c6eeff'; ctx.beginPath(); ctx.ellipse(-2, -6, 4, 2.4, -0.3, 0, Math.PI * 2); ctx.fill();
      poly(ctx, [-5, -7, -4, -12, -2.6, -8], '#e8f8ff'); poly(ctx, [-1, -9, 0.4, -14, 1.6, -9.4], '#e8f8ff'); poly(ctx, [3, -8, 4.6, -12, 5.4, -7], '#e8f8ff');
      circ(ctx, 7, -3.6, 2.6, '#1c3550'); circ(ctx, 8, -4.2, 0.8, '#ffd84a');
    }
    ctx.restore();
    if (st) stars(ctx, x, y - 14, t, retro);
  }
  function mammoth(ctx, e, t, retro) {
    var x = e.x, y = e.y, ch = e.st === 'charge', st = e.st === 'stun' || e.st === 'reel';
    ctx.save(); ctx.translate(retro ? Math.round(x) : x, retro ? Math.round(y) : y); ctx.scale(e.face, 1);
    if (e.st === 'rev') ctx.rotate(-0.06 * Math.sin(t * 30));
    if (retro) {
      rect(ctx, -11, -4, 4, 4, '#552a00'); rect(ctx, 5, -4, 4, 4, '#552a00');
      rect(ctx, -13, -18, 22, 14, E.n); rect(ctx, -11, -20, 16, 2, E.n); rect(ctx, -14, -12, 2, 4, E.n);
      rect(ctx, 7, -18, 7, 10, E.n); rect(ctx, 12, -10, 3, 8, E.n); rect(ctx, 10, -9, 6, 2, E.w);
      rect(ctx, 10, -15, 2, 2, E.k); rect(ctx, -9, -16, 2, 2, '#552a00'); rect(ctx, -4, -14, 2, 2, '#552a00');
    } else {
      var l = ch ? Math.sin(t * 24) * 2.2 : Math.sin(t * 8) * 1;
      rect(ctx, -10 + l, -6, 5, 6, '#5d3a26'); rect(ctx, 4 - l, -6, 5, 6, '#5d3a26');
      ell(ctx, -1.5, -11, 12.5, 8.6, '#8a5a3c');
      ctx.fillStyle = '#a7734f'; for (var i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-9 + i * 4, -17 + (i % 2), 3, 2, 0, 0, Math.PI * 2); ctx.fill(); }
      ell(ctx, 9, -12, 6.2, 6, '#8a5a3c');
      ctx.strokeStyle = '#7a4c32'; ctx.lineWidth = 3.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(13, -10); ctx.quadraticCurveTo(16, -4, 13.5, -1.5); ctx.stroke();
      ctx.strokeStyle = '#f2ead8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(11, -8); ctx.quadraticCurveTo(15, -6, 17, -9); ctx.stroke();
      circ(ctx, 10.8, -14, 1.1, st ? '#ffffff' : '#20160f');
      ell(ctx, 5.6, -13, 2.6, 3.6, '#6e452f');
    }
    ctx.restore();
    if (st) stars(ctx, x, y - 26, t, retro);
    if (ch && !retro) for (var k = 0; k < 3; k++) circ(ctx, x - e.face * (14 + k * 6), y - 2 - k, 2.5 - k * 0.6, 'rgba(240,248,255,.7)');
  }
  function stars(ctx, x, y, t, retro) {
    for (var i = 0; i < 3; i++) {
      var a = t * 5 + i * 2.1, sx = x + Math.cos(a) * 7, sy = y + Math.sin(a) * 2.5;
      if (retro) rect(ctx, Math.round(sx) - 1, Math.round(sy) - 1, 2, 2, E.y); else circ(ctx, sx, sy, 1.6, '#ffe36a');
    }
  }
  function enemy(ctx, e, t, retro) {
    if (e.st === 'flee') { ctx.save(); ctx.globalAlpha = Math.max(0, e.t / 1.2); }
    if (e.k === 'kitten') kitten(ctx, e, t, retro); else if (e.k === 'beetle') beetle(ctx, e, t, retro); else mammoth(ctx, e, t, retro);
    if (e.st === 'flee') ctx.restore();
  }

  // ---------- вожаки ----------
  function boss(ctx, b, t, retro) {
    var vul = b.st === 'dazed' || b.st === 'flipped' || b.st === 'rest';
    if (b.flash > 0 && Math.floor(t * 20) % 2) return;
    if (b.k === 'fang') {
      var e = { x: b.x, y: b.y, face: b.face, st: b.st === 'crouch' ? 'crouch' : vul ? 'stun' : 'walk' };
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(2.6, 2.6); ctx.translate(-b.x, -b.y);
      kitten(ctx, e, t, retro);
      // шрам и седина вожака
      ctx.save(); ctx.translate(b.x, b.y); ctx.scale(b.face, 1);
      if (retro) { rect(ctx, -6, -9, 8, 1, E.l); rect(ctx, 5, -12, 1, 3, E.r); }
      else { ctx.strokeStyle = '#8d5a3a'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(4.6, -12); ctx.lineTo(6.4, -8.6); ctx.stroke(); ell(ctx, -1, -8.6, 4.5, 1.2, 'rgba(255,255,255,.55)'); }
      ctx.restore(); ctx.restore();
    } else if (b.k === 'shell') {
      var e2 = { x: b.x, y: b.y, face: b.face, st: b.st === 'flipped' ? 'stun' : 'walk' };
      ctx.save(); ctx.translate(b.x, b.y);
      if (b.st === 'roll' || b.st === 'curl') { var r = 11 * 2.6 / 2.2; ctx.rotate(b.st === 'roll' ? t * 14 * Math.sign(b.vx || 1) : 0);
        if (retro) { rect(ctx, -14, -28, 28, 28, E.C); rect(ctx, -8, -24, 6, 4, E.w); rect(ctx, 2, -14, 8, 4, E.c); }
        else { circ(ctx, 0, -r, r, '#7fd3ff'); circ(ctx, -4, -r - 4, r * 0.4, '#c6eeff'); ctx.strokeStyle = '#3f8fbf'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -r, r * 0.7, 0, Math.PI * 1.2); ctx.stroke(); }
        ctx.restore();
      } else { ctx.scale(2.6, 2.6); ctx.translate(-b.x, -b.y); beetle(ctx, e2, t, retro); ctx.restore(); }
    } else {   // owl
      ctx.save(); ctx.translate(retro ? Math.round(b.x) : b.x, retro ? Math.round(b.y) : b.y); ctx.scale(b.face, 1);
      var flap = b.st === 'rest' ? 0 : Math.sin(t * (b.st === 'gust' ? 22 : 9));
      if (retro) {
        rect(ctx, -24, -20 - flap * 6, 10, 12, E.l); rect(ctx, 14, -20 - flap * 6, 10, 12, E.l);
        rect(ctx, -14, -28, 28, 28, E.w); rect(ctx, -12, -24, 10, 10, E.C); rect(ctx, 2, -24, 10, 10, E.C);
        rect(ctx, -8, -20, 4, 4, E.k); rect(ctx, 6, -20, 4, 4, E.k); rect(ctx, -2, -14, 4, 4, E.y);
        rect(ctx, -12, -32, 4, 4, E.l); rect(ctx, 8, -32, 4, 4, E.l); rect(ctx, -8, -4, 4, 4, E.y); rect(ctx, 4, -4, 4, 4, E.y);
      } else {
        ctx.fillStyle = '#c9d8ec'; ctx.beginPath(); ctx.moveTo(-10, -18); ctx.quadraticCurveTo(-30, -24 - flap * 10, -28, -6 - flap * 4); ctx.quadraticCurveTo(-18, -8, -10, -6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(10, -18); ctx.quadraticCurveTo(30, -24 - flap * 10, 28, -6 - flap * 4); ctx.quadraticCurveTo(18, -8, 10, -6); ctx.fill();
        ell(ctx, 0, -14, 14, 14, '#eef4fb');
        ctx.fillStyle = '#d5e2f1'; for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-6 + i * 4, -6 - (i % 2) * 3, 2, 0, Math.PI); ctx.fill(); }
        poly(ctx, [-11, -24, -9, -32, -4, -26], '#c9d8ec'); poly(ctx, [11, -24, 9, -32, 4, -26], '#c9d8ec');
        circ(ctx, -5.5, -19, 5, '#9fd8ff'); circ(ctx, 5.5, -19, 5, '#9fd8ff');
        circ(ctx, -5.5, -19, 3.2, vul ? '#ffffff' : '#ffd84a'); circ(ctx, 5.5, -19, 3.2, vul ? '#ffffff' : '#ffd84a');
        circ(ctx, -5, -19, 1.5, '#1d2233'); circ(ctx, 6, -19, 1.5, '#1d2233');
        poly(ctx, [-2, -15, 2, -15, 0, -11], '#e8a33a');
        ctx.strokeStyle = '#e8a33a'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-5, -3); ctx.moveTo(5, 0); ctx.lineTo(5, -3); ctx.stroke();
      }
      ctx.restore();
      if (vul) stars(ctx, b.x, b.y - 36, t, retro);
    }
  }

  // ---------- клетки (статичный слой) ----------
  var cache = {};
  function levelLayer(LV, retro) {
    var key = LV.id + (retro ? 'r' : 'm');
    if (cache[key]) return cache[key];
    for (var k in cache) delete cache[k];
    var c = document.createElement('canvas'); c.width = LV.w * T; c.height = LV.h * T;
    var ctx = c.getContext('2d'), P = REG[LV.r][retro ? 'r' : 'm'];
    for (var ty = 0; ty < LV.h; ty++) for (var tx = 0; tx < LV.w; tx++) {
      var ch = LV.t[ty].charAt(tx); if (ch === '.' || ch === 's' || ch === '-' || ch === '~') continue;
      drawTile(ctx, LV, ch, tx, ty, P, retro);
    }
    cache[key] = c; return c;
  }
  function airAbove(LV, tx, ty) { var a = L.tileAt(LV, tx, ty - 1); return !(a === '#' || a === '=' || a === '%'); }
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function drawTile(ctx, LV, ch, tx, ty, P, retro) {
    var x = tx * T, y = ty * T, up = airAbove(LV, tx, ty), hv = hash(tx, ty);
    if (ch === '#' || ch === '%') {
      rect(ctx, x, y, T, T, P.ground);
      if (retro) { if (hv < 0.35) rect(ctx, x + 4 + Math.floor(hv * 20), y + 6, 4, 2, P.groundD); if (hv > 0.7) rect(ctx, x + 2, y + 11, 2, 2, P.groundD); }
      else { ctx.fillStyle = P.groundD; ctx.globalAlpha = 0.55; if (hv < 0.5) { ctx.beginPath(); ctx.ellipse(x + 4 + hv * 16, y + 9, 3, 2, 0, 0, Math.PI * 2); ctx.fill(); } ctx.fillRect(x, y + T - 2, T, 2); ctx.globalAlpha = 1; }
      if (up) {
        if (retro) { rect(ctx, x, y, T, 4, P.cap); rect(ctx, x + (hv < 0.5 ? 2 : 8), y + 4, 6, 2, P.cap); }
        else { ctx.fillStyle = P.cap; ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.quadraticCurveTo(x + 4, y + 7 + hv * 2, x + 8, y + 5); ctx.quadraticCurveTo(x + 12, y + 3 + hv * 3, x + T, y + 5); ctx.lineTo(x + T, y - 1); ctx.lineTo(x, y - 1); ctx.closePath(); ctx.fill(); rect(ctx, x, y + 3, T, 1, P.capD); rect(ctx, x, y - 1, T, 1.5, '#ffffff'); }
      }
      if (ch === '%') {   // щель — нора для песца
        if (retro) { rect(ctx, x + 4, y + 4, 8, 12, E.k); rect(ctx, x + 6, y + 2, 4, 2, E.k); rect(ctx, x + 6, y + 8, 1, 1, E.l); rect(ctx, x + 9, y + 8, 1, 1, E.l); }
        else {
          ctx.fillStyle = '#0d1018'; ctx.beginPath(); ctx.moveTo(x + 3, y + T); ctx.lineTo(x + 3, y + 8); ctx.quadraticCurveTo(x + 8, y + 1, x + 13, y + 8); ctx.lineTo(x + 13, y + T); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.35)'; circ(ctx, x + 8, y + 11, 1.4, ctx.fillStyle); circ(ctx, x + 6.2, y + 9, 0.7, ctx.fillStyle); circ(ctx, x + 8, y + 8.3, 0.7, ctx.fillStyle); circ(ctx, x + 9.8, y + 9, 0.7, ctx.fillStyle);
        }
      }
    } else if (ch === '=') {
      if (retro) { rect(ctx, x, y, T, T, E.C); if (up) rect(ctx, x, y, T, 2, E.w); rect(ctx, x + 2 + Math.floor(hv * 8), y + 6, 6, 2, E.w); rect(ctx, x + 1, y + 12, 3, 1, E.c); }
      else {
        var gr = ctx.createLinearGradient(0, y, 0, y + T); gr.addColorStop(0, '#bff0ff'); gr.addColorStop(1, '#6fc3ea'); ctx.fillStyle = gr; ctx.fillRect(x, y, T, T);
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 2 + hv * 6, y + 12); ctx.lineTo(x + 8 + hv * 6, y + 4); ctx.stroke();
        if (up) rect(ctx, x, y, T, 2, '#ffffff');
      }
    } else if (ch === 'T') {
      if (retro) { rect(ctx, x, y + 2, T, 4, E.n); rect(ctx, x, y, T, 2, E.w); if (hv < 0.3) rect(ctx, x + 6, y + 6, 2, 3, E.n); }
      else { rect(ctx, x, y + 3, T, 4, '#6b4630'); rect(ctx, x, y + 6, T, 1, '#4b301f'); ctx.fillStyle = '#f4f8ff'; ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.quadraticCurveTo(x + 8, y - 2, x + T, y + 4); ctx.lineTo(x + T, y + 1); ctx.lineTo(x, y + 1); ctx.fill(); rect(ctx, x, y + 1, T, 3, '#f4f8ff');
        if (hv < 0.25) { ctx.fillStyle = '#7fbfd4'; ctx.beginPath(); ctx.moveTo(x + 4, y + 7); ctx.lineTo(x + 5, y + 12); ctx.lineTo(x + 6, y + 7); ctx.fill(); } }
    } else if (ch === '^') {
      for (var i = 0; i < 3; i++) {
        if (retro) { rect(ctx, x + 1 + i * 5, y + 10, 4, 6, E.C); rect(ctx, x + 2 + i * 5, y + 6, 2, 4, E.w); }
        else { poly(ctx, [x + i * 5.3, y + T, x + 2.6 + i * 5.3, y + 5 + (i % 2) * 2, x + 5.3 + i * 5.3, y + T], '#d8f4ff'); poly(ctx, [x + 2.6 + i * 5.3, y + 5 + (i % 2) * 2, x + 5.3 + i * 5.3, y + T, x + 2.6 + i * 5.3, y + T], '#8fd0ee'); }
      }
    } else if (ch === '|') {
      var top = L.tileAt(LV, tx, ty - 1) !== '|';
      if (retro) { rect(ctx, x + 5, y, 6, T, E.C); rect(ctx, x + 6, y, 2, T, E.w); rect(ctx, x + 3, y + 4, 2, 2, E.C); rect(ctx, x + 11, y + 10, 2, 2, E.C); if (top) rect(ctx, x + 3, y, 10, 3, E.w); }
      else {
        var g2 = ctx.createLinearGradient(x + 4, 0, x + 12, 0); g2.addColorStop(0, '#e6f8ff'); g2.addColorStop(1, '#8fd3f2'); ctx.fillStyle = g2;
        ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.lineTo(x + 12, y); ctx.lineTo(x + 11, y + 8); ctx.lineTo(x + 12.5, y + T); ctx.lineTo(x + 3.5, y + T); ctx.lineTo(x + 5, y + 8); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(x + 6, y + 1, 1.4, T - 2);
        poly(ctx, [x + 3.5, y + 6, x + 1.5, y + 8, x + 4.5, y + 9], '#b9e8fb'); poly(ctx, [x + 12, y + 11, x + 14.5, y + 13, x + 12, y + 14], '#b9e8fb');
        if (top) { ell(ctx, x + 8, y + 1, 6, 2.4, '#ffffff'); }
      }
    }
  }
  // ---------- фон ----------
  function background(ctx, LV, camX, retro, t) {
    var P = REG[LV.r][retro ? 'r' : 'm'];
    if (retro) {
      rect(ctx, 0, 0, VW, VH, P.sky0); rect(ctx, 0, 150, VW, VH - 150, P.sky1);
      if (LV.r === 3) for (var s = 0; s < 40; s++) rect(ctx, (s * 97) % VW, (s * 53) % 120, 2, 2, s % 3 ? E.w : E.C);
      if (LV.r === 3) { for (var a = 0; a < VW; a += 8) rect(ctx, a, 40 + Math.round(Math.sin(a * 0.02 + t * 0.6) * 10 / 2) * 2, 8, 4, E.G); }
      var o1 = -((camX * 0.2) % 128);
      for (var m = -1; m < 6; m++) { var mx = o1 + m * 128; poly(ctx, [mx, 200, mx + 64, 110, mx + 128, 200], P.far); rect(ctx, mx + 56, 116, 16, 6, E.w); }
      var o2 = -((camX * 0.45) % 64);
      for (var n = -1; n < 10; n++) { var nx = o2 + n * 64; rect(ctx, nx + 28, 160, 8, 50, P.tree); poly(ctx, [nx + 12, 180, nx + 32, 130, nx + 52, 180], P.tree); rect(ctx, nx + 26, 140, 12, 4, E.w); }
      if (LV.r === 1) ctx.drawImage(dither(), 0, 206); else rect(ctx, 0, 206, VW, VH - 206, P.mid);
      return;
    }
    var gr = ctx.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, P.sky0); gr.addColorStop(1, P.sky1); ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH);
    if (LV.r === 3) {
      for (var s2 = 0; s2 < 50; s2++) circ(ctx, (s2 * 97.3 - camX * 0.05) % VW + (s2 * 97.3 - camX * 0.05 < 0 ? VW : 0), (s2 * 53.7) % 140, (s2 % 3) * 0.4 + 0.5, 'rgba(255,255,255,.7)');
      for (var b = 0; b < 2; b++) { ctx.fillStyle = b ? 'rgba(120,255,200,.12)' : 'rgba(110,200,255,.13)'; ctx.beginPath(); ctx.moveTo(0, 60 + b * 18);
        for (var ax = 0; ax <= VW; ax += 16) ctx.lineTo(ax, 50 + b * 18 + Math.sin(ax * 0.015 + t * 0.4 + b * 2) * 16); ctx.lineTo(VW, 110 + b * 20); ctx.lineTo(0, 110 + b * 20); ctx.fill(); }
    } else if (LV.r === 1) { var mx0 = 400 - camX * 0.02; circ(ctx, mx0, 66, 30, 'rgba(255,240,215,.10)'); circ(ctx, mx0, 66, 15, 'rgba(255,246,228,.85)'); }
    else { circ(ctx, 90 - camX * 0.02, 54, 20, 'rgba(255,255,255,.85)'); }
    var o1m = -((camX * 0.15) % 200);
    ctx.fillStyle = P.far;
    for (var m2 = -1; m2 < 5; m2++) { var x0 = o1m + m2 * 200; ctx.beginPath(); ctx.moveTo(x0, 210); ctx.lineTo(x0 + 70, 100 + (m2 & 1) * 20); ctx.lineTo(x0 + 110, 130); ctx.lineTo(x0 + 150, 96 + (m2 & 1) * 14); ctx.lineTo(x0 + 220, 210); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(x0 + 70, 100 + (m2 & 1) * 20); ctx.lineTo(x0 + 82, 118); ctx.lineTo(x0 + 58, 120); ctx.fill(); ctx.fillStyle = P.far; }
    var o2m = -((camX * 0.4) % 56);
    for (var n2 = -1; n2 < 11; n2++) { var px2 = o2m + n2 * 56, hh = 46 + (n2 * 7 % 3) * 10;
      ctx.fillStyle = P.tree; ctx.beginPath(); ctx.moveTo(px2 + 28, 210 - hh - 14); ctx.lineTo(px2 + 44, 214); ctx.lineTo(px2 + 12, 214); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(px2 + 28, 210 - hh - 14); ctx.lineTo(px2 + 33, 210 - hh + 2); ctx.lineTo(px2 + 23, 210 - hh + 2); ctx.fill(); }
    var g3 = ctx.createLinearGradient(0, 200, 0, VH); g3.addColorStop(0, P.mid); g3.addColorStop(1, P.sky0); ctx.fillStyle = g3; ctx.fillRect(0, 210, VW, VH - 210);
  }
  // retro: снежное поле дизерингом (белый/серый в шахматку 2 px), как на 16-цветных экранах
  var ditherC = null;
  function dither() {
    if (ditherC) return ditherC;
    ditherC = document.createElement('canvas'); ditherC.width = VW; ditherC.height = VH - 206;
    var c = ditherC.getContext('2d'); rect(c, 0, 0, VW, VH, E.w);
    for (var y = 0; y < VH - 206; y += 2) for (var x = (y / 2) % 2 * 2; x < VW; x += 4) rect(c, x, y, 2, 2, y < 12 ? E.l : (y / 2 + x / 4) % 3 ? E.w : E.l);
    return ditherC;
  }
  // снег: частицы в экранных координатах (ветер сдувает)
  var flakes = []; for (var fi = 0; fi < 70; fi++) flakes.push({ x: (fi * 73) % VW, y: (fi * 41) % VH, s: 0.5 + (fi % 5) * 0.35, v: 14 + (fi % 7) * 5 });
  function snow(ctx, t, dt, wind, retro, camDx) {
    for (var i = 0; i < flakes.length; i++) {
      var f = flakes[i];
      f.y += f.v * dt; f.x += (Math.sin(t + i) * 8 + wind * 220) * dt - camDx * 0.3 * f.s;
      if (f.y > VH) { f.y = -4; f.x = (f.x + 131) % VW; } if (f.x < -4) f.x += VW + 8; if (f.x > VW + 4) f.x -= VW + 8;
      if (retro) rect(ctx, Math.round(f.x / 2) * 2, Math.round(f.y / 2) * 2, 2, 2, E.w);
      else if (wind) { ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = f.s; ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - wind * 10, f.y - 1); ctx.stroke(); }
      else circ(ctx, f.x, f.y, f.s, 'rgba(255,255,255,.75)');
    }
  }

  // ---------- частицы ----------
  var FX = { list: [],
    add: function (x, y, o) { o = o || {}; for (var i = 0; i < (o.n || 8); i++) { var a = (o.a != null ? o.a : 0) + (Math.random() - 0.5) * (o.spread != null ? o.spread : Math.PI * 2), s = (o.sp || 80) * (0.4 + Math.random() * 0.6);
      this.list.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: o.g != null ? o.g : 300, life: o.life || 0.5, t: o.life || 0.5, c: o.c || '#fff', r: o.r || 2 }); } if (this.list.length > 300) this.list.splice(0, this.list.length - 300); },
    step: function (dt) { for (var i = this.list.length - 1; i >= 0; i--) { var p = this.list[i]; p.t -= dt; if (p.t <= 0) { this.list.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } },
    draw: function (ctx, cx, retro) { for (var i = 0; i < this.list.length; i++) { var p = this.list[i], a = p.t / p.life; if (retro) { if (a > 0.25) rect(ctx, Math.round((p.x - cx) / 2) * 2, Math.round(p.y / 2) * 2, 2, 2, p.c); } else { ctx.globalAlpha = a; circ(ctx, p.x - cx, p.y, p.r * (0.5 + a * 0.5), p.c); } } ctx.globalAlpha = 1; },
    clear: function () { this.list = []; } };

  // ---------- кадр уровня ----------
  function camp(ctx, x, y, lit, t, retro) {
    if (retro) {
      rect(ctx, x - 8, y - 3, 4, 3, E.d); rect(ctx, x + 4, y - 3, 4, 3, E.d); rect(ctx, x - 6, y - 5, 12, 2, E.n);
      if (lit) { var f = Math.floor(t * 8) % 2; rect(ctx, x - 4, y - 11 - f * 2, 8, 6 + f * 2, E.R); rect(ctx, x - 2, y - 14 - f, 4, 6, E.y); }
      return;
    }
    ell(ctx, x - 6, y - 1.5, 3, 2, '#7a8190'); ell(ctx, x + 6, y - 1.5, 3, 2, '#7a8190'); ell(ctx, x, y - 1, 3, 2, '#5f6573');
    ctx.strokeStyle = '#6b4630'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x - 6, y - 2); ctx.lineTo(x + 5, y - 6); ctx.moveTo(x + 6, y - 2); ctx.lineTo(x - 5, y - 6); ctx.stroke();
    if (lit) {
      var fl = Math.sin(t * 14) * 1.5;
      ctx.fillStyle = 'rgba(255,170,60,.18)'; circ(ctx, x, y - 10, 22, ctx.fillStyle);
      ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.quadraticCurveTo(x - 4, y - 14 - fl, x, y - 19 + fl); ctx.quadraticCurveTo(x + 4, y - 13, x + 5, y - 4); ctx.fill();
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(x - 2.5, y - 4); ctx.quadraticCurveTo(x - 2, y - 10, x, y - 13 - fl); ctx.quadraticCurveTo(x + 2, y - 9, x + 2.5, y - 4); ctx.fill();
    }
  }
  function tent(ctx, x, y, open, t, retro, have, need) {
    if (retro) {
      poly(ctx, [x - 20, y, x, y - 34, x + 20, y], E.n); rect(ctx, x - 2, y - 40, 2, 8, E.y); rect(ctx, x + 2, y - 38, 2, 6, E.y);
      for (var s = 0; s < 3; s++) rect(ctx, x - 14 + s * 10, y - 8 - s * 6, 8, 2, '#ffaa55');
      if (open) { poly(ctx, [x - 6, y, x, y - 16, x + 6, y], E.y); rect(ctx, x - 1, y - 48 - Math.floor(t * 4) % 3 * 2, 2, 4, E.l); }
      else poly(ctx, [x - 6, y, x, y - 16, x + 6, y], '#552a00');
      return;
    }
    ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 6, y - 42); ctx.lineTo(x + 3, y - 30); ctx.moveTo(x + 6, y - 42); ctx.lineTo(x - 3, y - 30); ctx.stroke();
    var gr = ctx.createLinearGradient(x - 20, 0, x + 20, 0); gr.addColorStop(0, '#9a6a45'); gr.addColorStop(1, '#c8956a'); ctx.fillStyle = gr;
    ctx.beginPath(); ctx.moveTo(x - 22, y); ctx.lineTo(x, y - 36); ctx.lineTo(x + 22, y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(80,50,30,.45)'; ctx.lineWidth = 1; for (var i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x - 22 + i * 4.5, y - i * 7.3); ctx.lineTo(x + 22 - i * 4.5, y - i * 7.3); ctx.stroke(); }
    ctx.fillStyle = '#f4f8ff'; ctx.beginPath(); ctx.moveTo(x - 8, y - 22); ctx.lineTo(x, y - 36); ctx.lineTo(x + 8, y - 22); ctx.quadraticCurveTo(x, y - 25, x - 8, y - 22); ctx.fill();
    if (open) {
      ctx.fillStyle = 'rgba(255,190,90,.25)'; circ(ctx, x, y - 8, 20 + Math.sin(t * 3) * 2, ctx.fillStyle);
      ctx.fillStyle = '#ffcf6a'; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x, y - 17); ctx.lineTo(x + 7, y); ctx.fill();
      for (var k = 0; k < 3; k++) circ(ctx, x + Math.sin(t * 1.5 + k) * 3, y - 46 - ((t * 10 + k * 8) % 24), 2.4 + k * 0.6, 'rgba(230,236,245,' + (0.5 - k * 0.12) + ')');
    } else {
      ctx.fillStyle = '#6e4a32'; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x, y - 17); ctx.lineTo(x + 7, y); ctx.fill();
    }
  }

  function renderLevel(g, ctx, S, ui) {
    var retro = rt(g), LV = S.LV, t = g.time, P = S.hero, K = HERO[retro ? 'r' : 'm'];
    ctx.imageSmoothingEnabled = !retro;
    var camX = ui.cam;
    background(ctx, LV, camX, retro, t);
    ctx.save(); ctx.translate(-Math.round(camX), 0);
    var c0 = Math.max(0, Math.floor(camX / T) - 1), c1 = Math.min(LV.w - 1, Math.ceil((camX + VW) / T) + 1);
    // вода
    for (var ty = 0; ty < LV.h; ty++) for (var tx = c0; tx <= c1; tx++) {
      var ch = LV.t[ty].charAt(tx);
      if (ch === '~') {
        var x = tx * T, y = ty * T, surf = L.tileAt(LV, tx, ty - 1) !== '~';
        if (retro) { rect(ctx, x, y, T, T, E.b); if (surf) { rect(ctx, x, y, T, 2, E.B); if ((tx + Math.floor(t * 3)) % 3 === 0) rect(ctx, x + 4, y + 4, 6, 2, E.C); } }
        else { rect(ctx, x, y, T, T, surf ? '#1f5f93' : '#123f6b'); if (surf) { ctx.fillStyle = 'rgba(200,240,255,.55)'; ctx.fillRect(x, y + 1 + Math.sin(t * 3 + tx) * 1.2, T, 1.5); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 3 + Math.sin(t + tx) * 3, y + 6, 5, 1); } }
      }
    }
    ctx.drawImage(levelLayer(LV, retro), 0, 0);
    // мосты
    for (ty = 0; ty < LV.h; ty++) for (tx = c0; tx <= c1; tx++) {
      if (LV.t[ty].charAt(tx) !== '-') continue;
      var b = S.br[ty * LV.w + tx], x2 = tx * T, y2 = ty * T;
      if (b && b.b > 0) { if (b.b > L.K.BRIDGE_BACK - 0.6 && !retro) { ctx.globalAlpha = (b.b - L.K.BRIDGE_BACK + 0.6) / 0.6; rect(ctx, x2, y2 + 2 + (L.K.BRIDGE_BACK - b.b) * 40, T, 3, '#bfeaff'); ctx.globalAlpha = 1; } continue; }
      var cr = b ? b.c / L.K.BRIDGE_T : 0, sh = cr > 0.5 ? Math.sin(t * 60) * cr : 0;
      if (retro) { rect(ctx, x2, y2 + sh, T, 4, E.C); rect(ctx, x2, y2 + sh, T, 1, E.w); if (cr > 0.3) rect(ctx, x2 + 6, y2 + sh, 2, 4, E.b); }
      else { ctx.fillStyle = 'rgba(190,236,255,.92)'; ctx.fillRect(x2, y2 + sh, T, 5); rect(ctx, x2, y2 + sh, T, 1.2, '#ffffff'); rect(ctx, x2, y2 + 4 + sh, T, 1, '#6fb6d8');
        if (cr > 0.25) { ctx.strokeStyle = '#2e6f96'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x2 + 4, y2); ctx.lineTo(x2 + 7, y2 + 3); ctx.lineTo(x2 + 11, y2 + 1); if (cr > 0.6) { ctx.moveTo(x2 + 7, y2 + 3); ctx.lineTo(x2 + 6, y2 + 5); } ctx.stroke(); } }
    }
    // костры, стойбище
    LV.camps.forEach(function (cp) { camp(ctx, cp.tx * T + 8, (cp.ty + 1) * T, !!S.lit[cp.id], t, retro); });
    if (LV.exit) tent(ctx, LV.exit.tx * T + 8, (LV.exit.ty + 1) * T, S.sup >= LV.need, t, retro);
    // предметы
    for (var i = 0; i < LV.items.length; i++) {
      var it = LV.items[i]; if (S.got[it.id] || (S.fox && S.fox.carry === it)) continue;
      var ix = it.tx * T + 8, iy = it.ty * T + 8 + Math.sin(t * 3 + i) * (retro ? 0 : 1.2);
      if (ix < camX - 20 || ix > camX + VW + 20) continue;
      if (it.hidden && !S.revealed[it.id]) { if ((t * 0.7 + i * 0.37) % 3 < 0.12) { if (retro) rect(ctx, ix, it.ty * T + 2, 2, 2, E.w); else circ(ctx, ix + 2, it.ty * T + 4, 1.4, 'rgba(255,255,255,.9)'); } continue; }
      item(ctx, it.k, ix, iy, t, retro);
    }
    // враги, вожак
    S.enemies.forEach(function (e) { if (e.alive && e.x > camX - 40 && e.x < camX + VW + 40) enemy(ctx, e, t, retro); });
    if (S.boss && (S.boss.alive || (S.bossT > 0 && Math.floor(t * 10) % 2))) boss(ctx, S.boss, t, retro);
    S.shots.forEach(function (s) {
      if (retro) { rect(ctx, Math.round(s.x) - 2, Math.round(s.y) - 4, 4, 8, E.C); rect(ctx, Math.round(s.x) - 1, Math.round(s.y) - 4, 2, 2, E.w); }
      else { ctx.fillStyle = '#d9f5ff'; ctx.beginPath(); ctx.moveTo(s.x - 3, s.y - 5); ctx.lineTo(s.x + 3, s.y - 5); ctx.lineTo(s.x, s.y + 6); ctx.fill(); }
    });
    // Бураш, бумеранг, Искра
    if (S.fox) fox(ctx, S.fox.x, S.fox.y, S.fox.dir, t, retro, S.fox.carry);
    if (S.phase !== 'dead' || Math.floor(S.phaseT * 8) % 2 === 0) {
      var o = { face: P.face, run: ui.runPh, air: !P.ground && !P.climb, low: P.low, slide: P.slide, climb: P.climb, throwT: ui.throwT, hasBoom: !S.boom, flash: P.inv > 0 && S.phase === 'play' };
      if (S.phase === 'dead') { ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.face * Math.min(1.4, S.phaseT * 3)); ctx.translate(-P.x, -P.y); hero(ctx, P.x, P.y, o, retro, t); ctx.restore(); }
      else hero(ctx, P.x, P.y, o, retro, t);
    }
    if (S.boom) boomerang(ctx, S.boom, retro, K);
    // сугробы — перед героем (Искра «тонет»)
    for (ty = 0; ty < LV.h; ty++) for (tx = c0; tx <= c1; tx++) {
      if (LV.t[ty].charAt(tx) !== 's') continue;
      var sx = tx * T, sy = ty * T, top = L.tileAt(LV, tx, ty - 1) !== 's', hv = hash(tx, ty);
      if (retro) { rect(ctx, sx, sy + (top ? 2 : 0), T, T - (top ? 2 : 0), E.w); if (top) rect(ctx, sx + 2 + Math.floor(hv * 8), sy, 6, 2, E.w); if (hv < 0.4) rect(ctx, sx + 4, sy + 8, 4, 2, E.l); }
      else { ctx.fillStyle = 'rgba(246,250,255,.94)'; if (top) { ctx.beginPath(); ctx.moveTo(sx, sy + T); ctx.lineTo(sx, sy + 5); ctx.quadraticCurveTo(sx + 4, sy - 1 - hv * 2, sx + 8, sy + 3); ctx.quadraticCurveTo(sx + 12, sy - 1, sx + T, sy + 5); ctx.lineTo(sx + T, sy + T); ctx.fill(); } else ctx.fillRect(sx, sy, T, T);
        ctx.fillStyle = 'rgba(160,190,225,.35)'; ctx.beginPath(); ctx.ellipse(sx + 5 + hv * 6, sy + 10, 4, 1.5, 0, 0, Math.PI * 2); ctx.fill(); }
    }
    FX.draw(ctx, 0, retro);
    // всплывающие подписи (в координатах мира)
    ui.toasts.forEach(function (q) {
      var a = Math.min(1, q.t / 0.4);
      ctx.globalAlpha = a; g.text(q.text, q.x, q.y - (q.life - q.t) * 18, { size: q.big ? 12 : 10, align: 'center', color: q.color, weight: 900 }); ctx.globalAlpha = 1;
    });
    ctx.restore();
    // ветер: снег
    var wind = 0; if (S.W.gust) wind = S.W.gust; else for (var wi = 0; wi < LV.wind.length; wi++) { var z = LV.wind[wi]; if (camX + VW > z.x0 && camX < z.x1 && L.gustOn(z, S.time)) wind = z.dir; }
    snow(ctx, t, ui.dt || 0, wind, retro, ui.camDx || 0);
    hud(g, ctx, S, ui, retro);
    if (ui.banner) banner(g, ctx, ui.banner, retro);
  }

  function heartIcon(ctx, x, y, full, retro) {
    if (retro) { var c = full ? E.R : E.d; rect(ctx, x - 5, y - 4, 4, 4, c); rect(ctx, x + 1, y - 4, 4, 4, c); rect(ctx, x - 5, y, 10, 2, c); rect(ctx, x - 3, y + 2, 6, 2, c); rect(ctx, x - 1, y + 4, 2, 2, c); return; }
    ctx.fillStyle = full ? '#ff5a6e' : 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.bezierCurveTo(x - 8, y - 1, x - 4, y - 7, x, y - 2.5); ctx.bezierCurveTo(x + 4, y - 7, x + 8, y - 1, x, y + 5); ctx.fill();
  }
  function hud(g, ctx, S, ui, retro) {
    var th = g.th(), LV = S.LV;
    if (retro) { rect(ctx, 0, 0, VW, 20, E.k); rect(ctx, 0, 20, VW, 2, E.c); }
    else { var gr = ctx.createLinearGradient(0, 0, 0, 26); gr.addColorStop(0, 'rgba(8,16,30,.78)'); gr.addColorStop(1, 'rgba(8,16,30,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, 30); }
    for (var i = 0; i < L.K.HEARTS; i++) heartIcon(ctx, 12 + i * 15, 10, i < S.hearts, retro);
    // жизни — голова Искры
    var lx = 62;
    if (retro) { rect(ctx, lx - 4, 4, 9, 9, E.w); rect(ctx, lx - 2, 6, 5, 5, E.s); } else { circ(ctx, lx, 10, 5.5, '#b8423a'); circ(ctx, lx + 0.8, 10.2, 4.4, '#f4efe6'); circ(ctx, lx + 1, 10.4, 3, '#f0c49c'); }
    g.text('×' + Math.max(0, S.lives), lx + 8, 15, { size: 11, color: th.ink, weight: 800 });
    if (!LV.boss) {
      // припасы: шкала с отметкой нормы
      var bx = 104, bw = 108, frac = Math.min(1, S.sup / LV.total), nf = LV.need / LV.total;
      item(ctx, 'food', bx - 4, 10, 0, retro);
      bx += 8;
      if (retro) { rect(ctx, bx, 5, bw, 10, E.d); rect(ctx, bx, 5, Math.round(bw * frac / 2) * 2, 10, S.sup >= LV.need ? E.G : E.y); rect(ctx, bx + Math.round(bw * nf), 3, 2, 14, E.w); }
      else { ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(bx, 6, bw, 8); ctx.fillStyle = S.sup >= LV.need ? th.good : th.accent; ctx.fillRect(bx, 6, bw * frac, 8); rect(ctx, bx + bw * nf - 1, 3, 2, 14, '#ffffff'); }
      g.text(S.sup + '/' + LV.need + (S.sup >= LV.total ? ' ★' : ' · ' + LV.total), bx + bw + 6, 15, { size: 11, color: S.sup >= LV.need ? th.good : th.ink, weight: 800 });
    } else if (S.boss) {
      var bb = S.boss; g.text(g.t('b_' + bb.k), 108, 15, { size: 11, color: th.warn, weight: 900 });
      for (var h = 0; h < bb.max; h++) { if (retro) rect(ctx, 206 + h * 10, 5, 8, 9, h < bb.hp ? E.R : E.d); else { ctx.fillStyle = h < bb.hp ? '#ff7a59' : 'rgba(255,255,255,.15)'; ctx.fillRect(206 + h * 10, 6, 8, 8); } }
    }
    // ключ, Бураш
    if (S.keyGot) item(ctx, 'key', 304, 10, g.time, retro);
    var fx0 = 330; if (retro) { rect(ctx, fx0 - 6, 6, 12, 6, S.fox ? E.d : E.w); rect(ctx, fx0 + 3, 3, 5, 5, S.fox ? E.d : E.w); }
    else { ctx.globalAlpha = S.fox ? 0.35 : 1; fox(ctx, fx0 - 2, 16, 1, 0, false, null); ctx.globalAlpha = 1; }
    g.text(String(S.score), VW - 8, 15, { size: 12, align: 'right', color: th.ink, weight: 900 });
    g.text(g.t('n_' + LV.id), VW - 62, 15, { size: 9.5, align: 'right', color: th.muted, weight: 700 });
    if (ui.msg) { var a = Math.min(1, ui.msg.a / 0.3); ctx.globalAlpha = a; g.text(ui.msg.text, VW / 2, 44, { size: 13, align: 'center', color: ui.msg.color || th.ink, weight: 900 }); ctx.globalAlpha = 1; }
  }
  function banner(g, ctx, b, retro) {
    var th = g.th(), a = Math.min(1, b.a / 0.4, (b.dur - b.a + 0.05) / 0.25);
    ctx.globalAlpha = Math.max(0, a);
    var h = 70 + (b.lines ? b.lines.length * 16 : 0), y = VH / 2 - h / 2 - 10;
    if (retro) { rect(ctx, 40, y, VW - 80, h, E.k); rect(ctx, 40, y, VW - 80, 2, E.C); rect(ctx, 40, y + h - 2, VW - 80, 2, E.C); }
    else { ctx.fillStyle = 'rgba(8,18,34,.82)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(40, y, VW - 80, h, 12); else ctx.rect(40, y, VW - 80, h); ctx.fill(); }
    g.text(b.title, VW / 2, y + 32, { size: retro ? 20 : 22, align: 'center', color: b.color || th.accent, weight: 900 });
    if (b.sub) g.text(b.sub, VW / 2, y + 52, { size: 11, align: 'center', color: th.muted, weight: 700 });
    if (b.lines) b.lines.forEach(function (l, i) { g.text(l, VW / 2, y + 72 + i * 16, { size: 12, align: 'center', color: i === b.lines.length - 1 && b.hiLast ? th.warn : th.ink, weight: 800 }); });
    ctx.globalAlpha = 1;
  }

  // ---------- карта мира ----------
  function renderMap(g, ctx, M) {
    var retro = rt(g), th = g.th(), t = g.time, MAP = LD.MAP, p = M.prog;
    ctx.imageSmoothingEnabled = !retro;
    // три края
    var zones = [[0, 172, 1], [172, 340, 2], [340, VW, 3]];
    zones.forEach(function (z) {
      var P = REG[z[2]][retro ? 'r' : 'm'];
      if (retro) { rect(ctx, z[0], 0, z[1] - z[0], VH, z[2] === 1 ? E.g : z[2] === 2 ? E.c : E.B); }
      else { var gr = ctx.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, z[2] === 3 ? '#4d79b8' : z[2] === 2 ? '#8ec5e0' : '#7fa6a0'); gr.addColorStop(1, z[2] === 3 ? '#dbefff' : z[2] === 2 ? '#e9f6fb' : '#e6efe9'); ctx.fillStyle = gr; ctx.fillRect(z[0], 0, z[1] - z[0], VH); }
      // декор: ели / река / пики
      for (var i = 0; i < 9; i++) {
        var hx = z[0] + 12 + hash(i, z[2]) * (z[1] - z[0] - 24), hy = 30 + hash(z[2], i) * 230;
        if (z[2] === 1) { if (retro) { poly(ctx, [hx - 6, hy + 8, hx, hy - 8, hx + 6, hy + 8], '#005500'); rect(ctx, hx - 2, hy - 6, 4, 2, E.w); } else { poly(ctx, [hx - 7, hy + 9, hx, hy - 10, hx + 7, hy + 9], P.tree); poly(ctx, [hx - 3, hy - 3, hx, hy - 10, hx + 3, hy - 3], '#f4f8ff'); } }
        else if (z[2] === 3) { if (retro) { poly(ctx, [hx - 10, hy + 8, hx, hy - 10, hx + 10, hy + 8], E.b); rect(ctx, hx - 3, hy - 8, 6, 4, E.w); } else { poly(ctx, [hx - 12, hy + 9, hx, hy - 12, hx + 12, hy + 9], '#7aa4d6'); poly(ctx, [hx - 4, hy - 4, hx, hy - 12, hx + 4, hy - 4], '#ffffff'); } }
      }
      if (z[2] === 2) {
        ctx.strokeStyle = retro ? E.b : '#5aa7d4'; ctx.lineWidth = retro ? 8 : 10; ctx.beginPath(); ctx.moveTo(z[0] + 30, 0);
        for (var yy = 0; yy <= VH; yy += 24) ctx.lineTo(z[0] + 84 + Math.sin(yy * 0.03) * 34, yy); ctx.stroke();
        if (!retro) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 2; ctx.stroke(); }
      }
      g.text(g.t('r' + z[2]), (z[0] + z[1]) / 2, VH - 8, { size: 10, align: 'center', color: retro ? E.w : 'rgba(20,30,50,.7)', weight: 900 });
    });
    // Стужа — тучи с севера
    if (!retro) { var sg = ctx.createLinearGradient(0, 0, 0, 40); sg.addColorStop(0, 'rgba(30,40,70,.55)'); sg.addColorStop(1, 'rgba(30,40,70,0)'); ctx.fillStyle = sg; ctx.fillRect(0, 0, VW, 40); }
    // тропы
    MAP.EDGES.forEach(function (e) {
      var a = MAP.node(e.a), b = MAP.node(e.b), open = MAP.edgeOpen(p, e), known = !e.key || p.keys[e.key];
      if (!known && !p.cleared[e.a]) return;
      ctx.save();
      if (retro) { ctx.strokeStyle = open ? E.y : known ? E.l : E.d; ctx.lineWidth = 2; ctx.setLineDash(e.key ? [2, 4] : open ? [] : [4, 4]); }
      else { ctx.strokeStyle = open ? (e.key ? '#ffd34d' : 'rgba(110,70,40,.85)') : 'rgba(60,70,90,.35)'; ctx.lineWidth = open ? 3 : 2; ctx.setLineDash(e.key ? [3, 5] : open ? [] : [5, 5]); ctx.lineCap = 'round'; }
      if (!known) ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
      if (!known) g.text('?', (a.x + b.x) / 2, (a.y + b.y) / 2 + 4, { size: 12, align: 'center', color: retro ? E.y : '#5a4a2a', weight: 900 });
    });
    // узлы
    MAP.NODES.forEach(function (n) {
      var open = MAP.isOpen(p, n.id), done = !!p.cleared[n.id], full = !!p.full[n.id], isB = /B$/.test(n.id), isS = /S$/.test(n.id);
      if (isS && !open) return;
      var r = isB ? 11 : 8, sel = M.sel === n.id;
      if (retro) {
        var c = done ? E.G : open ? E.y : E.d;
        if (isS) poly(ctx, [n.x, n.y - r - 2, n.x + r + 2, n.y, n.x, n.y + r + 2, n.x - r - 2, n.y], c); else rect(ctx, n.x - r, n.y - r, r * 2, r * 2, c);
        rect(ctx, n.x - r + 2, n.y - r + 2, r * 2 - 4, r * 2 - 4, done ? E.g : open ? E.n : E.k);
        if (isB) { rect(ctx, n.x - 4, n.y - 3, 2, 6, E.w); rect(ctx, n.x + 2, n.y - 3, 2, 6, E.w); }
        if (full) rect(ctx, n.x + r - 2, n.y - r - 4, 6, 6, E.y);
        if (sel) { ctx.strokeStyle = E.w; ctx.lineWidth = 2; ctx.strokeRect(n.x - r - 4, n.y - r - 4, r * 2 + 8, r * 2 + 8); }
      } else {
        circ(ctx, n.x, n.y + 2, r + 2, 'rgba(0,0,0,.18)');
        if (isS) poly(ctx, [n.x, n.y - r - 3, n.x + r + 3, n.y, n.x, n.y + r + 3, n.x - r - 3, n.y], open ? '#ffd34d' : '#9aa3b5');
        circ(ctx, n.x, n.y, r, done ? '#3fae6a' : open ? '#fff6e2' : '#9aa3b5');
        circ(ctx, n.x, n.y, r - 2.5, done ? '#54c983' : open ? '#ff9a3d' : '#7c8496');
        if (isB) { poly(ctx, [n.x - 5, n.y - 4, n.x - 3, n.y + 5, n.x - 1, n.y - 4], '#ffffff'); poly(ctx, [n.x + 1, n.y - 4, n.x + 3, n.y + 5, n.x + 5, n.y - 4], '#ffffff'); }
        else if (done) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(n.x - 3, n.y); ctx.lineTo(n.x - 0.5, n.y + 2.5); ctx.lineTo(n.x + 3.5, n.y - 2.5); ctx.stroke(); }
        if (full) { ctx.save(); ctx.translate(n.x + r - 1, n.y - r + 1); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); for (var k = 0; k < 10; k++) { var ang = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 2 : 5; ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); } ctx.fill(); ctx.restore(); }
        if (sel) { ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y, r + 4 + Math.sin(t * 5) * 1.2, 0, Math.PI * 2); ctx.stroke(); }
        if (M.fresh && M.fresh[n.id] && !done) g.text(g.t('newTag'), n.x, n.y + r + 12, { size: 9, align: 'center', color: '#c2410c', weight: 900 });
      }
    });
    // Искра и Бураш на карте
    var hp = M.pos, bob = Math.abs(Math.sin(t * 4)) * 2;
    hero(ctx, hp.x - 2, hp.y - 9 - bob, { face: M.face || 1, run: M.moving ? t * 12 : 0, air: false, hasBoom: true }, retro, t);
    fox(ctx, hp.x + 20, hp.y - 2, -1, M.moving ? t : 0, retro, null);
    // панель
    if (retro) { rect(ctx, 0, 0, VW, 22, E.k); rect(ctx, 0, 22, VW, 2, E.y); }
    else { ctx.fillStyle = 'rgba(10,18,32,.78)'; ctx.fillRect(0, 0, VW, 24); }
    g.text(g.t('mapTitle'), 10, 16, { size: 12, color: th.accent, weight: 900 });
    var st = LD.save.stats(p);
    g.text('✓ ' + st.cleared + '/18   ★ ' + st.full + '   ' + g.t('key') .replace('!', '') + ': ' + st.keys + '/3', 150, 16, { size: 11, color: th.ink, weight: 800 });
    g.text('♥ ' + M.lives + '   ' + M.score, VW - 10, 16, { size: 11, align: 'right', color: th.ink, weight: 800 });
    // инфо об узле
    var sel = M.sel, info = g.t('n_' + sel), tags = [];
    if (/B$/.test(sel)) tags.push(g.t('bossTag')); if (/S$/.test(sel)) tags.push(g.t('secretTag'));
    if (p.cleared[sel]) tags.push(g.t('cleared')); if (p.full[sel]) tags.push(g.t('fullTag'));
    var bw = 300, bx = VW / 2 - bw / 2, by = VH - 52;
    if (retro) { rect(ctx, bx, by, bw, 34, E.k); rect(ctx, bx, by, bw, 2, E.y); }
    else { ctx.fillStyle = 'rgba(10,18,32,.8)'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, bw, 34, 9); else ctx.rect(bx, by, bw, 34); ctx.fill(); }
    g.text(g.t('r' + sel.charAt(0)) + ' · ' + info + (tags.length ? '  — ' + tags.join(', ') : ''), VW / 2, by + 14, { size: 12, align: 'center', color: th.ink, weight: 900 });
    g.text(M.note || g.t('mapHint'), VW / 2, by + 28, { size: 9.5, align: 'center', color: M.note ? th.warn : th.muted, weight: 700 });
  }

  LD.R = { VW: VW, VH: VH, E: E, HERO: HERO, REG: REG, hero: hero, fox: fox, item: item, enemy: enemy, boss: boss, camp: camp, tent: tent, boomShape: boomShape, background: background, FX: FX, snow: snow };
  LD.renderLevel = renderLevel;
  LD.renderMap = renderMap;
})(typeof window !== 'undefined' ? window : globalThis);
