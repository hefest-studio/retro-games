/* ЧЕРТОГ · рендер обеих тем. modern — полное разрешение 640×360 + HUD, свет факелов, мягкие тени;
   retro — сцена рисуется в буфер 320×180 и растягивается «пикселями» (16-цветная палитра, без сглаживания).
   Герой и стражи — скелетные фигуры: позы-ключи плавно смешиваются по фазе состояния («ротоскоп»-плавность).
   CHERTOG.render(g, ctx, S, o) — кадр игры; CHERTOG.R — примитивы для титула и финалов. */
(function (global) {
  'use strict';
  var C = global.CHERTOG = global.CHERTOG || {}, L = C.logic, K = L.K, RW = L.RW, RH = L.RH;
  var TW = 64, TH = 120, VH = 360, HUD = 40, FY = 10, PI = Math.PI;
  var PM = { // modern
    bg0: '#16131c', bg1: '#0c0a10', brick: '#2a2431', brick2: '#231e29', mortar: '#120f16', stone: '#4a4252', stone2: '#3a3341', stoneHi: '#6b6175', stoneLo: '#221d27',
    floorTop: '#9b8f9c', floorFace: '#5d5463', floorLo: '#2f2934', lip: '#c9bcc4', torch: '#ffb347', glow: 'rgba(255,170,80,', copper: '#d98a4e', copperHi: '#ffd2a0', copperLo: '#7a4320',
    iron: '#4d5560', ironHi: '#8a95a3', spike: '#d6dbe3', blade: '#e7ecf3', ink: '#f3ede4', muted: '#a69cae', accent: '#ffb347', good: '#7bd389', bad: '#ff5d5d', hudBg: '#0e0b12', hudLine: '#3a3042',
    pixel: false
  };
  var PR = { // retro (EGA-подобная палитра)
    bg0: '#000044', bg1: '#000022', brick: '#0000aa', brick2: '#000088', mortar: '#000000', stone: '#555555', stone2: '#444444', stoneHi: '#aaaaaa', stoneLo: '#222222',
    floorTop: '#aaaaaa', floorFace: '#555555', floorLo: '#222222', lip: '#ffffff', torch: '#ffff55', glow: null, copper: '#aa5500', copperHi: '#ffff55', copperLo: '#552200',
    iron: '#555555', ironHi: '#aaaaaa', spike: '#ffffff', blade: '#ffffff', ink: '#ffffff', muted: '#aaaaaa', accent: '#ffff55', good: '#55ff55', bad: '#ff5555', hudBg: '#000000', hudLine: '#5555ff',
    pixel: true
  };
  // облик персонажей: кожа, рубаха, штаны, обувь, пояс, головной убор, клинок
  var LOOK = {
    hero: { m: { skin: '#e8b48a', shirt: '#e07a2f', shirt2: '#b45a1c', pants: '#3b3346', boot: '#2a1f1a', belt: '#7a5232', hair: '#3a2418', band: '#d9482b', blade: '#dfe4ec' },
            r: { skin: '#ffaa55', shirt: '#ffffff', shirt2: '#aaaaaa', pants: '#5555ff', boot: '#aa5500', belt: '#aa5500', hair: '#aa5500', band: '#ff5555', blade: '#ffffff' } },
    g: { m: { skin: '#d9a47c', shirt: '#2f6f7a', shirt2: '#1f4c55', pants: '#262a35', boot: '#1d1a1a', belt: '#b8863b', helm: '#b8863b', blade: '#cfd5de' },
         r: { skin: '#ffaa55', shirt: '#00aaaa', shirt2: '#005555', pants: '#0000aa', boot: '#000000', belt: '#aa5500', helm: '#aa5500', blade: '#aaaaaa' } },
    f: { m: { skin: '#e0ab83', shirt: '#b23a48', shirt2: '#7d2231', pants: '#2b2433', boot: '#1d1a1a', belt: '#e7c46a', cap: '#3a1c2a', plume: '#f2e3c6', blade: '#e9edf3' },
         r: { skin: '#ffaa55', shirt: '#aa0000', shirt2: '#550000', pants: '#555555', boot: '#000000', belt: '#ffff55', cap: '#aa00aa', plume: '#ffffff', blade: '#ffffff' } },
    w: { m: { skin: '#c99772', shirt: '#3f6b3a', shirt2: '#2a4a27', pants: '#2c2a24', boot: '#1d1a1a', belt: '#8b6a3a', helm: '#8f9aa6', shield: '#b07a3a', blade: '#cfd5de' },
         r: { skin: '#ffaa55', shirt: '#00aa00', shirt2: '#005500', pants: '#555555', boot: '#000000', belt: '#aa5500', helm: '#aaaaaa', shield: '#aa5500', blade: '#aaaaaa' } },
    m: { m: { skin: '#c07a3a', shirt: '#b8702f', shirt2: '#7a4320', pants: '#8a5226', boot: '#4a2a14', belt: '#ffd28a', eye: '#6ff2ff', blade: '#e9edf3', metal: true },
         r: { skin: '#aa5500', shirt: '#aa5500', shirt2: '#552200', pants: '#aa5500', boot: '#552200', belt: '#ffff55', eye: '#55ffff', blade: '#ffffff', metal: true } },
    N: { m: { skin: '#d4a47e', shirt: '#4a2140', shirt2: '#2c1226', pants: '#2c1226', boot: '#140a12', belt: '#e0a24a', crown: '#e0a24a', cape: '#6b1f3a', blade: '#f0d9a8' },
         r: { skin: '#ffaa55', shirt: '#aa00aa', shirt2: '#550055', pants: '#550055', boot: '#000000', belt: '#ffff55', crown: '#ffff55', cape: '#aa0000', blade: '#ffff55' } },
    Z: { m: { skin: '#e09a5c', shirt: '#d58a4e', shirt2: '#9a5a2c', pants: '#8a5226', boot: '#5a3216', belt: '#ffd28a', hair: '#9a5a2c', band: '#ffd28a', eye: '#bff7ff', blade: '#ffe2b8', metal: true },
         r: { skin: '#ffff55', shirt: '#aa5500', shirt2: '#552200', pants: '#aa5500', boot: '#552200', belt: '#ffff55', hair: '#552200', band: '#ffff55', eye: '#55ffff', blade: '#ffff55', metal: true } },
    master: { m: { skin: '#e2b896', shirt: '#3e5a8a', shirt2: '#2a3e63', pants: '#2a3e63', boot: '#2a1f1a', belt: '#c9a25a', hair: '#e8e4dc', beard: '#f1ede6', blade: '#ccc' },
              r: { skin: '#ffaa55', shirt: '#5555ff', shirt2: '#0000aa', pants: '#0000aa', boot: '#aa5500', belt: '#ffff55', hair: '#ffffff', beard: '#ffffff', blade: '#aaa' } }
  };
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  var ease = L.ease;

  // ---------- позы ----------
  // hy — высота таза над опорной точкой, hx — смещение таза вперёд, tor — наклон корпуса, hd — наклон головы,
  // a/b — ноги [бедро, сгиб колена], ua/ub — руки [плечо, сгиб локтя]; sw — угол клинка к предплечью (null — в ножнах)
  function P(hy, hx, tor, a0, a1, b0, b1, ua0, ua1, ub0, ub1, sw) { return { hy: hy, hx: hx, tor: tor, hd: 0, a: [a0, a1], b: [b0, b1], ua: [ua0, ua1], ub: [ub0, ub1], sw: sw == null ? null : sw }; }
  var POSE = {
    stand: P(35, 0, 0.04, 0.06, 0.04, -0.07, 0.05, 0.1, 0.25, -0.12, 0.2),
    crouch: P(21, -2, 0.55, 1.3, 2.2, 0.95, 2.1, 0.7, 0.5, 0.45, 0.6),
    prep: P(27, -1, 0.35, 0.75, 1.3, 0.4, 1.1, -0.5, 0.5, -0.7, 0.4),
    rise: P(36, 2, 0.22, 0.95, 1.35, -0.45, 0.55, 2.3, 0.3, 1.5, 0.5),
    fall: P(36, 0, 0.06, 0.35, 0.55, -0.1, 0.35, 2.75, 0.15, 2.45, 0.3),
    leap: P(35, 3, 0.28, 1.15, 0.45, -0.95, 1.05, 1.9, 0.2, -0.85, 0.5),
    hang: P(48, -2, -0.04, 0.08, 0.12, -0.06, 0.2, 3.08, 0.02, 3.02, 0.06),
    pull: P(62, -1, 0.1, 0.7, 1.4, 0.3, 1.1, 2.1, -1.9, 2.0, -1.8),
    kneel: P(24, 3, 0.45, 1.2, 2.2, 0.2, 1.9, 0.8, 0.3, 0.6, 0.4),
    land: P(26, 0, 0.35, 0.9, 1.6, 0.6, 1.4, 0.5, 0.4, 0.2, 0.5),
    hard: P(18, -1, 0.75, 1.4, 2.4, 1.1, 2.3, 1.2, 0.1, 0.5, 0.5),
    skid: P(32, -3, -0.18, 0.55, 0.15, -0.25, 0.55, 0.6, 0.4, -0.5, 0.6),
    bump: P(33, -4, -0.25, 0.25, 0.3, -0.2, 0.35, 0.9, 0.8, 0.6, 0.9),
    drink: P(22, 1, 0.3, 1.25, 2.2, 0.9, 2.1, 2.4, 1.9, 0.4, 0.5),
    en: P(31, 0, 0.1, 0.45, 0.35, -0.42, 0.18, 1.0, 0.45, -0.6, 1.7, 0.25),
    wind: P(31, -3, -0.06, 0.4, 0.35, -0.45, 0.2, 0.5, 1.5, -0.9, 1.5, 0.1),
    thrust: P(28, 11, 0.38, 1.05, 0.65, -0.8, 0.02, 1.55, 0.0, -1.1, 0.4, 0.0),
    parry: P(32, -2, -0.08, 0.35, 0.3, -0.4, 0.2, 0.6, 1.75, -0.5, 1.4, 0.15),
    hit: P(32, -5, -0.36, 0.2, 0.3, -0.3, 0.4, 0.9, 0.9, -1.3, 1.0, 0.3),
    dead: P(6, 0, 1.52, 1.5, 0.1, 1.4, 0.3, 1.2, 0.2, 2.2, 0.2),
    cheer: P(35, 0, -0.04, 0.08, 0.04, -0.08, 0.05, 2.7, 0.4, 2.6, 0.4)
  };
  function mix(p, q, u) {
    u = Math.max(0, Math.min(1, u));
    var o = { hy: lerp(p.hy, q.hy, u), hx: lerp(p.hx, q.hx, u), tor: lerp(p.tor, q.tor, u), hd: lerp(p.hd || 0, q.hd || 0, u),
      a: [lerp(p.a[0], q.a[0], u), lerp(p.a[1], q.a[1], u)], b: [lerp(p.b[0], q.b[0], u), lerp(p.b[1], q.b[1], u)],
      ua: [lerp(p.ua[0], q.ua[0], u), lerp(p.ua[1], q.ua[1], u)], ub: [lerp(p.ub[0], q.ub[0], u), lerp(p.ub[1], q.ub[1], u)], sw: null };
    if (p.sw != null || q.sw != null) o.sw = lerp(p.sw == null ? 0 : p.sw, q.sw == null ? 0 : q.sw, u);
    o.swOn = (u < 0.5 ? p.sw : q.sw) != null;
    return o;
  }
  function gait(q, amp, knee, lean, hy, arm) { // q — фаза шага (рад)
    var sa = Math.sin(q), sb = Math.sin(q + PI);
    var p = P(hy - Math.abs(Math.cos(q)) * 2.2, 1, lean,
      amp * sa, 0.2 + knee * Math.max(0, Math.cos(q)) + 0.12 * Math.max(0, -sa),
      amp * sb, 0.2 + knee * Math.max(0, Math.cos(q + PI)) + 0.12 * Math.max(0, -sb),
      -arm * sa + 0.15, 0.55 + 0.35 * Math.max(0, -sa), -arm * sb + 0.15, 0.55 + 0.35 * Math.max(0, -sb));
    return p;
  }
  // поза героя (и двойника) по состоянию → { p, dx, dy (смещение опорной точки, клетки), sx (сжатие по x — разворот) }
  function heroPose(H, S) {
    var t = H.t, st = H.st, o = { p: POSE.stand, dx: 0, dy: 0, sx: 1 }, u, hg = H.hang;
    switch (st) {
      case 'stand': o.p = mix(POSE.stand, POSE.stand, 0); o.p.tor += Math.sin((S ? S.clock : 0) * 1.7) * 0.015; o.p.hy += Math.sin((S ? S.clock : 0) * 1.7) * 0.4; break;
      case 'crouch': o.p = mix(POSE.stand, POSE.crouch, t / 0.15); break;
      case 'turn': u = t / K.TURN_T; o.sx = Math.cos(u * PI); o.p = mix(POSE.stand, POSE.skid, Math.sin(u * PI) * 0.5); break;
      case 'run': o.p = gait(H.x * H.face * 2 * PI / 1.45, 0.78, 1.45, 0.22 + 0.06 * Math.min(1, H.v / K.RUN), 34, 0.85); break;
      case 'stop': o.p = mix(gait(H.x * H.face * 2 * PI / 1.45, 0.7, 1.3, 0.2, 34, 0.8), POSE.skid, Math.min(1, t / 0.12)); break;
      case 'step': u = t / H.dur; o.p = gait(PI * 0.5 + ease(u) * PI + (Math.round(H.x0 * 2) % 2) * PI, 0.42, 0.75, 0.06, 35, 0.3); o.p.ua[0] += 0.2; o.p.ub[0] += 0.15; break;
      case 'bump': o.p = mix(POSE.bump, POSE.stand, t / K.BUMP_T); break;
      case 'sjump': o.p = mix(POSE.stand, POSE.prep, t / K.SJ_PREP); break;
      case 'rjump': o.p = mix(gait(H.x * H.face * 2 * PI / 1.45, 0.78, 1.45, 0.25, 34, 0.85), POSE.leap, t / K.RJ_PREP); break;
      case 'jumpup':
        if (hg && t > K.JU_PREP) {
          u = (t - K.JU_PREP) / K.JU_GRAB; o.p = mix(POSE.prep, POSE.hang, ease(u));
          var hx = hg.ex + hg.side * K.HANG_OFF; o.dx = (hx - H.x) * ease(u); o.dy = K.HANG * Math.sin(u * PI / 2) - K.HANG * 0 + (-0.0); o.dy = -(1 - K.HANG) * ease(u) + 0; // руки тянутся к уступу
          o.dy = (hg.k + K.HANG - H.y) * ease(u);
        } else o.p = mix(POSE.stand, POSE.prep, t / K.JU_PREP);
        break;
      case 'air':
        if (H.vx && Math.abs(H.vx) > 3.5) o.p = mix(POSE.leap, POSE.fall, Math.max(0, H.vy) / 3);
        else o.p = mix(POSE.rise, POSE.fall, (H.vy + 1.5) / 3.5);
        break;
      case 'hang': o.p = mix(POSE.hang, POSE.hang, 0); o.p.a[0] += Math.sin(t * 3) * 0.06; o.p.b[0] -= Math.sin(t * 3) * 0.06; break;
      case 'climb': case 'cdown': {
        u = st === 'climb' ? t / K.CLIMB_T : 1 - t / K.CDOWN_T; u = Math.max(0, Math.min(1, u));
        var X0 = hg.ex + hg.side * K.HANG_OFF, Y0 = hg.k + K.HANG, X1 = st === 'climb' ? hg.ex - hg.side * K.LEDGE_IN : H.x0, Y1 = hg.k;
        if (u < 0.4) o.p = mix(POSE.hang, POSE.pull, u / 0.4); else if (u < 0.7) o.p = mix(POSE.pull, POSE.kneel, (u - 0.4) / 0.3); else o.p = mix(POSE.kneel, POSE.stand, (u - 0.7) / 0.3);
        var bx = lerp(X0, X1, ease((u - 0.3) / 0.7)), by = lerp(Y0, Y1, ease(u / 0.62));
        o.dx = bx - H.x; o.dy = by - H.y;
        break;
      }
      case 'land': o.p = mix(POSE.land, POSE.stand, t / K.LAND_T); break;
      case 'hardland': o.p = mix(POSE.hard, POSE.stand, Math.max(0, (t - 0.35) / 0.35)); break;
      case 'drink': u = t / K.DRINK_T; o.p = u < 0.25 ? mix(POSE.stand, POSE.crouch, u / 0.25) : u < 0.75 ? mix(POSE.crouch, POSE.drink, (u - 0.25) / 0.2) : mix(POSE.drink, POSE.stand, (u - 0.75) / 0.25); break;
      case 'enter': u = t / K.ENTER_T; o.p = gait(u * PI * 2.4, 0.35, 0.6, 0.05, 35, 0.25); o.fade = 1 - u; o.dz = u; break;
      case 'free': o.p = mix(POSE.stand, POSE.cheer, t / 0.5); break;
      case 'dead': o.p = mix(POSE.hit, POSE.dead, ease(t / 0.6)); break;
      default: fencePose(H, o);
    }
    return o;
  }
  function fencePose(F, o, wind) {
    var t = F.t; wind = wind || K.LUNGE_W;
    switch (F.st) {
      case 'en': o.p = mix(POSE.en, POSE.en, 0); o.p.hy += Math.sin(t * 5) * 0.6; o.p.ua[0] += Math.sin(t * 3.3) * 0.05; break;
      case 'adv': case 'ret': { var u = t / K.ADV_T, q = Math.sin(u * PI); o.p = mix(POSE.en, POSE.en, 0); o.p.a[0] += (F.st === 'adv' ? 0.3 : -0.2) * q; o.p.b[0] -= 0.25 * q; o.p.hy -= q * 2; break; }
      case 'lunge':
        if (t < wind) o.p = mix(POSE.en, POSE.wind, ease(t / wind));
        else if (t < wind + 0.08) o.p = mix(POSE.wind, POSE.thrust, (t - wind) / 0.08);
        else o.p = mix(POSE.thrust, POSE.en, (t - wind - 0.08) / (K.LUNGE_R - 0.08));
        break;
      case 'parry': o.p = t < 0.08 ? mix(POSE.en, POSE.parry, t / 0.08) : t > K.PARRY_T - 0.1 ? mix(POSE.parry, POSE.en, (t - K.PARRY_T + 0.1) / 0.1) : POSE.parry; break;
      case 'recoil': o.p = mix(POSE.hit, POSE.en, t / K.RECOIL_T); o.p.tor *= 0.5; break;
      case 'hit': o.p = mix(POSE.hit, POSE.en, Math.max(0, (t - 0.12) / (K.HIT_T - 0.12))); break;
      case 'dead': o.p = mix(POSE.hit, POSE.dead, ease(t / 0.6)); break;
      default: o.p = POSE.en;
    }
  }
  function guardPose(g, S) {
    var o = { p: POSE.stand, dx: 0, dy: 0, sx: 1 };
    if (g.st === 'stand') { o.p = mix(POSE.stand, POSE.en, 0.35); o.p.sw = 0.9; o.p.hy += Math.sin(S.clock * 1.5 + g.id) * 0.4; return o; }
    fencePose(g, o, L.STYLE[g.k].wind);
    return o;
  }

  // ---------- фигура ----------
  var LEN = { th: 17, sh: 18, ft: 6, tor: 23, ua: 13, fa: 12, head: 6.5 };
  function seg(o, ang, len, f) { return { x: o.x + Math.sin(ang) * len * f, y: o.y + Math.cos(ang) * len }; }
  // ctx, (x, y) — опорная точка в px, f — взгляд (±1), s — масштаб, look — цвета, kind — тип
  function figure(ctx, x, y, f, pose, look, s, kind, extra) {
    extra = extra || {};
    var p = pose.p, sx = pose.sx == null ? 1 : pose.sx, ff = f * (sx < 0 ? -1 : 1);
    ctx.save(); ctx.translate(x, y); ctx.scale(Math.max(0.12, Math.abs(sx)) * s, s);
    if (pose.fade != null) ctx.globalAlpha = Math.max(0, pose.fade);
    if (kind === 'dead') { /* лежит — поза уже горизонтальная */ }
    var hip = { x: p.hx * ff, y: -p.hy }, neck = { x: hip.x + Math.sin(p.tor) * LEN.tor * ff, y: hip.y - Math.cos(p.tor) * LEN.tor };
    var head = { x: neck.x + Math.sin(p.tor + p.hd) * (LEN.head + 2.5) * ff, y: neck.y - Math.cos(p.tor + p.hd) * (LEN.head + 2.5) };
    function leg(L2, near) {
      var knee = seg(hip, L2[0], LEN.th, ff), shinA = L2[0] - L2[1], foot = seg(knee, shinA, LEN.sh, ff);
      var toe = { x: foot.x + LEN.ft * ff * Math.cos(shinA * 0.3), y: foot.y + Math.sin(Math.max(0, shinA)) * 1.5 };
      return { knee: knee, foot: foot, toe: toe };
    }
    function arm(A, near) {
      var sh = { x: neck.x - Math.sin(p.tor) * 2 * ff, y: neck.y + 2 }, el = seg(sh, A[0], LEN.ua, ff), fa = A[0] + A[1], hand = seg(el, fa, LEN.fa, ff);
      return { sh: sh, el: el, hand: hand, fa: fa };
    }
    var LA = leg(p.a), LB = leg(p.b), AA = arm(p.ua), AB = arm(p.ub);
    var retro = !!extra.retro, lw = function (w) { ctx.lineWidth = w; };
    ctx.lineCap = retro ? 'square' : 'round'; ctx.lineJoin = 'round';
    function limb(a, b, c, col, w1, w2) { ctx.strokeStyle = col; lw(w1); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); lw(w2 || w1); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke(); }
    var dark = function (col) { return extra.shade ? col : col; };
    // задние конечности (темнее)
    limb(AB.sh, AB.el, AB.hand, look.shirt2, 5, 4);
    if (kind === 'w' && look.shield) { ctx.fillStyle = look.shield; ctx.beginPath(); ctx.arc(AB.hand.x, AB.hand.y, 8, 0, PI * 2); ctx.fill(); ctx.fillStyle = retro ? '#ffff55' : '#ffd88a'; ctx.beginPath(); ctx.arc(AB.hand.x, AB.hand.y, 2.2, 0, PI * 2); ctx.fill(); }
    limb(hip, LB.knee, LB.foot, retro ? look.pants : shade(look.pants, -18), 7, 6);
    ctx.strokeStyle = look.boot; lw(5); ctx.beginPath(); ctx.moveTo(LB.foot.x, LB.foot.y); ctx.lineTo(LB.toe.x, LB.toe.y); ctx.stroke();
    // плащ Наместника
    if (look.cape) { ctx.fillStyle = look.cape; ctx.beginPath(); ctx.moveTo(neck.x - 3 * ff, neck.y); ctx.quadraticCurveTo(neck.x - 14 * ff, hip.y + 4, hip.x - 16 * ff, -2); ctx.lineTo(hip.x - 2 * ff, -4); ctx.closePath(); ctx.fill(); }
    // корпус
    ctx.strokeStyle = look.shirt; lw(kind === 'N' ? 13 : 11); ctx.beginPath(); ctx.moveTo(hip.x, hip.y); ctx.lineTo(neck.x, neck.y + 2); ctx.stroke();
    if (kind === 'N') { ctx.fillStyle = look.shirt; ctx.beginPath(); ctx.moveTo(hip.x - 8, hip.y - 2); ctx.lineTo(hip.x + 8, hip.y - 2); ctx.lineTo(hip.x + 11 * ff + 2, -6); ctx.lineTo(hip.x - 9 * ff - 2, -6); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = look.belt; lw(3); var bx = hip.x + Math.sin(p.tor) * 3 * ff, by = hip.y - Math.cos(p.tor) * 3; ctx.beginPath(); ctx.moveTo(bx - 5, by + 0.5); ctx.lineTo(bx + 5, by - 0.5); ctx.stroke();
    if (look.metal && !retro) { ctx.fillStyle = look.belt; [0.35, 0.7].forEach(function (k) { ctx.beginPath(); ctx.arc(lerp(hip.x, neck.x, k) + 3 * ff, lerp(hip.y, neck.y, k), 1.3, 0, PI * 2); ctx.fill(); }); }
    // передняя нога
    limb(hip, LA.knee, LA.foot, look.pants, 7, 6);
    ctx.strokeStyle = look.boot; lw(5); ctx.beginPath(); ctx.moveTo(LA.foot.x, LA.foot.y); ctx.lineTo(LA.toe.x, LA.toe.y); ctx.stroke();
    // голова
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(head.x, head.y, LEN.head, 0, PI * 2); ctx.fill();
    if (look.beard) { ctx.fillStyle = look.beard; ctx.beginPath(); ctx.moveTo(head.x + 1 * ff, head.y + 2); ctx.lineTo(head.x + 6 * ff, head.y + 3); ctx.lineTo(head.x + 1 * ff, head.y + 13); ctx.closePath(); ctx.fill(); }
    if (look.hair) { ctx.fillStyle = look.hair; ctx.beginPath(); ctx.arc(head.x - 1 * ff, head.y - 1.5, LEN.head + 0.6, PI * 1.05, PI * 1.95); ctx.fill(); ctx.fillRect(head.x - (ff > 0 ? 7 : -3), head.y - 3, 4, 6); }
    if (look.band) { ctx.strokeStyle = look.band; lw(2); ctx.beginPath(); ctx.moveTo(head.x - 6, head.y - 3); ctx.lineTo(head.x + 6, head.y - 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(head.x - 6 * ff, head.y - 3); ctx.lineTo(head.x - 11 * ff, head.y + 1 + Math.sin((extra.time || 0) * 9) * 1.5); ctx.stroke(); }
    if (look.helm) { ctx.fillStyle = look.helm; ctx.beginPath(); ctx.arc(head.x, head.y - 1, LEN.head + 1.2, PI, PI * 2); ctx.fill(); ctx.fillRect(head.x - 8, head.y - 1.5, 16, 2.5); if (kind === 'g') { ctx.fillRect(head.x - 1, head.y - 13, 2, 6); } }
    if (look.cap) { ctx.fillStyle = look.cap; ctx.beginPath(); ctx.ellipse(head.x, head.y - 4, 9, 3.5, 0, 0, PI * 2); ctx.fill(); ctx.fillRect(head.x - 5, head.y - 9, 10, 5); ctx.strokeStyle = look.plume; lw(2); ctx.beginPath(); ctx.moveTo(head.x - 2 * ff, head.y - 8); ctx.quadraticCurveTo(head.x - 10 * ff, head.y - 16, head.x - 15 * ff, head.y - 9); ctx.stroke(); }
    if (look.crown) { ctx.fillStyle = look.crown; ctx.beginPath(); ctx.moveTo(head.x - 7, head.y - 4); ctx.lineTo(head.x - 6, head.y - 17); ctx.lineTo(head.x - 2, head.y - 11); ctx.lineTo(head.x, head.y - 20); ctx.lineTo(head.x + 2, head.y - 11); ctx.lineTo(head.x + 6, head.y - 17); ctx.lineTo(head.x + 7, head.y - 4); ctx.closePath(); ctx.fill(); }
    if (look.eye) { ctx.fillStyle = look.eye; ctx.fillRect(head.x + 2 * ff - 1.2, head.y - 1.8, 2.6, 2.4); if (!retro) { ctx.globalAlpha *= 0.35; ctx.beginPath(); ctx.arc(head.x + 2.5 * ff, head.y - 0.6, 4.5, 0, PI * 2); ctx.fill(); ctx.globalAlpha /= 0.35; } }
    else { ctx.fillStyle = retro ? '#000' : '#2a1a14'; ctx.fillRect(head.x + 2.6 * ff - 0.8, head.y - 1.6, 1.8, 1.8); }
    // клинок (в руке с мечом — передняя)
    var swOn = p.sw != null && (pose.p.swOn !== false);
    if (swOn && !extra.noSword) {
      var ang = AA.fa + p.sw, hx2 = AA.hand.x, hy2 = AA.hand.y, len = kind === 'N' ? 34 : 30;
      var tip = { x: hx2 + Math.sin(ang) * len * ff, y: hy2 + Math.cos(ang) * len };
      ctx.strokeStyle = look.blade; lw(2.2); ctx.beginPath(); ctx.moveTo(hx2, hy2); ctx.lineTo(tip.x, tip.y); ctx.stroke();
      ctx.strokeStyle = look.belt; lw(2.6); var gx = Math.cos(ang) * 4 * ff, gy = -Math.sin(ang) * 4; ctx.beginPath(); ctx.moveTo(hx2 - gx, hy2 - gy); ctx.lineTo(hx2 + gx, hy2 + gy); ctx.stroke();
      if (extra.flash) { ctx.fillStyle = '#fff'; ctx.globalAlpha *= 0.8; ctx.beginPath(); ctx.arc(tip.x, tip.y, 4, 0, PI * 2); ctx.fill(); ctx.globalAlpha /= 0.8; }
    } else if (!extra.noSword && kind !== 'master') { // ножны на поясе
      ctx.strokeStyle = retro ? look.belt : shade(look.belt, -25); lw(2.5); ctx.beginPath(); ctx.moveTo(bx - 3 * ff, by + 1); ctx.lineTo(bx - 17 * ff, by + 12); ctx.stroke();
    }
    // передняя рука
    limb(AA.sh, AA.el, AA.hand, look.shirt, 5, 4);
    ctx.fillStyle = look.skin; ctx.beginPath(); ctx.arc(AA.hand.x, AA.hand.y, 2.3, 0, PI * 2); ctx.fill();
    ctx.restore();
  }
  function shade(hex, d) {
    var n = parseInt(hex.slice(1), 16), r = Math.max(0, Math.min(255, (n >> 16) + d)), g = Math.max(0, Math.min(255, (n >> 8 & 255) + d)), b = Math.max(0, Math.min(255, (n & 255) + d));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // ---------- статичный слой экрана ----------
  var layerCache = {};
  function mkCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.width = w; c.height = h; return c; }
  function roomLayer(LV, rx, ry, retro, M) {
    var key = LV.idx + ':' + rx + ':' + ry + ':' + (retro ? 'r' : 'm');
    if (layerCache[key]) return layerCache[key];
    var s = retro ? 0.5 : 1, tw = TW * s, th = TH * s, cv = mkCanvas(RW * tw, RH * th), ctx = cv.getContext('2d'), Pp = retro ? PR : PM;
    ctx.imageSmoothingEnabled = !retro;
    var c0 = rx * RW, r0 = ry * RH, W = cv.width, Hh = cv.height, fy = FY * s;
    // задняя стена: кирпич
    if (retro) { ctx.fillStyle = Pp.bg1; ctx.fillRect(0, 0, W, Hh); }
    else { var gr = ctx.createLinearGradient(0, 0, 0, Hh); gr.addColorStop(0, Pp.bg0); gr.addColorStop(1, Pp.bg1); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, Hh); }
    var bh = 15 * s, bw = 32 * s;
    for (var yy = 0, row = 0; yy < Hh; yy += bh, row++) {
      for (var xx = -((row % 2) * bw / 2); xx < W; xx += bw) {
        var hv = hash(Math.floor((xx + c0 * tw) / bw) + 7, row + r0 * 9);
        if (retro) { ctx.fillStyle = hv < 0.5 ? Pp.brick2 : Pp.bg0; ctx.fillRect(xx + 1, yy + 1, bw - 1, bh - 1); }
        else { ctx.fillStyle = hv < 0.33 ? '#1e1a24' : hv < 0.66 ? '#1b1720' : '#201b26'; ctx.fillRect(xx + 1, yy + 1, bw - 2, bh - 2); ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(xx + 1, yy + 1, bw - 2, 1); }
      }
    }
    var torches = [], pillars = [];
    for (var r = 0; r < RH; r++) for (var c = 0; c < RW; c++) {
      var gc = c0 + c, grr = r0 + r, t = L.tile(M, gc, grr), x = c * tw, y = r * th;
      if (t === '#') {
        if (retro) {
          ctx.fillStyle = Pp.stone; ctx.fillRect(x, y, tw, th);
          ctx.fillStyle = Pp.stoneLo; for (var k = 0; k < 4; k++) { ctx.fillRect(x, y + k * th / 4, tw, 1); ctx.fillRect(x + ((k % 2) ? tw / 2 : 0), y + k * th / 4, 1, th / 4); }
          ctx.fillStyle = Pp.stoneHi; ctx.fillRect(x, y, tw, 1);
        } else {
          for (var kk = 0; kk < 4; kk++) for (var jj = 0; jj < 2; jj++) {
            var bx2 = x + jj * tw / 2 - ((kk % 2) ? tw / 4 : 0), by2 = y + kk * th / 4, ww = tw / 2;
            if (bx2 < x) { ww -= x - bx2; bx2 = x; } if (bx2 + ww > x + tw) ww = x + tw - bx2;
            var hv2 = hash(gc * 4 + jj + 99, grr * 8 + kk);
            var g2 = ctx.createLinearGradient(bx2, by2, bx2, by2 + th / 4); g2.addColorStop(0, hv2 < 0.5 ? '#6e6268' : '#665a63'); g2.addColorStop(1, '#4d434e');
            ctx.fillStyle = g2; ctx.fillRect(bx2 + 1, by2 + 1, ww - 2, th / 4 - 2);
            ctx.fillStyle = 'rgba(255,240,220,0.14)'; ctx.fillRect(bx2 + 1, by2 + 1, ww - 2, 2);
            ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(bx2 + 1, by2 + th / 4 - 4, ww - 2, 3);
          }
        }
        if (!retro) { // тёмный контур со стороны прохода
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          if (L.tile(M, gc - 1, grr) !== '#') ctx.fillRect(x, y, 2, th);
          if (L.tile(M, gc + 1, grr) !== '#') ctx.fillRect(x + tw - 3, y, 3, th);
          if (L.tile(M, gc, grr + 1) !== '#') ctx.fillRect(x, y + th - 3, tw, 3);
        }
        continue;
      }
      // колонны на заднем плане и факелы
      if (L.standable(M, gc, grr)) {
        var hp = hash(gc + 31, grr + 17);
        var up = L.tile(M, gc, grr - 1);
        if (hp < 0.16 && t === '-' && (up === '#' || L.FLOOR_T[up])) pillars.push({ x: x + tw / 2, y: y, r: r });
        else if (hp > 0.86 && t === '-') torches.push({ x: x + tw / 2, y: y + th * 0.42 });
      }
    }
    pillars.forEach(function (pl) {
      var pw = 14 * s, top = pl.y + (L.tile(M, c0 + Math.floor(pl.x / tw), r0 + pl.r - 1) === '#' ? 0 : 2 * s), bot = pl.y + th - fy;
      if (retro) { ctx.fillStyle = Pp.stone2; ctx.fillRect(pl.x - pw / 2, top, pw, bot - top); ctx.fillStyle = Pp.stoneHi; ctx.fillRect(pl.x - pw / 2, top, 2, bot - top); ctx.fillStyle = Pp.stone; ctx.fillRect(pl.x - pw / 2 - 3, top, pw + 6, 4); ctx.fillRect(pl.x - pw / 2 - 3, bot - 5, pw + 6, 5); }
      else {
        var g3 = ctx.createLinearGradient(pl.x - pw / 2, 0, pl.x + pw / 2, 0); g3.addColorStop(0, '#2e2834'); g3.addColorStop(0.35, '#4c4455'); g3.addColorStop(1, '#221d27');
        ctx.fillStyle = g3; ctx.fillRect(pl.x - pw / 2, top, pw, bot - top);
        ctx.fillStyle = '#3e3746'; ctx.fillRect(pl.x - pw / 2 - 4, top, pw + 8, 6); ctx.fillRect(pl.x - pw / 2 - 4, bot - 7, pw + 8, 7);
      }
    });
    torches.forEach(function (tc) {
      ctx.fillStyle = retro ? Pp.copper : '#5a4030'; ctx.fillRect(tc.x - 2 * s, tc.y, 4 * s, 14 * s);
      ctx.fillStyle = retro ? Pp.copperLo : '#7a5530'; ctx.fillRect(tc.x - 5 * s, tc.y - 2 * s, 10 * s, 4 * s);
    });
    // полы (кроме обваливающихся — они живые)
    for (r = 0; r < RH; r++) for (c = 0; c < RW; c++) {
      gc = c0 + c; grr = r0 + r; t = L.tile(M, gc, grr); x = c * tw; y = r * th;
      if (!L.FLOOR_T[t] || t === '~') continue;
      floorSlab(ctx, x, y + th - fy, tw, fy, Pp, retro, s, gc, grr);
      if (t === '^') { ctx.fillStyle = retro ? '#000' : '#151018'; for (var q = 0; q < 4; q++) ctx.fillRect(x + (10 + q * 13) * s, y + th - fy - 1, 6 * s, 2); }
      if (t === 'x') { // проём ножниц в полу и потолке
        ctx.fillStyle = retro ? '#000' : '#100c12'; ctx.fillRect(x + tw / 2 - 3 * s, y + th - fy - 2, 6 * s, 3);
        ctx.fillStyle = retro ? Pp.iron : '#3a3f48'; ctx.fillRect(x + tw / 2 - 6 * s, y, 12 * s, 6 * s); ctx.fillRect(x + tw / 2 - 6 * s, y + th - fy - 5 * s, 12 * s, 5 * s);
      }
      if (t === 'G') { // рама решётки
        ctx.fillStyle = retro ? Pp.iron : '#2c3038'; ctx.fillRect(x + tw / 2 - 18 * s, y, 4 * s, th - fy); ctx.fillRect(x + tw / 2 + 14 * s, y, 4 * s, th - fy); ctx.fillRect(x + tw / 2 - 20 * s, y, 40 * s, 6 * s);
      }
      if (t === 'E') doorFrame(ctx, x, y, tw, th, fy, Pp, retro, s);
    }
    // зеркало в зале финала
    if (LV.mirror && rx === LV.mirror.room) {
      var mx = (LV.mirror.cx - c0 + 3.4) * tw, my = (LV.mirror.row - r0) * th + th * 0.12, mw = 40 * s, mh = th * 0.72;
      ctx.fillStyle = retro ? Pp.copper : '#8a5a2c'; ctx.beginPath(); ctx.ellipse(mx, my + mh / 2, mw / 2 + 5 * s, mh / 2 + 5 * s, 0, 0, PI * 2); ctx.fill();
      ctx.fillStyle = retro ? '#55ffff' : '#3d5866'; ctx.beginPath(); ctx.ellipse(mx, my + mh / 2, mw / 2, mh / 2, 0, 0, PI * 2); ctx.fill();
      if (!retro) { var gm = ctx.createLinearGradient(mx - mw / 2, my, mx + mw / 2, my + mh); gm.addColorStop(0, 'rgba(255,255,255,0.25)'); gm.addColorStop(0.5, 'rgba(255,255,255,0)'); ctx.fillStyle = gm; ctx.beginPath(); ctx.ellipse(mx, my + mh / 2, mw / 2, mh / 2, 0, 0, PI * 2); ctx.fill(); }
    }
    layerCache[key] = { cv: cv, torches: torches };
    return layerCache[key];
  }
  function floorSlab(ctx, x, y, w, h, Pp, retro, s, gc, grr) {
    if (retro) {
      ctx.fillStyle = Pp.floorFace; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = Pp.floorTop; ctx.fillRect(x, y - 3, w, 3);
      ctx.fillStyle = Pp.lip; ctx.fillRect(x, y - 3, w, 1);
      ctx.fillStyle = Pp.floorLo; ctx.fillRect(x + w - 1, y - 3, 1, h + 3);
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x, y + h, w, 8);   // тень под плитой
      var g = ctx.createLinearGradient(0, y - 6, 0, y); g.addColorStop(0, '#7d7180'); g.addColorStop(1, '#a89ba6'); ctx.fillStyle = g; ctx.fillRect(x, y - 6, w, 6);
      var g2 = ctx.createLinearGradient(0, y, 0, y + h); g2.addColorStop(0, '#6a5f6e'); g2.addColorStop(1, '#3b3440'); ctx.fillStyle = g2; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x, y, w, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + w - 1, y - 6, 1, h + 6);
      if (hash(gc, grr + 5) < 0.4) { ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x + hash(gc + 3, grr) * w * 0.7, y + 2, 10, 1); }
    }
  }
  function doorFrame(ctx, x, y, tw, th, fy, Pp, retro, s) {
    var dw = tw * 0.78, dx = x + (tw - dw) / 2, dh = th * 0.82, dy = y + th - fy - dh;
    ctx.fillStyle = retro ? '#000' : '#0b080d'; ctx.fillRect(dx, dy, dw, dh);
    ctx.fillStyle = retro ? Pp.stoneHi : '#7a6f80'; ctx.fillRect(dx - 5 * s, dy - 6 * s, dw + 10 * s, 6 * s); ctx.fillRect(dx - 5 * s, dy, 5 * s, dh); ctx.fillRect(dx + dw, dy, 5 * s, dh);
    ctx.fillStyle = retro ? Pp.copper : '#b07a3a'; ctx.fillRect(dx + dw / 2 - 4 * s, dy - 12 * s, 8 * s, 6 * s);
    ctx.fillStyle = retro ? Pp.floorTop : '#8c8090'; ctx.fillRect(dx - 8 * s, y + th - fy - 4 * s, dw + 16 * s, 4 * s);
  }

  // ---------- кадр ----------
  var low = null;
  function render(g, ctx, S, o) {
    o = o || {};
    var retro = g.themeName === 'retro', Pp = retro ? PR : PM, s = retro ? 0.5 : 1, LV = S.LV, M = S.M, rm = S.room;
    var tgt = ctx;
    if (retro) { if (!low) low = mkCanvas(RW * TW / 2, VH / 2); tgt = low.getContext('2d'); tgt.imageSmoothingEnabled = false; }
    var tw = TW * s, th = TH * s, fy = FY * s, X0 = rm.x * RW, Y0 = rm.y * RH;
    function px(x) { return (x - X0) * tw; }
    function py(y) { return (y - Y0) * th - fy; }
    var layer = roomLayer(LV, rm.x, rm.y, retro, M);
    tgt.save();
    if (o.shake) tgt.translate(Math.round((Math.random() - 0.5) * o.shake * s), Math.round((Math.random() - 0.5) * o.shake * s));
    tgt.drawImage(layer.cv, 0, 0);
    var time = S.clock;
    // факелы
    layer.torches.forEach(function (tc, i) {
      var fl = Math.sin(time * 11 + i * 2.1) * 0.5 + Math.sin(time * 17.3 + i) * 0.5;
      if (!retro) {
        tgt.save(); tgt.globalCompositeOperation = 'lighter';
        var rg = tgt.createRadialGradient(tc.x, tc.y - 6, 2, tc.x, tc.y - 6, 110 + fl * 6); rg.addColorStop(0, 'rgba(255,160,70,0.22)'); rg.addColorStop(1, 'rgba(255,120,40,0)');
        tgt.fillStyle = rg; tgt.fillRect(tc.x - 130, tc.y - 130, 260, 260); tgt.restore();
      }
      tgt.fillStyle = retro ? '#ff5555' : '#ff7a2a'; tgt.beginPath(); tgt.ellipse(tc.x, tc.y - 7 * s, 4.5 * s, (9 + fl * 1.5) * s, 0, 0, PI * 2); tgt.fill();
      tgt.fillStyle = retro ? '#ffff55' : '#ffd36a'; tgt.beginPath(); tgt.ellipse(tc.x, tc.y - 5 * s, 2.2 * s, (5 + fl) * s, 0, 0, PI * 2); tgt.fill();
    });
    var c0 = X0, c1 = X0 + RW - 1, r0 = Y0, r1 = Y0 + RH - 1, cc, r, k;
    // обваливающиеся плиты, нажимные плиты, мусор
    for (r = r0; r <= r1; r++) for (cc = c0; cc <= c1; cc++) {
      k = r * M.W + cc; var t = M.t[k], x = px(cc), yb = py(r + 1);
      if (t === '~') { var sh = M.shake[k] != null ? (Math.random() - 0.5) * 3 * s : 0; floorSlab(tgt, x, yb + sh, tw, fy, Pp, retro, s, cc, r); tgt.strokeStyle = retro ? '#000' : 'rgba(20,10,20,0.7)'; tgt.lineWidth = 1; tgt.beginPath(); tgt.moveTo(x + tw * 0.3, yb - 5 * s + sh); tgt.lineTo(x + tw * 0.45, yb + fy * 0.6 + sh); tgt.lineTo(x + tw * 0.6, yb - 2 + sh); tgt.lineTo(x + tw * 0.75, yb + fy + sh); tgt.stroke(); }
      if (t === 'o') {
        var pl = LV.plates[k], down = M.pressed[k] ? 2 * s : 0, col = pl.kind === 'close' ? (retro ? '#aa0000' : '#7a3a3a') : pl.kind === 'exit' ? (retro ? Pp.copperHi : '#e0a24a') : (retro ? Pp.copper : '#b07a3a');
        tgt.fillStyle = retro ? Pp.floorLo : '#2a2430'; tgt.fillRect(x + tw * 0.18, yb - 6 * s, tw * 0.64, 6 * s);
        tgt.fillStyle = col; tgt.fillRect(x + tw * 0.2, yb - 8 * s + down, tw * 0.6, 5 * s);
        if (!retro) { tgt.fillStyle = 'rgba(255,255,255,0.25)'; tgt.fillRect(x + tw * 0.2, yb - 8 * s + down, tw * 0.6, 1); }
      }
      if (M.debris[k]) { tgt.fillStyle = retro ? Pp.floorFace : '#6a5f6e'; for (var d = 0; d < 5; d++) { var hx = hash(cc * 5 + d, r); tgt.fillRect(x + (8 + hx * 44) * s, yb - (3 + hash(d, cc) * 5) * s, (5 + hx * 6) * s, (3 + hash(cc, d) * 4) * s); } }
    }
    // шипы
    LV.spikes.forEach(function (sp) {
      if (sp.c < c0 || sp.c > c1 || sp.r < r0 || sp.r > r1) return;
      var st = M.spk[sp.r * M.W + sp.c], hgt = st.up * 26 * s, x = px(sp.c), yb = py(sp.r + 1);
      if (hgt < 1) return;
      tgt.fillStyle = Pp.spike;
      for (var q = 0; q < 4; q++) { var sx = x + (13 + q * 13) * s; tgt.beginPath(); tgt.moveTo(sx - 3 * s, yb); tgt.lineTo(sx, yb - hgt); tgt.lineTo(sx + 3 * s, yb); tgt.closePath(); tgt.fill(); }
      if (S.hero.why === 'spike' && S.hero.st === 'dead' && Math.floor(S.hero.x) === sp.c) { tgt.fillStyle = retro ? '#ff5555' : 'rgba(200,30,40,0.8)'; for (q = 0; q < 4; q++) tgt.fillRect(x + (12 + q * 13) * s, yb - hgt, 2 * s, hgt * 0.4); }
    });
    // ножницы
    LV.chops.forEach(function (q) {
      if (q.c < c0 || q.c > c1 || q.r < r0 || q.r > r1) return;
      var ph = (S.clock + q.off) % K.CHOP_P, x = px(q.c) + tw / 2, top = (q.r - Y0) * th + 6 * s, yb = py(q.r + 1) - 2 * s;
      var close = ph < K.CHOP_C ? Math.sin(ph / K.CHOP_C * PI) : (ph > K.CHOP_P - 0.25 ? -0.15 * Math.sin((ph - K.CHOP_P + 0.25) / 0.25 * PI) : 0);
      var mid = (top + yb) / 2 + 6 * s, reachTop = lerp(top + 6 * s, mid, Math.max(0, close)), reachBot = lerp(yb - 6 * s, mid, Math.max(0, close));
      tgt.fillStyle = Pp.blade;
      tgt.beginPath(); tgt.moveTo(x - 4 * s, top); tgt.lineTo(x + 4 * s, top); tgt.lineTo(x + 6 * s, reachTop - 2 * s); tgt.lineTo(x - 3 * s, reachTop + 4 * s); tgt.closePath(); tgt.fill();
      tgt.beginPath(); tgt.moveTo(x - 4 * s, yb); tgt.lineTo(x + 4 * s, yb); tgt.lineTo(x + 3 * s, reachBot - 4 * s); tgt.lineTo(x - 6 * s, reachBot + 2 * s); tgt.closePath(); tgt.fill();
      if (!retro) { tgt.fillStyle = 'rgba(255,255,255,0.6)'; tgt.fillRect(x - 1, top, 1, reachTop - top); tgt.fillRect(x - 1, reachBot, 1, yb - reachBot); }
      if (S.hero.why === 'chop' && S.hero.st === 'dead' && Math.abs(S.hero.x - q.c - 0.5) < 0.5) { tgt.fillStyle = retro ? '#ff5555' : 'rgba(200,30,40,0.85)'; tgt.fillRect(x - 2 * s, mid - 10 * s, 4 * s, 20 * s); }
    });
    // решётки
    M.gates.forEach(function (gt) {
      if (gt.c < c0 || gt.c > c1 || gt.r < r0 || gt.r > r1) return;
      var x = px(gt.c) + tw / 2, top = (gt.r - Y0) * th + 6 * s, yb = py(gt.r + 1), hgt = Math.max(9 * s, (yb - top) * (1 - gt.open));
      tgt.fillStyle = retro ? Pp.ironHi : '#5d6672';
      for (var q2 = -2; q2 <= 2; q2++) tgt.fillRect(x + q2 * 6 * s - 1.2 * s, top, 2.4 * s, hgt);
      for (var y2 = top + hgt - 4 * s; y2 > top; y2 -= 16 * s) tgt.fillRect(x - 14 * s, y2, 28 * s, 2.4 * s);
      tgt.fillStyle = retro ? Pp.iron : '#8a95a3'; for (q2 = -2; q2 <= 2; q2++) { tgt.beginPath(); tgt.moveTo(x + q2 * 6 * s - 2 * s, top + hgt); tgt.lineTo(x + q2 * 6 * s, top + hgt + 4 * s); tgt.lineTo(x + q2 * 6 * s + 2 * s, top + hgt); tgt.fill(); }
      if (gt.boss && !retro) { tgt.fillStyle = 'rgba(217,138,78,0.35)'; tgt.fillRect(x - 14 * s, top, 28 * s, hgt); }
    });
    // дверь выхода
    if (LV.door && LV.door.c >= c0 && LV.door.c <= c1 && LV.door.r >= r0 && LV.door.r <= r1) {
      var dw = tw * 0.78, dx = px(LV.door.c) + (tw - dw) / 2, dh = th * 0.82, dy = py(LV.door.r + 1) - dh, cover = dh * (1 - S.doorT);
      if (S.doorT > 0.05 && !retro) { tgt.save(); tgt.globalCompositeOperation = 'lighter'; var dg = tgt.createLinearGradient(0, dy, 0, dy + dh); dg.addColorStop(0, 'rgba(255,190,110,0.05)'); dg.addColorStop(1, 'rgba(255,190,110,' + (0.35 * S.doorT) + ')'); tgt.fillStyle = dg; tgt.fillRect(dx, dy, dw, dh); tgt.restore(); }
      if (retro && S.doorT > 0.05) { tgt.fillStyle = '#aa5500'; tgt.fillRect(dx + 2, dy + dh - 4, dw - 4, 4); }
      if (cover > 1) {
        tgt.fillStyle = retro ? Pp.copper : '#6a4526'; tgt.fillRect(dx, dy, dw, cover);
        tgt.fillStyle = retro ? Pp.copperLo : '#4e3019'; for (var dl = 1; dl < 4; dl++) tgt.fillRect(dx + dl * dw / 4, dy, 1.5 * s, cover);
        tgt.fillStyle = retro ? Pp.copperHi : '#d98a4e'; tgt.fillRect(dx, dy + cover - 4 * s, dw, 3 * s); tgt.fillRect(dx, dy + 8 * s, dw, 2 * s);
      }
    }
    // клетка мастера
    if (LV.teacher && LV.teacher.c >= c0 && LV.teacher.c <= c1) cage(tgt, px(LV.teacher.c) + tw / 2, py(LV.teacher.r + 1), s, retro, S, Pp, time);
    // зелья
    for (k in M.potions) {
      var pc = k % M.W, pr = (k - pc) / M.W; if (pc < c0 || pc > c1 || pr < r0 || pr > r1) continue;
      potion(tgt, px(pc) + tw * 0.62, py(pr + 1), M.potions[k], s, retro, time + pc);
    }
    // падающие плиты
    S.falling.forEach(function (f) { if (f.c < c0 || f.c > c1) return; floorSlab(tgt, px(f.c) + 2, py(f.y) + 2 * s, tw - 4, fy, Pp, retro, s, f.c, 0); });
    // стражи
    S.guards.forEach(function (gd) {
      if (gd.room.x !== rm.x || gd.room.y !== rm.y) return;
      var lk = LOOK[gd.k][retro ? 'r' : 'm'], ps = guardPose(gd, S);
      if (!gd.alive) { ps = { p: mix(POSE.hit, POSE.dead, ease(gd.t / 0.6)) }; }
      shadow(tgt, px(gd.x), py(gd.y), s, retro);
      figure(tgt, px(gd.x), py(gd.y) + 1, gd.face, ps, lk, s, gd.k, { retro: retro, time: time, flash: gd.st === 'lunge' && gd.t > L.STYLE[gd.k].wind && gd.t < L.STYLE[gd.k].wind + 0.08 });
    });
    // двойник
    var T = S.twin;
    if (T && (rm.x === LV.mirror.room)) {
      var lkT = LOOK.Z[retro ? 'r' : 'm'];
      if (!T.on) {
        var aw = Math.min(1, T.wake / 1.4);
        if (aw > 0) { tgt.save(); tgt.globalAlpha = aw; figure(tgt, px(LV.mirror.cx + 3.4), py(LV.mirror.row + 1) - 4 * s, -1, { p: POSE.stand }, lkT, s * 0.95, 'Z', { retro: retro, noSword: true }); tgt.restore(); }
      } else if (!T.done || T.dieT < 1.2) {
        if (T.done) T.dieT = (T.dieT || 0) + 1 / 60;
        var tp = heroPose({ x: T.x, y: T.y, face: T.face, st: T.st, t: T.t, v: S.hero.v, vx: -S.hero.vx, vy: S.hero.vy, hang: null, x0: 2 * LV.mirror.cx - (S.hero.x0 || 0), dur: S.hero.dur }, S);
        if (T.st === 'climb' || T.st === 'cdown' || T.st === 'jumpup') tp = { p: POSE.stand };
        if (T.strike >= 0) tp = { p: T.strike < 0.24 ? mix(POSE.en, POSE.wind, T.strike / 0.24) : mix(POSE.wind, POSE.thrust, (T.strike - 0.24) / 0.08) };
        else if (FENCE_ST[T.st]) tp = { p: POSE.en };
        if (T.done) { tgt.save(); tgt.globalAlpha = Math.max(0, 1 - T.dieT / 1.2); tp = { p: mix(POSE.hit, POSE.dead, T.dieT / 0.8) }; }
        if (tp.p && tp.p.sw == null) tp.p = Object.assign({}, tp.p, { sw: 0.4 });
        shadow(tgt, px(T.x), py(T.y), s, retro);
        figure(tgt, px(T.x), py(T.y) + 1, T.face, tp, lkT, s, 'Z', { retro: retro, time: time });
        if (T.done) tgt.restore();
      }
    }
    // герой
    var H = S.hero, hp = heroPose(H, S), hx = px(H.x + (hp.dx || 0)), hy = py(H.y + (hp.dy || 0));
    if (H.st !== 'hang' && H.st !== 'climb' && H.st !== 'cdown' && H.st !== 'air' && H.st !== 'jumpup') shadow(tgt, hx, hy, s, retro);
    var heroSword = FENCE_ST[H.st] ? hp : hp;
    figure(tgt, hx, hy + 1, H.face, heroSword, LOOK.hero[retro ? 'r' : 'm'], s, 'hero', { retro: retro, time: time, flash: H.st === 'lunge' && H.t > K.LUNGE_W && H.t < K.LUNGE_W + 0.08 });
    // всплывающие надписи (в мировых координатах)
    (o.toasts || []).forEach(function (q) {
      var a = Math.min(1, q.t / 0.4), yy = py(q.y) - (1 - q.t / q.life) * 16 * s;
      tgt.globalAlpha = a; tgt.font = '800 ' + Math.round((q.big ? 15 : 12) * s * (retro ? 1.4 : 1)) + 'px ' + (retro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif'); tgt.textAlign = 'center';
      tgt.fillStyle = 'rgba(0,0,0,0.6)'; tgt.fillText(q.text, px(q.x) + 1, yy + 1); tgt.fillStyle = q.color; tgt.fillText(q.text, px(q.x), yy);
      tgt.globalAlpha = 1;
    });
    // смерть/переход: затемнение
    if (S.phase === 'dead' && S.phaseT > 1.2) { tgt.fillStyle = 'rgba(0,0,0,' + Math.min(0.85, (S.phaseT - 1.2) / 1) + ')'; tgt.fillRect(0, 0, RW * tw, VH * s); }
    if (S.phase === 'clear') { tgt.fillStyle = 'rgba(0,0,0,' + Math.min(1, S.phaseT / K.CLEAR_T) + ')'; tgt.fillRect(0, 0, RW * tw, VH * s); }
    if (o.fade) { tgt.fillStyle = 'rgba(0,0,0,' + o.fade + ')'; tgt.fillRect(0, 0, RW * tw, VH * s); }
    tgt.restore();
    if (retro) { ctx.imageSmoothingEnabled = false; ctx.drawImage(low, 0, 0, RW * TW, VH); }
    else { // виньетка
      var vg = ctx.createRadialGradient(320, 180, 160, 320, 180, 420); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, 640, VH);
    }
    hud(g, ctx, S, o, Pp, retro);
  }
  var FENCE_ST = { en: 1, lunge: 1, parry: 1, adv: 1, ret: 1, recoil: 1, hit: 1 };
  function shadow(ctx, x, y, s, retro) { if (retro) return; ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(x, y - 1, 14 * s, 3 * s, 0, 0, PI * 2); ctx.fill(); }
  function potion(ctx, x, yb, kind, s, retro, t) {
    var big = kind === 'H', h = (big ? 20 : 15) * s, w = (big ? 12 : 10) * s;
    var liquid = kind === 'h' ? (retro ? '#ff5555' : '#e8443c') : kind === 'H' ? (retro ? '#55ff55' : '#4fd67a') : (retro ? '#aa00aa' : '#9a49c9');
    ctx.fillStyle = retro ? '#aaaaaa' : 'rgba(210,225,235,0.55)';
    ctx.beginPath(); ctx.ellipse(x, yb - h * 0.38, w / 2 + 1, h * 0.38 + 1, 0, 0, PI * 2); ctx.fill(); ctx.fillRect(x - 2.5 * s, yb - h - 1, 5 * s, h * 0.4);
    ctx.fillStyle = liquid; ctx.beginPath(); ctx.ellipse(x, yb - h * 0.33, w / 2 - 1, h * 0.3, 0, 0, PI * 2); ctx.fill();
    ctx.fillStyle = retro ? '#aa5500' : '#8a5a2c'; ctx.fillRect(x - 3 * s, yb - h - 3 * s, 6 * s, 3 * s);
    for (var i = 0; i < 2; i++) { var u = ((t * (kind === 'p' ? 1.4 : 0.8) + i * 0.5) % 1); ctx.fillStyle = retro ? '#ffffff' : 'rgba(255,255,255,0.7)'; ctx.fillRect(x - 2 * s + i * 3 * s, yb - h * 0.3 - u * h * 0.9, 1.5 * s, 1.5 * s); }
    if (!retro) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = kind === 'p' ? 'rgba(150,70,200,0.12)' : kind === 'H' ? 'rgba(80,220,120,0.14)' : 'rgba(240,70,60,0.12)'; ctx.beginPath(); ctx.arc(x, yb - h * 0.4, 16 * s, 0, PI * 2); ctx.fill(); ctx.restore(); }
  }
  function cage(ctx, x, yb, s, retro, S, Pp, time) {
    var free = S.hero.st === 'free', w = 44 * s, h = 92 * s, lift = free ? Math.min(1, S.hero.t / 0.8) * h * 0.9 : 0, open = S.twin && S.twin.done;
    var lk = LOOK.master[retro ? 'r' : 'm'];
    figure(ctx, x + 4 * s, yb, -1, { p: free ? mix(POSE.stand, POSE.cheer, Math.min(1, S.hero.t / 0.6)) : mix(POSE.crouch, POSE.stand, 0.35) }, lk, s, 'master', { retro: retro, noSword: true });
    ctx.fillStyle = retro ? Pp.copper : (open ? '#d98a4e' : '#8a5a2c');
    ctx.fillRect(x - w / 2 - 3 * s, yb - h - 6 * s - lift, w + 6 * s, 6 * s);
    for (var i = 0; i <= 5; i++) ctx.fillRect(x - w / 2 + i * w / 5 - 1.2 * s, yb - h - lift, 2.4 * s, h - (lift ? 0 : 0));
    ctx.fillRect(x - w / 2 - 3 * s, yb - 4 * s, w + 6 * s, 4 * s);
  }
  function tri(ctx, x, y, sz, fill, stroke) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sz, y); ctx.lineTo(x + sz / 2, y - sz * 1.1); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); } }
  function clock(sec) { sec = Math.max(0, Math.ceil(sec)); var m = Math.floor(sec / 60), s2 = sec % 60; return (m < 10 ? '0' : '') + m + ':' + (s2 < 10 ? '0' : '') + s2; }
  function hud(g, ctx, S, o, Pp, retro) {
    var y0 = VH;
    ctx.fillStyle = Pp.hudBg; ctx.fillRect(0, y0, 640, HUD);
    ctx.fillStyle = Pp.hudLine; ctx.fillRect(0, y0, 640, retro ? 2 : 1);
    var font = retro ? '"Courier New", monospace' : 'Inter, system-ui, sans-serif';
    // здоровье героя
    for (var i = 0; i < S.maxHp; i++) tri(ctx, 12 + i * 20, y0 + 30, 15, i < S.hp ? (retro ? '#ff5555' : '#ff4a3d') : null, i < S.hp ? null : (retro ? '#aa0000' : '#6a2a2a'));
    // противник
    var H = S.hero, opp = null;
    if (FENCE_ST[H.st]) S.guards.forEach(function (gd) { if (gd.alive && Math.abs(gd.y - H.y) < 0.01 && Math.abs(gd.x - H.x) < K.DISENGAGE && gd.room.x === S.room.x && gd.room.y === S.room.y) opp = gd; });
    var tx = 632;
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    var low2 = S.timeLeft < 300, blink = low2 && Math.floor(S.clock * 2) % 2 === 0;
    ctx.font = '800 ' + (retro ? 19 : 18) + 'px ' + font; ctx.fillStyle = blink ? Pp.bad : Pp.accent; ctx.fillText(clock(S.timeLeft), tx, y0 + 25);
    ctx.font = '700 10px ' + font; ctx.fillStyle = Pp.muted; ctx.fillText(g.t('left'), tx, y0 + 36);
    if (opp) { var ox = 520; for (i = 0; i < opp.maxHp; i++) tri(ctx, ox - i * 18, y0 + 30, 13, i < opp.hp ? (retro ? '#55ffff' : '#5cc8ff') : null, i < opp.hp ? null : (retro ? '#0000aa' : '#2a4a6a')); ctx.font = '700 10px ' + font; ctx.textAlign = 'right'; ctx.fillStyle = Pp.muted; ctx.fillText(g.t(opp.k), ox + 13, y0 + 12); }
    if (S.twin && S.twin.on && !S.twin.done) { ctx.font = '700 11px ' + font; ctx.textAlign = 'right'; ctx.fillStyle = retro ? '#ffff55' : '#ffd2a0'; ctx.fillText(g.t('Z'), 532, y0 + 26); }
    // центр: уровень / сообщение
    ctx.textAlign = 'center';
    var name = g.t('l' + S.level), lv = S.level >= C.LEVELS.length ? g.t('final') : g.t('level') + ' ' + S.level;
    ctx.font = '800 ' + (retro ? 14 : 14) + 'px ' + font; ctx.fillStyle = Pp.ink; ctx.fillText(o.msg ? o.msg.text : lv + ' · ' + name, 320, y0 + 18);
    ctx.font = '600 ' + (retro ? 11 : 11) + 'px ' + font; ctx.fillStyle = o.msg ? (o.msg.color || Pp.accent) : Pp.muted; ctx.fillText(o.msg ? (o.msg.sub || '') : (g.t('score') + ' ' + S.score), 320, y0 + 33);
    // баннер уровня
    if (o.banner && o.banner.a > 0) {
      var a = Math.min(1, o.banner.a / 0.5, (o.banner.life - o.banner.a + 0.2) / 0.4);
      ctx.save(); ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = retro ? '#000' : 'rgba(10,8,14,0.72)'; ctx.fillRect(0, 120, 640, 74);
      ctx.fillStyle = Pp.hudLine; ctx.fillRect(0, 120, 640, 1); ctx.fillRect(0, 193, 640, 1);
      ctx.font = '900 ' + (retro ? 26 : 28) + 'px ' + font; ctx.fillStyle = Pp.accent; ctx.textAlign = 'center'; ctx.fillText(o.banner.title, 320, 158);
      ctx.font = '600 13px ' + font; ctx.fillStyle = Pp.ink; ctx.fillText(o.banner.sub || '', 320, 180);
      ctx.restore();
    }
    if (o.hint && o.hint.a > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, o.hint.a / 0.4, (o.hint.life - o.hint.a + 0.1) / 0.3);
      ctx.font = '700 12px ' + font; var w = ctx.measureText(o.hint.text).width + 24;
      ctx.fillStyle = retro ? '#000' : 'rgba(12,10,16,0.82)'; if (retro) ctx.fillRect(320 - w / 2, 8, w, 24); else { rr(ctx, 320 - w / 2, 8, w, 24, 8); ctx.fill(); }
      ctx.strokeStyle = Pp.hudLine; ctx.lineWidth = 1; if (retro) ctx.strokeRect(320 - w / 2 + 0.5, 8.5, w - 1, 23); else { rr(ctx, 320 - w / 2 + 0.5, 8.5, w - 1, 23, 8); ctx.stroke(); }
      ctx.fillStyle = Pp.ink; ctx.textAlign = 'center'; ctx.fillText(o.hint.text, 320, 24);
      ctx.restore();
    }
  }
  C.render = render;
  C.R = { PM: PM, PR: PR, LOOK: LOOK, POSE: POSE, mix: mix, figure: figure, heroPose: heroPose, guardPose: guardPose, roomLayer: roomLayer, potion: potion, tri: tri, clock: clock, rr: rr,
    TW: TW, TH: TH, VH: VH, HUD: HUD, gait: gait, low: function () { return low; } };
})(typeof window !== 'undefined' ? window : globalThis);
