/* ДОСПЕХ · отрисовка (обе темы). modern — градиенты, параллакс, свечение; retro — тот же кадр в буфере 256×144
   плоскими цветами и крупным пикселем. Тема меняет только вид, не логику.
   DOSPEH.render(g, ctx, S, ui) · DOSPEH.R — размеры, палитры, фигуры (герой и пр.) · DOSPEH.fx — частицы. */
(function (global) {
  'use strict';
  var D = global.DOSPEH = global.DOSPEH || {};
  var W = 512, H = 288, TS = 16, HUD = 32;
  var R = { W: W, H: H, TS: TS, HUD: HUD };
  D.R = R;

  // ---------- палитры уровней: [modern, retro] ----------
  var PAL = {
    wastes: { sky: ['#2a1630', '#7a3a2a', '#d98a3a'], far: '#3a2028', near: '#4b2a26', top: '#c8793a', body: '#5a3424', dark: '#3a2018', liq: null,
      r: { sky: '#1a0010', far: '#3c1400', top: '#d87028', body: '#6c3010', dark: '#3c1400' } },
    river: { sky: ['#14262a', '#2f4a44', '#8a7a4a'], far: '#22302c', near: '#2c3a30', top: '#7d9a5a', body: '#3e3a26', dark: '#2a2618', liq: ['#8a3f12', '#c4621e'],
      r: { sky: '#001410', far: '#203020', top: '#88a050', body: '#504028', dark: '#282010', liq: '#a84810' } },
    hills: { sky: ['#1e2230', '#4a4a58', '#9a8a7a'], far: '#33343e', near: '#40404a', top: '#9a9a78', body: '#4e4a40', dark: '#34302a', liq: null,
      r: { sky: '#101018', far: '#303038', top: '#a0a078', body: '#585048', dark: '#302820' } },
    cave: { sky: ['#0c0606', '#2a0e08', '#4a1a0c'], far: '#2a1410', near: '#3a1a12', top: '#b0583a', body: '#4a2a22', dark: '#2a1612', liq: ['#ff7a1a', '#ffd04a'],
      r: { sky: '#000000', far: '#280800', top: '#c05830', body: '#502818', dark: '#280c04', liq: '#ff8800' } },
    bridge: { sky: ['#101430', '#2a2a5a', '#6a4a6a'], far: '#1c1e3a', near: '#262848', top: '#8a8aa0', body: '#3a3a4e', dark: '#24243a', liq: null,
      r: { sky: '#000020', far: '#181838', top: '#9898b0', body: '#404058', dark: '#202038' } },
    tower: { sky: ['#180c22', '#3a1a3a', '#6a2a3a'], far: '#2a1830', near: '#36203a', top: '#9a6a8a', body: '#3e2a3a', dark: '#28182a', liq: null,
      r: { sky: '#100010', far: '#301030', top: '#a07090', body: '#482840', dark: '#281028' } },
    forge: { sky: ['#140404', '#3a0a06', '#7a1a08'], far: '#2a0c08', near: '#3a120c', top: '#c0603a', body: '#4a2018', dark: '#2a0e0a', liq: ['#ff6a10', '#ffd040'],
      r: { sky: '#100000', far: '#300800', top: '#d06030', body: '#582010', dark: '#300800', liq: '#ff7000' } }
  };
  R.PAL = PAL;
  // герой: металл доспеха, золото, рубаха и фартук (обе темы)
  var HERO = {
    m: { metal: '#c8793a', metalD: '#8a4a22', metalL: '#f0b070', trim: '#3fb59a', mail: '#9aa0a8', gold: '#ffd24a', goldD: '#c08a18', goldL: '#fff2a8',
      shirt: '#efe6d2', shirtD: '#c8bca4', stitch: '#c0392b', apron: '#7a4b2a', apronD: '#5a3418', skin: '#e8b48a', hair: '#4a2a18', pants: '#3a3040', boot: '#2a1c14' },
    r: { metal: '#d87830', metalD: '#884000', metalL: '#ffb060', trim: '#40c0a0', mail: '#a0a0a0', gold: '#ffd800', goldD: '#c08800', goldL: '#ffff90',
      shirt: '#f0f0e0', shirtD: '#c0c0a8', stitch: '#d82800', apron: '#885020', apronD: '#583010', skin: '#f0b890', hair: '#502800', pants: '#383048', boot: '#281810' }
  };
  R.HERO = HERO;

  // ---------- частицы ----------
  var parts = [], FOEFLY = { kite: 1, blub: 1 };
  var fx = {
    puff: function (x, y, col, n, sp, life, grav) { for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, v = sp * (0.3 + Math.random() * 0.7); parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (grav ? sp * 0.4 : 0), g: grav ? 18 : 0, life: life * (0.6 + Math.random() * 0.4), max: life, col: col }); } if (parts.length > 400) parts.splice(0, parts.length - 400); },
    step: function (dt) { for (var i = parts.length - 1; i >= 0; i--) { var p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; } p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; } },
    clear: function () { parts.length = 0; }
  };
  D.fx = fx;

  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function box(c, col, x, y, w, h) { c.fillStyle = col; c.fillRect(x, y, w, h); }

  // ---------- герой (x,y — подошвы в пикселях; f — направление) ----------
  // st: { armor 0|1|2, run (сек), air, crouch, climb, throwT, charge, hurt, t }
  function heroFig(c, x, y, f, st, retro) {
    var K = HERO[retro ? 'r' : 'm'], t = st.t || 0;
    c.save(); c.translate(Math.round(x), Math.round(y)); if (f < 0) c.scale(-1, 1);
    var ph = st.run ? Math.floor(st.run * 10) % 4 : 0, legA = st.air ? 2 : [0, 2, 0, -2][ph], legB = -legA;
    var crouch = st.crouch ? 8 : 0, arm = st.armor;
    var M = arm === 2 ? K.gold : K.metal, MD = arm === 2 ? K.goldD : K.metalD, ML = arm === 2 ? K.goldL : K.metalL;
    if (st.climb) { legA = Math.floor(t * 8) % 2 ? 3 : -3; legB = -legA; }
    // ноги
    var hipY = -12 + crouch * 0.6;
    box(c, K.pants, -4 + Math.min(0, legA), hipY, 3, 9 - crouch * 0.4); box(c, K.pants, 1 + Math.max(0, legB) * 0.5, hipY, 3, 9 - crouch * 0.4);
    if (arm) { box(c, M, -4 + Math.min(0, legA), hipY + 2, 3, 3); box(c, M, 1 + Math.max(0, legB) * 0.5, hipY + 2, 3, 3); }
    box(c, K.boot, -5 + Math.min(0, legA), -3, 4, 3); box(c, K.boot, 1 + Math.max(0, legB) * 0.5, -3, 4, 3);
    // корпус
    var top = -25 + crouch;
    if (arm) {
      box(c, MD, -5, top + 4, 10, 10); box(c, M, -4, top + 4, 8, 9); box(c, ML, -3, top + 5, 2, 6);
      box(c, K.trim, -5, top + 12, 10, 2);                         // пояс с патиной
      box(c, K.mail, -5, top + 14, 10, 3);                         // кольчужный подол
      box(c, MD, -6, top + 3, 3, 4); box(c, MD, 3, top + 3, 3, 4);  // наплечники
      if (arm === 2 && !retro) { c.fillStyle = 'rgba(255,240,160,' + (0.35 + 0.25 * Math.sin(t * 6)) + ')'; c.fillRect(-1, top + 6, 2, 2); }
    } else {
      box(c, K.shirtD, -5, top + 4, 10, 11); box(c, K.shirt, -4, top + 4, 8, 10);
      box(c, K.stitch, -2, top + 4, 4, 1); box(c, K.stitch, -1, top + 5, 2, 2);  // вышитый ворот
      box(c, K.apron, -4, top + 8, 8, 9); box(c, K.apronD, -4, top + 8, 8, 1); box(c, K.apronD, -1, top + 10, 2, 3); // фартук с карманом
      box(c, K.stitch, -5, top + 15, 10, 1);
    }
    // рука (бросок — вперёд)
    var thr = st.throwT > 0, ax = thr ? 4 : 1, ay = thr ? top + 6 : top + 7;
    if (st.climb) { ax = 2; ay = top + (Math.floor(t * 8) % 2 ? 1 : 4); }
    box(c, arm ? M : K.shirt, ax, ay, thr ? 6 : 3, 3); box(c, K.skin, ax + (thr ? 6 : 1), ay + (thr ? 0 : 3), 2, 2);
    // голова
    var hy = top - 4;
    box(c, K.skin, -3, hy, 6, 6);
    box(c, '#1a1010', 1, hy + 2, 1, 1);
    if (arm) {
      // шишак: остроконечный шлем с наносником и бармицей
      box(c, MD, -4, hy - 1, 8, 3); box(c, M, -3, hy - 3, 6, 3); box(c, M, -2, hy - 5, 4, 2); box(c, ML, -1, hy - 7, 2, 2);
      box(c, MD, 2, hy + 1, 1, 3);                                   // наносник
      box(c, K.mail, -4, hy + 2, 2, 5); box(c, K.mail, -4, hy + 5, 7, 2); // бармица
      box(c, K.trim, -4, hy - 1, 8, 1);
    } else {
      box(c, K.hair, -4, hy - 2, 7, 3); box(c, K.hair, -4, hy, 2, 3);
      box(c, K.stitch, -4, hy - 1, 8, 1);                             // очелье
    }
    // заряд особого удара
    if (st.charge > 0 && arm === 2) {
      var k = Math.min(1, st.charge / (D.logic ? D.logic.CHARGE : 0.9));
      c.strokeStyle = k >= 1 ? (retro ? '#ffff90' : 'rgba(255,240,150,.9)') : (retro ? '#c08800' : 'rgba(255,200,80,.6)'); c.lineWidth = 1.5;
      c.beginPath(); c.arc(0, top + 8, 8 + k * 4 + (k >= 1 ? Math.sin(t * 20) : 0), 0, Math.PI * 2 * k); c.stroke();
    }
    c.restore();
  }
  R.heroFig = heroFig;

  // ---------- оружие-иконки и снаряды (в px, центр) ----------
  var WCOL = { spear: '#d8d0c0', axe: '#b8c0c8', torch: '#ffb040', blades: '#e0e8f0', shield: '#c8793a', hammer: '#ffd24a' };
  function weaponFig(c, k, x, y, s, rot, retro) {
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.scale(s, s);
    if (k === 'spear') { box(c, '#8a5a2a', -7, -1, 10, 2); box(c, retro ? '#e0e0e0' : '#e8e4dc', 3, -2, 4, 4); box(c, retro ? '#ffffff' : '#fffaf0', 7, -1, 2, 2); }
    else if (k === 'axe') { box(c, '#8a5a2a', -1, -6, 2, 12); c.fillStyle = retro ? '#c0c0c0' : '#c8d0d8'; c.beginPath(); c.moveTo(1, -6); c.lineTo(6, -4); c.lineTo(6, 3); c.lineTo(1, 1); c.closePath(); c.fill(); box(c, '#ffffff', 5, -3, 1, 5); }
    else if (k === 'torch') { box(c, '#6a3a1a', -1, -1, 2, 7); c.fillStyle = '#ff7a10'; c.beginPath(); c.arc(0, -3, 3, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffe070'; c.beginPath(); c.arc(0, -3.5, 1.6, 0, Math.PI * 2); c.fill(); }
    else if (k === 'blades') { c.fillStyle = retro ? '#e0e0e0' : '#e8eef4'; c.beginPath(); c.moveTo(-4, -1); c.lineTo(4, 0); c.lineTo(-4, 1); c.closePath(); c.fill(); box(c, '#6a4a2a', -6, -1, 2, 2); }
    else if (k === 'shield') { c.fillStyle = retro ? '#d87830' : '#c8793a'; c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill(); c.fillStyle = retro ? '#40c0a0' : '#3fb59a'; c.beginPath(); c.arc(0, 0, 3.2, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffd24a'; c.beginPath(); c.arc(0, 0, 1.4, 0, Math.PI * 2); c.fill(); }
    else if (k === 'hammer') { box(c, '#6a3a1a', -1, -2, 2, 9); box(c, retro ? '#ffd800' : '#ffd24a', -5, -6, 10, 5); box(c, retro ? '#c08800' : '#c08a18', -5, -2, 10, 1); box(c, '#fff2a8', -4, -5, 3, 1); }
    c.restore();
  }
  R.weaponFig = weaponFig; R.WCOL = WCOL;

  // ---------- враги ----------
  function foeFig(c, e, px, py, t, retro, liquid) {
    var f = e.face || 1, fl = e.flash > 0;
    c.save(); c.translate(Math.round(px), Math.round(py));
    if (e.type === 'riser') {
      var up = e.st === 'rise' ? Math.min(1, e.t / 0.9) : e.st === 'sink' ? 1 - Math.min(1, e.t / 0.8) : 1;
      c.save(); c.beginPath(); c.rect(-12, -24, 24, 24); c.clip(); c.translate(0, (1 - up) * 20);
      var bob = Math.sin(t * 8 + e.x) * 1;
      c.fillStyle = fl ? '#ffffff' : (retro ? '#8a7060' : '#86705e'); c.beginPath(); c.ellipse(0, -9 + bob, 7, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = fl ? '#ffffff' : (retro ? '#584838' : '#5a4a3c'); c.fillRect(-7, -4 + bob, 14, 4);
      c.strokeStyle = retro ? '#ffaa00' : '#ffb04a'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-4, -14 + bob); c.lineTo(-1, -9 + bob); c.lineTo(-3, -5 + bob); c.moveTo(3, -13 + bob); c.lineTo(5, -8 + bob); c.stroke();
      c.fillStyle = retro ? '#ffff00' : '#ffe14a'; c.fillRect(f > 0 ? 1 : -4, -13 + bob, 3, 3); c.fillStyle = '#000'; c.fillRect(f > 0 ? 3 : -4, -12 + bob, 1, 1);
      box(c, retro ? '#584838' : '#5a4a3c', f * 6 - 2, -7 + bob, 5, 3);  // клешня
      c.restore();
      if (e.st === 'rise') { c.fillStyle = retro ? '#884400' : 'rgba(200,110,40,.8)'; for (var i = 0; i < 4; i++) c.fillRect(-8 + i * 5 + Math.sin(t * 20 + i) * 1, -2 - (i % 2) * 2, 2, 2); }
    } else if (e.type === 'blub') {
      var hot = liquid === 'lava';
      c.fillStyle = fl ? '#fff' : hot ? (retro ? '#ff8800' : '#ff7a1a') : (retro ? '#a84810' : '#a8501e'); c.beginPath(); c.ellipse(0, -6, 6, 7, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = hot ? '#ffe070' : (retro ? '#d87028' : '#d8803a'); c.beginPath(); c.ellipse(-2, -9, 2, 2, 0, 0, Math.PI * 2); c.fill();
      box(c, '#fff', -3, -7, 2, 2); box(c, '#fff', 1, -7, 2, 2); box(c, '#000', -2, -6, 1, 1); box(c, '#000', 2, -6, 1, 1);
      c.fillStyle = hot ? 'rgba(255,200,80,.7)' : 'rgba(200,110,40,.7)'; c.fillRect(-1, 0, 2, 4);
    } else if (e.type === 'kite') {
      var warn = e.st === 'warn' && Math.floor(t * 16) % 2;
      c.translate(0, -5);
      c.fillStyle = fl || warn ? '#ffffff' : (retro ? '#a0a0a8' : '#9aa6b0');
      c.beginPath(); c.moveTo(-9 * f, 0); c.lineTo(6 * f, -5); c.lineTo(9 * f, 0); c.lineTo(6 * f, 5); c.closePath(); c.fill();
      c.fillStyle = retro ? '#585860' : '#5a6670'; c.beginPath(); c.moveTo(-9 * f, 0); c.lineTo(6 * f, 0); c.lineTo(6 * f, 5); c.closePath(); c.fill();
      c.strokeStyle = retro ? '#d0d0d0' : '#c8d4dc'; c.lineWidth = 1; var ra = t * 30;
      c.beginPath(); c.moveTo(Math.cos(ra) * 7, -7 + Math.sin(ra) * 1.5); c.lineTo(-Math.cos(ra) * 7, -7 - Math.sin(ra) * 1.5); c.stroke(); box(c, '#5a6670', -1, -7, 2, 3);
      box(c, retro ? '#00ffff' : '#4ae8ff', 4 * f - 1, -2, 3, 2);
      c.strokeStyle = retro ? '#d82800' : '#d0503a'; c.beginPath(); c.moveTo(-9 * f, 0); c.lineTo(-13 * f, 3 + Math.sin(t * 9) * 2); c.lineTo(-16 * f, 1); c.stroke();
    } else if (e.type === 'vent') {
      var h2 = e.st === 'hidden' ? 0 : e.st === 'up' ? Math.min(1, e.t / 0.6) : 1;
      c.save(); c.beginPath(); c.rect(-10, -24, 20, 24); c.clip(); c.translate(0, (1 - h2) * 22);
      box(c, fl ? '#fff' : (retro ? '#606060' : '#5a5c60'), -6, -20, 12, 20); box(c, retro ? '#808080' : '#7a7e84', -5, -19, 3, 18);
      box(c, retro ? '#404040' : '#3a3c40', -8, -22, 16, 4); box(c, retro ? '#d87830' : '#c8793a', -7, -10, 14, 2);
      var open = e.cd < 0.5; box(c, open ? (retro ? '#ff8800' : '#ff8a2a') : '#1a1a1a', -3, -21, 6, 2);
      c.restore();
    } else if (e.type === 'brute') {
      var st = Math.floor(t * 4 + e.x) % 2;
      box(c, retro ? '#383030' : '#3a3434', -6, -6, 4, 6 - st); box(c, retro ? '#383030' : '#3a3434', 2, -6 + st, 4, 6 - st);
      c.fillStyle = fl ? '#fff' : (retro ? '#884000' : '#8a4a2a'); rr(c, -8, -30, 16, 25, 4); c.fill();
      box(c, retro ? '#582000' : '#5a2c18', -8, -24, 16, 2); box(c, retro ? '#582000' : '#5a2c18', -8, -14, 16, 2);
      box(c, retro ? '#ffff00' : '#ffd24a', f > 0 ? 2 : -6, -27, 4, 2);
      box(c, retro ? '#606060' : '#6a6e74', f * 7 - (f > 0 ? 0 : 4), -22, 4, 10); box(c, retro ? '#404040' : '#4a4e54', f * 9 - (f > 0 ? 0 : 3), -13, 3, 4);
    }
    c.restore();
  }
  R.foeFig = foeFig;

  // ---------- стражи ----------
  function bossFig(c, b, px, py, t, retro, loop) {
    var f = b.face || 1, fl = b.flash > 0;
    c.save(); c.translate(Math.round(px), Math.round(py)); if (f < 0 && b.key !== 'serpent') c.scale(-1, 1);
    if (b.key === 'golem') {
      var sq = b.mode === 'wind' ? 2 : 0;
      box(c, retro ? '#383030' : '#34302e', -12, -10, 8, 10); box(c, retro ? '#383030' : '#34302e', 4, -10, 8, 10);
      c.fillStyle = fl ? '#fff' : (retro ? '#806050' : '#7a5a4a'); rr(c, -16, -40 + sq, 32, 32 - sq, 8); c.fill();
      c.fillStyle = retro ? '#584038' : '#5a4036'; for (var i = 0; i < 5; i++) { c.fillRect(-14 + i * 7, -38 + sq, 2, 2); c.fillRect(-14 + i * 7, -12, 2, 2); }
      box(c, retro ? '#282020' : '#2a2220', -8, -30 + sq, 16, 14);
      box(c, retro ? '#ff8800' : '#ff8a2a', -6, -28 + sq, 12, 10); if (!retro) { c.fillStyle = 'rgba(255,220,120,' + (0.5 + 0.3 * Math.sin(t * 9)) + ')'; c.fillRect(-4, -26 + sq, 8, 6); }
      box(c, retro ? '#404040' : '#4a4a4e', 6, -48, 5, 10);   // труба
      box(c, retro ? '#806050' : '#7a5a4a', 14, -30 + sq + (b.mode === 'throw' ? -6 : 0), 6, 12); // рука
      c.fillStyle = 'rgba(120,120,130,.5)'; c.beginPath(); c.arc(8.5, -52 - (t * 10 % 8), 3 + (t * 10 % 8) * 0.3, 0, Math.PI * 2); c.fill();
    } else if (b.key === 'crab') {
      var leg = Math.sin(t * 16) * 2;
      c.strokeStyle = retro ? '#884000' : '#8a3e1e'; c.lineWidth = 2;
      for (var l = 0; l < 3; l++) { c.beginPath(); c.moveTo(-10 + l * 7, -8); c.lineTo(-14 + l * 7 + (l % 2 ? leg : -leg), 0); c.stroke(); }
      c.fillStyle = fl ? '#fff' : (retro ? '#b05020' : '#a8502a'); c.beginPath(); c.ellipse(0, -14, 20, 10, 0, Math.PI, 0); c.fill(); c.fillRect(-20, -14, 40, 6);
      c.fillStyle = retro ? '#d87028' : '#d0703a'; for (var s = -2; s <= 2; s++) c.fillRect(s * 7 - 1, -22, 2, 8);
      var up = b.mode === 'aim' ? -8 : 0;
      c.fillStyle = fl ? '#fff' : (retro ? '#c05828' : '#b85a30'); c.beginPath(); c.ellipse(24, -16 + up, 8, 6, 0, 0, Math.PI * 2); c.fill();
      box(c, retro ? '#282020' : '#2a1a14', 26, -17 + up, 7, 2);
      box(c, retro ? '#ffff00' : '#ffe14a', 10, -24, 3, 3); box(c, retro ? '#ffff00' : '#ffe14a', 4, -24, 3, 3);
    } else if (b.key === 'serpent') {
      var n = 7, sx = -(b.vx || 1) > 0 ? 1 : -1;
      for (var k = n - 1; k >= 0; k--) {
        var kx = sx * k * 7, ky = -8 + Math.sin(t * 6 - k * 0.8) * 3, rad = k === 0 ? 9 : 7 - k * 0.5;
        c.fillStyle = fl ? '#fff' : k % 2 ? (retro ? '#c07020' : '#b8702e') : (retro ? '#e09040' : '#d8904a');
        c.beginPath(); c.arc(kx, ky, rad, 0, Math.PI * 2); c.fill();
        if (k > 0 && k % 2 === 0) { c.fillStyle = retro ? '#40c0a0' : '#3fb59a'; c.fillRect(kx - 1, ky - rad - 3, 2, 4); }
      }
      var warn = b.mode === 'warn' && Math.floor(t * 16) % 2;
      box(c, warn ? '#ffffff' : (retro ? '#00ffff' : '#6af0ff'), -sx * 4 - 1, -12, 3, 3);
      c.strokeStyle = retro ? '#e0e0e0' : '#f0e8d8'; c.lineWidth = 1; c.beginPath(); c.moveTo(-sx * 8, -6); c.lineTo(-sx * 13, -3); c.stroke();
    } else if (b.key === 'koshey') {
      var fade = b.mode === 'fade' ? Math.abs(Math.cos(b.mt * 6)) * (b.mt > 0.3 ? 0.25 : 1) : 1;
      c.globalAlpha = fade;
      c.fillStyle = retro ? '#301818' : '#2a1414'; c.beginPath(); c.moveTo(-10, -40); c.lineTo(10, -40); c.lineTo(14 + Math.sin(t * 3) * 2, 0); c.lineTo(-14, 0); c.closePath(); c.fill(); // плащ-лохмотья
      box(c, retro ? '#606060' : '#5a5a5e', -5, -14, 3, 14); box(c, retro ? '#606060' : '#5a5a5e', 2, -14, 3, 14);
      c.fillStyle = fl ? '#fff' : (retro ? '#884820' : '#8a4a26'); rr(c, -9, -40, 18, 24, 3); c.fill();
      c.strokeStyle = retro ? '#582000' : '#4a2410'; c.lineWidth = 1.5; for (var q = 0; q < 4; q++) { c.beginPath(); c.moveTo(-8, -36 + q * 5); c.lineTo(8, -36 + q * 5); c.stroke(); }
      var shielded = loop === 2;
      c.fillStyle = shielded ? (retro ? '#00ff80' : '#4affa0') : (retro ? '#ff8800' : '#ff9a3a');
      c.fillRect(-4, -30, 8, 3); c.fillRect(-2, -27, 4, 3); c.fillRect(-5, -33, 10, 3);   // наковальня-сердце в клетке
      if (!retro) { c.fillStyle = shielded ? 'rgba(80,255,160,.25)' : 'rgba(255,160,60,.25)'; c.beginPath(); c.arc(0, -29, 9 + Math.sin(t * 5), 0, Math.PI * 2); c.fill(); }
      var cast = b.mode === 'cast' || b.mode === 'summon';
      box(c, retro ? '#a06030' : '#9a5a32', 9, -38 + (cast ? -6 : 0), 3, 18); box(c, retro ? '#a06030' : '#9a5a32', -12, -38, 3, 18);
      if (cast) { c.fillStyle = shielded ? '#4affa0' : '#ffb04a'; c.beginPath(); c.arc(11, -45, 3 + Math.sin(t * 20), 0, Math.PI * 2); c.fill(); }
      c.fillStyle = retro ? '#d0c8b0' : '#d8d0b8'; rr(c, -6, -50, 12, 10, 3); c.fill();             // череп-маска
      box(c, shielded ? '#4affa0' : (retro ? '#ff4000' : '#ff5a3a'), 1, -47, 3, 2); box(c, '#201010', -4, -47, 3, 2); box(c, '#201010', -3, -43, 6, 1);
      c.fillStyle = retro ? '#c08800' : '#c8962a'; for (var cr = -2; cr <= 2; cr++) { c.beginPath(); c.moveTo(cr * 3 - 1.5, -50); c.lineTo(cr * 3, -55 - (cr % 2 ? 0 : 2)); c.lineTo(cr * 3 + 1.5, -50); c.fill(); } // корона-шестерня
      c.globalAlpha = 1;
    }
    c.restore();
  }
  R.bossFig = bossFig;

  // ---------- предметы ----------
  function chestFig(c, ch, px, py, t, retro) {
    c.save(); c.translate(Math.round(px), Math.round(py));
    var lid = ch.open ? Math.min(1, ch.t * 4) : 0, fl = ch.flash > 0;
    box(c, fl ? '#fff' : (retro ? '#884400' : '#7a4b2a'), -8, -10, 16, 10);
    box(c, retro ? '#606060' : '#6a6e74', -8, -10, 16, 2); box(c, retro ? '#606060' : '#6a6e74', -8, -2, 16, 2);
    box(c, retro ? '#ffd800' : '#e0b040', -2, -7, 4, 4);
    c.save(); c.translate(-8, -10); c.rotate(-lid * 1.2); box(c, fl ? '#fff' : (retro ? '#a05010' : '#8a5a32'), 0, -5, 16, 5); box(c, retro ? '#606060' : '#6a6e74', 0, -5, 16, 1); c.restore();
    c.restore();
  }
  function itemFig(c, it, px, py, t, retro) {
    var bob = it.ground ? Math.sin(t * 4 + it.x) * 1.5 : 0, y = py - 8 + bob;
    if (!retro) { c.fillStyle = it.k === 'key' || it.k === 'gold' || it.k === 'hammer' ? 'rgba(255,210,80,.25)' : 'rgba(255,255,255,.12)'; c.beginPath(); c.arc(px, y, 10, 0, Math.PI * 2); c.fill(); }
    if (it.pedestal) { box(c, retro ? '#606060' : '#5a5c60', px - 7, py - 4, 14, 4); }
    if (it.k === 'arm' || it.k === 'gold') {
      var g = it.k === 'gold', K = HERO[retro ? 'r' : 'm'];
      box(c, g ? K.goldD : K.metalD, px - 6, y - 6, 12, 11); box(c, g ? K.gold : K.metal, px - 5, y - 6, 10, 10); box(c, g ? K.goldL : K.metalL, px - 3, y - 5, 2, 7);
      box(c, K.trim, px - 6, y + 2, 12, 2);
      if (g && Math.floor(t * 6) % 2) box(c, '#ffffff', px + 3, y - 7, 2, 2);
    } else if (it.k === 'key') {
      c.fillStyle = retro ? '#ffd800' : '#ffd24a'; c.beginPath(); c.arc(px - 4, y, 4, 0, Math.PI * 2); c.fill(); c.fillStyle = '#3a2010'; c.beginPath(); c.arc(px - 4, y, 1.6, 0, Math.PI * 2); c.fill();
      box(c, retro ? '#ffd800' : '#ffd24a', px, y - 1, 9, 2); box(c, retro ? '#ffd800' : '#ffd24a', px + 5, y + 1, 2, 3); box(c, retro ? '#ffd800' : '#ffd24a', px + 8, y + 1, 1, 3);
    } else if (it.k === 'hammer') weaponFig(c, 'hammer', px, y, 1.3, Math.sin(t * 3) * 0.2, retro);
    else if (it.k.indexOf('w:') === 0) weaponFig(c, it.k.slice(2), px, y, 1.2, 0, retro);
  }
  R.chestFig = chestFig; R.itemFig = itemFig;

  // ---------- фон ----------
  function background(c, P, key, camX, t, retro, Wd, Hd) {
    var y0 = HUD;
    if (retro) { box(c, P.r.sky, 0, y0, Wd, Hd - y0); }
    else { var gr = c.createLinearGradient(0, y0, 0, Hd); gr.addColorStop(0, P.sky[0]); gr.addColorStop(0.6, P.sky[1]); gr.addColorStop(1, P.sky[2]); c.fillStyle = gr; c.fillRect(0, y0, Wd, Hd - y0); }
    var far = retro ? P.r.far : P.far, near = retro ? P.r.near || P.r.far : P.near, i, x;
    // дальний план: кучи шлака, трубы, дым — параллакс 0.2
    var o1 = -(camX * TS * 0.2) % 128;
    c.fillStyle = far;
    for (i = -1; i < Wd / 128 + 2; i++) {
      x = o1 + i * 128;
      c.beginPath(); c.moveTo(x, Hd); c.lineTo(x + 30, y0 + 120); c.lineTo(x + 52, y0 + 108); c.lineTo(x + 90, y0 + 140); c.lineTo(x + 128, Hd); c.fill();
      if (key !== 'cave' && i % 2 === 0) { c.fillRect(x + 70, y0 + 70, 8, 80); c.fillRect(x + 67, y0 + 66, 14, 6); }
    }
    if (!retro && key !== 'cave') {
      for (i = 0; i < 6; i++) { var sx = ((i * 97 - camX * TS * 0.2 + t * 6) % (Wd + 80) + Wd + 80) % (Wd + 80) - 40; c.fillStyle = 'rgba(90,80,90,.10)'; c.beginPath(); c.arc(sx, y0 + 50 - (i % 3) * 10, 20 + (i % 2) * 8, 0, Math.PI * 2); c.fill(); }
    }
    if (key === 'cave' || key === 'forge') {
      c.fillStyle = retro ? '#200800' : 'rgba(30,10,8,.9)';
      for (i = -1; i < Wd / 48 + 2; i++) { x = (-(camX * TS * 0.35) % 48) + i * 48; c.beginPath(); c.moveTo(x, y0); c.lineTo(x + 12, y0 + 30 + (i % 3) * 10); c.lineTo(x + 24, y0); c.fill(); }
    }
    // ближний план 0.45
    var o2 = -(camX * TS * 0.45) % 96;
    c.fillStyle = near;
    for (i = -1; i < Wd / 96 + 2; i++) {
      x = o2 + i * 96;
      if (key === 'bridge') { c.fillRect(x + 10, y0 + 130, 6, 130); c.fillRect(x + 80, y0 + 130, 6, 130); c.fillRect(x, y0 + 130, 96, 5); c.strokeStyle = near; c.lineWidth = 2; c.beginPath(); c.moveTo(x + 13, y0 + 135); c.lineTo(x + 83, y0 + 200); c.moveTo(x + 83, y0 + 135); c.lineTo(x + 13, y0 + 200); c.stroke(); }
      else if (key === 'tower') { c.fillRect(x + 20, y0 + 40, 30, 220); c.fillRect(x + 16, y0 + 36, 38, 8); for (var w2 = 0; w2 < 4; w2++) { c.fillStyle = retro ? '#ff8800' : 'rgba(255,150,60,.5)'; c.fillRect(x + 32, y0 + 60 + w2 * 40, 6, 8); c.fillStyle = near; } }
      else { c.beginPath(); c.moveTo(x, Hd); c.quadraticCurveTo(x + 30, y0 + 150, x + 60, y0 + 175); c.quadraticCurveTo(x + 80, y0 + 165, x + 96, Hd); c.fill(); }
    }
  }

  // ---------- клетки ----------
  function tiles(c, lv, P, camX, t, retro) {
    var L = D.logic, c0 = Math.floor(camX), c1 = Math.min(lv.W - 1, c0 + 33), ox = -camX * TS;
    var top = retro ? P.r.top : P.top, body = retro ? P.r.body : P.body, dark = retro ? P.r.dark : P.dark;
    for (var cx = Math.max(0, c0); cx <= c1; cx++) {
      var px = Math.round(ox + cx * TS);
      for (var r = 0; r < L.R; r++) {
        var k = lv.t[r * lv.W + cx], py = HUD + r * TS;
        if (k === L.SOL) {
          var exposed = r === 0 || lv.t[(r - 1) * lv.W + cx] !== L.SOL;
          box(c, body, px, py, TS, TS);
          if (lv.key === 'bridge' || lv.key === 'tower') { box(c, dark, px, py + 7, TS, 1); box(c, dark, px + ((r % 2) ? 4 : 11), py, 1, 7); box(c, dark, px + ((r % 2) ? 11 : 4), py + 8, 1, 8); }
          else { var hsh = (cx * 7 + r * 13) % 5; box(c, dark, px + 3 + hsh, py + 5 + (hsh % 3) * 2, 3, 2); box(c, dark, px + 10 - hsh, py + 11, 2, 2); }
          if (exposed) {
            box(c, top, px, py, TS, 4); box(c, dark, px, py + 4, TS, 1);
            if (!retro) { c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(px, py, TS, 1); }
            if ((cx * 5) % 3 === 0) box(c, top, px + 5, py + 4, 3, 2);   // наплывы окалины
          }
          var lw = cx > 0 && lv.t[r * lv.W + cx - 1] !== L.SOL, rw = cx < lv.W - 1 && lv.t[r * lv.W + cx + 1] !== L.SOL;
          if (lw) box(c, dark, px, py, 1, TS); if (rw) box(c, dark, px + TS - 1, py, 1, TS);
        } else if (k === L.ONE) {
          box(c, retro ? '#806040' : '#7a5a3a', px, py, TS, 4); box(c, retro ? '#503020' : '#4a3020', px, py + 4, TS, 1);
          box(c, retro ? '#606060' : '#6a6e74', px + 2, py + 1, 2, 2); box(c, retro ? '#606060' : '#6a6e74', px + 12, py + 1, 2, 2);
        } else if (k === L.LAD) {
          box(c, retro ? '#a06830' : '#9a6a3a', px + 2, py, 2, TS); box(c, retro ? '#a06830' : '#9a6a3a', px + 12, py, 2, TS);
          for (var s = 0; s < 4; s++) box(c, retro ? '#c08848' : '#c08a4a', px + 2, py + 2 + s * 4, 12, 2);
        }
      }
    }
    // жижа на дне пропастей
    if (lv.liquid) {
      var lc = retro ? P.r.liq : null;
      for (var q = Math.max(0, c0); q <= c1; q++) {
        if (lv.t[(L.R - 1) * lv.W + q] !== 0) continue;
        var lx = Math.round(ox + q * TS), ly = HUD + (L.R - 1) * TS + 4 + Math.sin(t * 3 + q) * 1.5;
        if (retro) box(c, lc, lx, ly, TS, HUD + L.R * TS - ly);
        else { var gr = c.createLinearGradient(0, ly, 0, HUD + L.R * TS); gr.addColorStop(0, P.liq[1]); gr.addColorStop(1, P.liq[0]); c.fillStyle = gr; c.fillRect(lx, ly, TS, HUD + L.R * TS - ly); c.fillStyle = 'rgba(255,240,180,.35)'; c.fillRect(lx + ((t * 20 + q * 5) % 14), ly, 3, 1); }
      }
    }
  }

  // ---------- кадр ----------
  var buf = null;
  function getBuf() { if (!buf && typeof document !== 'undefined') { buf = document.createElement('canvas'); buf.width = W / 2; buf.height = H / 2; } return buf; }
  function world(c, S, ui, t, retro) {
    var L = D.logic, lv = S.lv, P = PAL[lv.key], camX = S.cam.x, ox = -camX * TS;
    var sx = 0, sy = 0; if (ui.shake > 0) { sx = (Math.random() - 0.5) * ui.shake * 6; sy = (Math.random() - 0.5) * ui.shake * 6; }
    c.save(); c.translate(Math.round(sx), Math.round(sy));
    background(c, P, lv.key, camX, t, retro, W, H);
    tiles(c, lv, P, camX, t, retro);
    function X(x) { return ox + x * TS; } function Y(y) { return HUD + y * TS; }
    // отметка-наковальня
    lv.cps.forEach(function (cp, k) { var px = X(cp.x), py = Y(cp.y); if (px < -20 || px > W + 20) return; box(c, retro ? '#606060' : '#5a5c60', px - 6, py - 6, 12, 6); box(c, retro ? '#808080' : '#7a7e84', px - 8, py - 9, 16, 3); box(c, k <= S.cp ? (retro ? '#ffd800' : '#ffd24a') : (retro ? '#404040' : '#3a3c40'), px - 2, py - 14, 4, 5); });
    // предупреждение о бульке
    S.warn.forEach(function (w) { var px = X(w.x); for (var i = 0; i < 3; i++) { c.fillStyle = retro ? '#ffd800' : 'rgba(255,220,140,.8)'; c.beginPath(); c.arc(px - 5 + i * 5, Y(L.R - 0.4) - ((t * 12 + i * 3) % 6), 1.6, 0, Math.PI * 2); c.fill(); } });
    // плоты и подъёмники
    var Wd = L.world(lv, S.t, 0);
    Wd.pp.forEach(function (p) { var px = Math.round(X(p.x)), py = Math.round(Y(p.y)); box(c, retro ? '#808080' : '#7a7e84', px, py, p.w * TS, 5); box(c, retro ? '#d87830' : '#c8793a', px, py + 5, p.w * TS, 3); for (var i = 0; i < p.w * 2; i++) box(c, retro ? '#404040' : '#4a4e54', px + 3 + i * 8, py + 1, 2, 2); box(c, retro ? '#404040' : '#3a3c40', px + p.w * TS / 2 - 1, py + 8, 2, 4); });
    // сундуки
    S.chests.forEach(function (ch) { var px = X(ch.x); if (px > -20 && px < W + 20) chestFig(c, ch, px, Y(ch.y), t, retro); });
    // огонь факела
    S.flames.forEach(function (fl) { var px = X(fl.x), py = Y(fl.y); for (var i = 0; i < 3; i++) { var hh = 8 + Math.sin(t * 20 + i * 2 + fl.x) * 3; c.fillStyle = i === 1 ? (retro ? '#ffff00' : '#ffe070') : (retro ? '#ff8800' : '#ff7a1a'); c.fillRect(px - 6 + i * 4, py - hh, 4, hh); } });
    // предметы
    S.items.forEach(function (it) { itemFig(c, it, X(it.x), Y(it.y), t, retro); });
    // враги
    S.enemies.forEach(function (e) { var px = X(e.x); if (px > -30 && px < W + 30) foeFig(c, e, px, Y(e.y), t, retro, lv.liquid); });
    // страж
    if (S.boss && !S.boss.dead) bossFig(c, S.boss, X(S.boss.x), Y(S.boss.y), t, retro, S.loop);
    // тени (modern)
    if (!retro) { c.fillStyle = 'rgba(0,0,0,.28)'; S.enemies.forEach(function (e) { if (!FOEFLY[e.type]) { c.beginPath(); c.ellipse(X(e.x), Y(e.y), e.hw * TS + 2, 2.5, 0, 0, Math.PI * 2); c.fill(); } }); if (S.hero && S.hero.ground) { c.beginPath(); c.ellipse(X(S.hero.x), Y(S.hero.y), 8, 2.5, 0, 0, Math.PI * 2); c.fill(); } }
    // герой
    var h = S.hero;
    if (h && S.phase !== 'dead' && !(h.inv > 0 && h.hurtT <= 0 && Math.floor(t * 20) % 2)) heroFig(c, X(h.x), Y(h.y), h.face, { armor: h.armor, run: h.vx && h.ground ? h.runT : 0, air: !h.ground && !h.climb, crouch: h.crouch, climb: h.climb, throwT: h.throwT, charge: h.charge, t: t }, retro);
    if (S.ring) for (var q = 0; q < 4; q++) { var ra = S.ring.a + q * Math.PI / 2; weaponFig(c, 'shield', X(h.x + Math.cos(ra) * 1.6), Y(h.y - 1 + Math.sin(ra) * 1.6), 1, 0, retro); }
    // броски
    S.shots.forEach(function (s) {
      var rot = s.k === 'axe' || s.k === 'hammer' ? t * 18 : s.k === 'shield' ? 0 : Math.atan2(s.vy, s.vx);
      weaponFig(c, s.k, X(s.x), Y(s.y), s.sp ? 1.3 : 1, rot, retro);
    });
    // вражеские снаряды
    S.eshots.forEach(function (s) {
      var px = X(s.x), py = Y(s.y);
      if (s.kind === 'rust') { c.fillStyle = S.loop === 2 ? (retro ? '#00ff80' : '#4affa0') : (retro ? '#ff4000' : '#ff6a3a'); c.beginPath(); c.arc(px, py, 4, 0, Math.PI * 2); c.fill(); box(c, '#fff', px - 1, py - 1, 2, 2); }
      else if (s.kind === 'bubble') { c.strokeStyle = retro ? '#c0e0ff' : 'rgba(200,230,255,.9)'; c.lineWidth = 1.5; c.beginPath(); c.arc(px, py, 5, 0, Math.PI * 2); c.stroke(); }
      else if (s.kind === 'bolt') { box(c, retro ? '#c0c0c0' : '#c8d0d8', px - 2, py - 4, 4, 7); box(c, '#606060', px - 3, py - 4, 6, 2); }
      else { c.fillStyle = retro ? '#ff8800' : '#ff8a2a'; c.beginPath(); c.arc(px, py, 5, 0, Math.PI * 2); c.fill(); c.fillStyle = retro ? '#ffff00' : '#ffe070'; c.beginPath(); c.arc(px - 1, py - 1, 2, 0, Math.PI * 2); c.fill(); }
    });
    // частицы
    parts.forEach(function (p) { c.globalAlpha = Math.max(0, p.life / p.max); c.fillStyle = p.col; c.fillRect(Math.round(X(p.x)) - 1, Math.round(Y(p.y)) - 1, 3, 3); });
    c.globalAlpha = 1;
    // тосты
    ui.toasts.forEach(function (q) { c.globalAlpha = Math.min(1, q.t * 2); c.fillStyle = q.color; c.font = '800 ' + (q.big ? 12 : 10) + 'px ' + (retro ? '"Courier New",monospace' : 'Inter,system-ui,sans-serif'); c.textAlign = 'center'; c.fillText(q.text, X(q.x), Y(q.y)); });
    c.globalAlpha = 1;
    c.restore();
  }
  function fmtT(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  R.fmtT = fmtT;
  function hud(g, c, S, retro) {
    var th = g.th(), font = retro ? '"Courier New",monospace' : 'Inter,system-ui,sans-serif', h = S.hero;
    box(c, retro ? '#000000' : 'rgba(14,10,12,.92)', 0, 0, W, HUD);
    box(c, retro ? '#884400' : 'rgba(200,121,58,.5)', 0, HUD - 1, W, 1);
    function txt(s, x, y, col, sz, al, wt) { c.fillStyle = col; c.font = (wt || 800) + ' ' + (sz || 11) + 'px ' + font; c.textAlign = al || 'left'; c.fillText(s, x, y); }
    // доспех
    var K = HERO[retro ? 'r' : 'm'], arm = h ? h.armor : 1;
    c.save(); c.translate(14, 30); c.scale(0.72, 0.72); heroFig(c, 0, 0, 1, { armor: arm, t: g.time }, retro); c.restore();
    txt(arm === 2 ? g.t('armGold') : arm === 1 ? g.t('armOn') : g.t('armOff'), 28, 13, arm === 2 ? K.gold : arm === 1 ? K.metalL : th.bad, 10);
    // оружие
    box(c, retro ? '#202020' : 'rgba(255,255,255,.08)', 28, 17, 22, 12); weaponFig(c, S.weapon, 39, 23, 1, 0, retro);
    txt(g.t('w_' + S.weapon), 54, 27, th.muted, 9, 'left', 700);
    // счёт и рекорд
    txt(g.t('score') + ' ' + S.score, 200, 13, th.ink, 11, 'center');
    txt(g.t('best') + ' ' + Math.max(g.state.best || 0, S.score), 200, 27, th.muted, 9, 'center', 700);
    // уровень, круг
    txt(g.t('lv_' + S.lv.key), 330, 13, th.accent, 10, 'center');
    txt((S.loop === 2 ? g.t('loop2') : g.t('loop1')) + ' · ' + (S.li + 1) + '/7', 330, 27, S.loop === 2 ? th.warn : th.muted, 9, 'center', 700);
    // таймер, жизни
    var low = S.timer < 30;
    txt(fmtT(S.timer), 440, 14, low ? (Math.floor(g.time * 4) % 2 ? th.bad : th.warn) : th.ink, 13, 'center', 900);
    txt(g.t('lives') + ' ' + S.lives + '  ' + g.t('cont') + ' ' + S.conts, 440, 27, th.muted, 9, 'center', 700);
    // полоса стража
    var b = S.boss;
    if (b && !b.dead && S.bossState !== 'none') {
      var bw = 140, bx = W / 2 - bw / 2, by = HUD + 6;
      box(c, retro ? '#000000' : 'rgba(0,0,0,.6)', bx - 2, by - 2, bw + 4, 12);
      box(c, retro ? '#d82800' : '#e0503a', bx, by, bw * Math.max(0, b.hp) / b.max, 8);
      txt(g.t('b_' + S.lv.key), W / 2, by + 20, th.ink, 10, 'center');
      if (b.key === 'koshey' && S.loop === 2 && S.weapon !== 'hammer') txt(g.t('needHammer'), W / 2, by + 32, th.warn, 10, 'center');
    }
  }

  D.render = function (g, ctx, S, ui) {
    var retro = g.themeName === 'retro', t = g.time, th = g.th();
    ctx.imageSmoothingEnabled = !retro;
    if (!S || !S.lv) { g.clear(); return; }
    if (retro && getBuf()) {
      var b = getBuf().getContext('2d'); b.imageSmoothingEnabled = false;
      b.save(); b.clearRect(0, 0, W / 2, H / 2); b.scale(0.5, 0.5); world(b, S, ui, t, true); b.restore();
      ctx.drawImage(getBuf(), 0, 0, W / 2, H / 2, 0, 0, W, H);
    } else world(ctx, S, ui, t, retro);
    hud(g, ctx, S, retro);
    var font = retro ? '"Courier New",monospace' : 'Inter,system-ui,sans-serif';
    function txt(s, x, y, col, sz, wt) { ctx.fillStyle = col; ctx.font = (wt || 900) + ' ' + sz + 'px ' + font; ctx.textAlign = 'center'; ctx.fillText(s, x, y); }
    function veil(a) { ctx.fillStyle = retro ? 'rgba(0,0,0,' + a + ')' : 'rgba(12,8,10,' + a + ')'; ctx.fillRect(0, HUD, W, H - HUD); }
    if (ui.banner && ui.banner.a > 0) {
      ctx.globalAlpha = Math.min(1, ui.banner.a * 2);
      veil(0.45); txt(ui.banner.title, W / 2, H / 2 - 4, th.accent, 24); if (ui.banner.sub) txt(ui.banner.sub, W / 2, H / 2 + 18, th.ink, 12, 700);
      ctx.globalAlpha = 1;
    }
    if (ui.msg && ui.msg.a > 0) { ctx.globalAlpha = Math.min(1, ui.msg.a * 2); txt(ui.msg.text, W / 2, HUD + 40, ui.msg.color, 14); ctx.globalAlpha = 1; }
    if (S.phase === 'cont') {
      veil(0.7); txt(g.t('contQ'), W / 2, H / 2 - 10, th.warn, 22);
      txt(String(Math.max(0, Math.ceil(ui.contT || 0))), W / 2, H / 2 + 22, th.ink, 26);
      txt(g.t('contHint') + ' (' + S.conts + ')', W / 2, H / 2 + 46, th.muted, 11, 700);
    }
    if (S.phase === 'loopEnd') {
      veil(0.82); var lines = g.t('loopEndText').split('\n');
      txt(g.t('loopEnd'), W / 2, HUD + 48, th.accent, 20);
      lines.forEach(function (l, i) { txt(l, W / 2, HUD + 80 + i * 18, th.ink, 11, 600); });
      if (S.phaseT > 1) txt(g.t('tapGo'), W / 2, H - 22, th.muted, 10, 700);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
