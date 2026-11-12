/* КЛАДКА · рендер MODERN (по умолчанию). KLADKA.modern = { P, bg, draw, glyph }
   Тёплая мастерская: тёмный кирпичный фон с отсветом печи, каменные стены,
   глазурованные блоки с растворными швами, стальной мастерок, раскалённое ядро.
   Логику не трогает — только читает состояние. */
(function (global) {
  'use strict';
  var K = global.KLADKA = global.KLADKA || {};
  var L = K.logic;

  var P = {
    pixel: false, font: null,
    hudBg: '#120e0d', hudLine: '#2c211c', ink: '#f4ece4', muted: '#a8968a', accent: '#ff8a3d',
    good: '#4fd88a', bad: '#ff5d6c', panel: '#1a1412', bar: '#2c211c', bossBar: '#ff6a2a',
    life: '#ff8a3d', lifeOff: '#3a2c26', chip: 'rgba(26,20,18,.92)',
    tones: ['#e5583f', '#f08c3a', '#f2c24d', '#43bf9f', '#4b8fe8', '#9a7cf0'],
    two: '#b98a4a', three: '#6c7a90', iron: '#2f3239',
    pw: { wide: '#4fd88a', narrow: '#ff5d6c', triple: '#4fd2ff', glue: '#ffb020', cutter: '#ff4f9a', chill: '#9cc2ff', life: '#ff8ab0' }
  };

  function shade(hex, f) {
    var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    var t = f < 0 ? 0 : 255, p = Math.abs(f);
    return 'rgb(' + Math.round((t - r) * p + r) + ',' + Math.round((t - g) * p + g) + ',' + Math.round((t - b) * p + b) + ')';
  }
  var rr = function (ctx, x, y, w, h, r) { K.ui.roundRect(ctx, x, y, w, h, r); };

  // ---------- Фон (кэш): кирпичная стена мастерской, отсвет печи, каменные стены поля ----------
  var cache = null;
  function buildBg(W, H) {
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1c1412'); gr.addColorStop(0.6, '#130f0e'); gr.addColorStop(1, '#0d0b0b');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // тусклая кладка на фоне
    x.strokeStyle = 'rgba(255,190,150,.035)'; x.lineWidth = 1;
    for (var yy = 52, row = 0; yy < H; yy += 24, row++) {
      x.beginPath(); x.moveTo(0, yy + 0.5); x.lineTo(W, yy + 0.5); x.stroke();
      for (var xx = (row % 2) * 24; xx < W; xx += 48) { x.beginPath(); x.moveTo(xx + 0.5, yy); x.lineTo(xx + 0.5, yy + 24); x.stroke(); }
    }
    // отсвет печи сверху и холодный снизу
    var gl = x.createRadialGradient(W / 2, 40, 10, W / 2, 40, W * 0.85);
    gl.addColorStop(0, 'rgba(255,120,40,.16)'); gl.addColorStop(1, 'rgba(255,120,40,0)');
    x.fillStyle = gl; x.fillRect(0, 0, W, H);
    // каменные стены и потолочная балка
    function stones(x0, w) {
      for (var y = 44, i = 0; y < H; i++) {
        var h = 22 + ((i * 7) % 3) * 6;
        var s = x.createLinearGradient(x0, 0, x0 + w, 0); s.addColorStop(0, '#4a4542'); s.addColorStop(1, '#2f2b29');
        x.fillStyle = s; rr(x, x0 + 1, y + 1, w - 2, h - 2, 3); x.fill();
        x.fillStyle = 'rgba(255,255,255,.07)'; x.fillRect(x0 + 2, y + 2, w - 4, 2);
        y += h;
      }
    }
    stones(0, L.FX0); stones(L.FX1, W - L.FX1);
    var bm = x.createLinearGradient(0, 44, 0, L.FY0); bm.addColorStop(0, '#5a524d'); bm.addColorStop(1, '#2f2a27');
    x.fillStyle = bm; x.fillRect(0, 44, W, L.FY0 - 44);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(L.FX0, L.FY0, L.FX1 - L.FX0, 3);
    return c;
  }
  function bg(ctx, g) {
    if (!cache) cache = buildBg(g.W, g.H);
    ctx.drawImage(cache, 0, 0);
  }

  // ---------- Значки бонусов (вектор) ----------
  function glyph(ctx, k, x, y, s, col) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1);
    ctx.fillStyle = col || '#fff'; ctx.strokeStyle = col || '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (k === 'wide') { ctx.moveTo(-7, 0); ctx.lineTo(7, 0); ctx.moveTo(-4, -3); ctx.lineTo(-7, 0); ctx.lineTo(-4, 3); ctx.moveTo(4, -3); ctx.lineTo(7, 0); ctx.lineTo(4, 3); ctx.stroke(); }
    else if (k === 'narrow') { ctx.moveTo(-8, 0); ctx.lineTo(-2, 0); ctx.moveTo(8, 0); ctx.lineTo(2, 0); ctx.moveTo(-5, -3); ctx.lineTo(-2, 0); ctx.lineTo(-5, 3); ctx.moveTo(5, -3); ctx.lineTo(2, 0); ctx.lineTo(5, 3); ctx.stroke(); }
    else if (k === 'triple') { [-5, 0, 5].forEach(function (d) { ctx.moveTo(d + 2, 0); ctx.arc(d, 0, 2, 0, 6.283); }); ctx.fill(); }
    else if (k === 'glue') { ctx.moveTo(0, -5); ctx.quadraticCurveTo(4, 0, 3.5, 2); ctx.arc(0, 2, 3.5, 0, Math.PI); ctx.quadraticCurveTo(-4, 0, 0, -5); ctx.fill(); }
    else if (k === 'cutter') { ctx.moveTo(1.5, -6); ctx.lineTo(-3, 1); ctx.lineTo(0.5, 1); ctx.lineTo(-1.5, 6); ctx.lineTo(3, -1); ctx.lineTo(-0.5, -1); ctx.closePath(); ctx.fill(); }
    else if (k === 'chill') { for (var i = 0; i < 3; i++) { var a = i * Math.PI / 3; ctx.moveTo(Math.cos(a) * 5.5, Math.sin(a) * 5.5); ctx.lineTo(-Math.cos(a) * 5.5, -Math.sin(a) * 5.5); } ctx.lineWidth = 1.6; ctx.stroke(); }
    else if (k === 'life') { ctx.moveTo(0, 5); ctx.bezierCurveTo(-7, 0, -4, -6, 0, -2.5); ctx.bezierCurveTo(4, -6, 7, 0, 0, 5); ctx.fill(); }
    ctx.restore();
  }

  // ---------- Блоки ----------
  function brick(ctx, b) {
    var x = b.x + 1, y = b.y + 1, w = b.w - 2, h = b.h - 2;
    var base = b.iron ? P.iron : b.max === 3 ? P.three : b.max === 2 ? P.two : P.tones[b.tone];
    if (b.gift) base = '#f5e6c8';
    var gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, shade(base, 0.22)); gr.addColorStop(0.5, base); gr.addColorStop(1, shade(base, -0.28));
    ctx.fillStyle = gr; rr(ctx, x, y, w, h, 3); ctx.fill();
    // растворный шов «вперевязку»: на чётных рядах — полкирпича
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    if (b.r % 2 === 0) ctx.fillRect(x + w / 2 - 0.5, y + 2, 1, h - 4);
    ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(x + 3, y + 1.5, w - 6, 1.5);
    if (b.iron) {
      ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.beginPath();
      for (var k = -h; k < w; k += 6) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); }
      ctx.save(); rr(ctx, x, y, w, h, 3); ctx.clip(); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#7d828c'; [[4, 4], [w - 4, 4], [4, h - 4], [w - 4, h - 4]].forEach(function (p) { ctx.beginPath(); ctx.arc(x + p[0], y + p[1], 1.4, 0, 6.283); ctx.fill(); });
    } else if (b.max > 1) {
      ctx.fillStyle = 'rgba(255,240,210,.55)';
      for (var i = 0; i < b.max; i++) { ctx.beginPath(); ctx.arc(x + w / 2 + (i - (b.max - 1) / 2) * 6, y + h / 2, 1.6, 0, 6.283); ctx.fill(); }
      if (b.hp < b.max) {   // трещины
        ctx.strokeStyle = 'rgba(20,10,8,.75)'; ctx.lineWidth = 1.2; ctx.beginPath();
        ctx.moveTo(x + 4, y + 3); ctx.lineTo(x + 10, y + 8); ctx.lineTo(x + 8, y + h - 2);
        if (b.hp < b.max - 1) { ctx.moveTo(x + w - 3, y + 2); ctx.lineTo(x + w - 10, y + 7); ctx.lineTo(x + w - 6, y + h - 2); }
        ctx.stroke();
      }
    } else if (b.gift) {
      ctx.fillStyle = '#ff8a3d'; ctx.beginPath(); ctx.moveTo(x + w / 2, y + 3); ctx.lineTo(x + w / 2 + 4, y + h / 2); ctx.lineTo(x + w / 2, y + h - 3); ctx.lineTo(x + w / 2 - 4, y + h / 2); ctx.closePath(); ctx.fill();
    }
    if (b.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (b.flash / 0.15 * 0.6).toFixed(2) + ')'; rr(ctx, x, y, w, h, 3); ctx.fill(); }
  }

  // ---------- Плавильня ----------
  function boss(ctx, B, g) {
    if (B.hp <= 0 && B.flash <= 0) return;
    var x = B.x - B.w / 2, y = B.y, w = B.w, h = B.h, t = g.time;
    ctx.save();
    if (B.hp <= 0) ctx.globalAlpha = Math.max(0, B.flash / 0.25);
    // жар вокруг печи
    var aura = ctx.createRadialGradient(B.x, y + 30, 10, B.x, y + 30, 120);
    aura.addColorStop(0, 'rgba(255,110,40,' + (0.22 + (B.mouth > 0 ? 0.15 : 0)).toFixed(2) + ')'); aura.addColorStop(1, 'rgba(255,110,40,0)');
    ctx.fillStyle = aura; ctx.fillRect(B.x - 120, y, 240, 150);
    // корпус-колокол
    var gr = ctx.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, '#2a1d19'); gr.addColorStop(0.5, '#4a3128'); gr.addColorStop(1, '#2a1d19');
    ctx.fillStyle = gr; ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w - 6, y + h - 20);
    ctx.quadraticCurveTo(x + w - 10, y + h, x + w / 2, y + h); ctx.quadraticCurveTo(x + 10, y + h, x + 6, y + h - 20); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6a463a'; ctx.lineWidth = 1.5; ctx.stroke();
    // пояса заклёпок
    ctx.fillStyle = '#8a6a5a';
    for (var i = 0; i < 7; i++) { ctx.beginPath(); ctx.arc(x + 12 + i * (w - 24) / 6, y + 8, 1.6, 0, 6.283); ctx.fill(); }
    // сердце
    var cx = B.x, cy = y + 32, pulse = 0.5 + 0.5 * Math.sin(t * (4 + (1 - B.hp / B.max) * 6)), hot = B.mouth > 0 ? 1 : 0;
    var hg = ctx.createRadialGradient(cx, cy, 2, cx, cy, 22);
    hg.addColorStop(0, '#fff6d8'); hg.addColorStop(0.35, hot ? '#ffd24a' : '#ffb03a'); hg.addColorStop(0.7, 'rgba(255,90,30,' + (0.6 + pulse * 0.3).toFixed(2) + ')'); hg.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 6.283); ctx.fill();
    ctx.fillStyle = '#ffe8b0'; ctx.beginPath(); ctx.arc(cx, cy, 6 + pulse * 2 + hot * 2, 0, 6.283); ctx.fill();
    // решётка дверцы
    ctx.strokeStyle = 'rgba(30,18,14,.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 15, 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - 5, cy - 14); ctx.lineTo(cx - 5, cy + 14); ctx.moveTo(cx + 5, cy - 14); ctx.lineTo(cx + 5, cy + 14); ctx.stroke();
    // поддувало — светится перед выстрелом
    ctx.fillStyle = hot ? '#ffcc4a' : '#1a100d'; rr(ctx, cx - 14, y + h - 9, 28, 5, 2.5); ctx.fill();
    if (hot) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff9a3a'; ctx.beginPath(); ctx.ellipse(cx, y + h - 4, 26, 8, 0, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; }
    if (B.flash > 0 && B.hp > 0) { ctx.globalAlpha = B.flash / 0.25 * 0.7; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy, 20, 0, 6.283); ctx.fill(); }
    ctx.restore();
  }

  function paddle(ctx, S, g) {
    var Pd = S.paddle, w = Pd.w, x = Pd.x - w / 2, y = L.PADDLE_Y, h = L.PADDLE_H;
    // ручка мастерка
    ctx.fillStyle = '#7a4a2a'; rr(ctx, Pd.x - 9, y + h - 1, 18, 9, 3); ctx.fill();
    ctx.fillStyle = '#a0683e'; ctx.fillRect(Pd.x - 7, y + h, 14, 2);
    // полотно
    var gr = ctx.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, '#f1f5fa'); gr.addColorStop(0.5, '#aab6c6'); gr.addColorStop(1, '#6c7889');
    ctx.fillStyle = gr; rr(ctx, x, y, w, h, 6); ctx.fill();
    ctx.save(); ctx.shadowColor = '#ff8a3d'; ctx.shadowBlur = 10; ctx.fillStyle = '#ff8a3d'; rr(ctx, x + 4, y, w - 8, 2.5, 1.2); ctx.fill(); ctx.restore();
    if (S.pow.cutter > 0) { ctx.fillStyle = P.pw.cutter; rr(ctx, x + 2, y - 4, 7, 6, 2); ctx.fill(); rr(ctx, x + w - 9, y - 4, 7, 6, 2); ctx.fill(); }
    if (S.pow.glue > 0) { ctx.fillStyle = 'rgba(255,176,32,.85)'; for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(x + w * (0.2 + i * 0.2), y + 1, 4, 2.4, 0, 0, 6.283); ctx.fill(); } }
    if (Pd.hitT > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (Pd.hitT / 0.12 * 0.5).toFixed(2) + ')'; rr(ctx, x, y, w, h, 6); ctx.fill(); }
    if (Pd.stun > 0 && ((g.time * 16) | 0) % 2) { ctx.fillStyle = 'rgba(140,200,255,.55)'; rr(ctx, x - 2, y - 2, w + 4, h + 4, 7); ctx.fill(); }
  }

  function ball(ctx, b, S) {
    var tr = b._tr || (b._tr = []);
    tr.push(b.x, b.y); if (tr.length > 12) tr.splice(0, 2);
    for (var i = 0; i < tr.length - 2; i += 2) { var a = (i + 2) / tr.length; ctx.fillStyle = 'rgba(255,150,60,' + (a * 0.35).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(tr[i], tr[i + 1], L.BALL_R * a, 0, 6.283); ctx.fill(); }
    var chill = S.pow.chill > 0;
    var gr = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 12);
    gr.addColorStop(0, chill ? 'rgba(160,200,255,.6)' : 'rgba(255,170,70,.55)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, 6.283); ctx.fill();
    var c = ctx.createRadialGradient(b.x - 1.5, b.y - 1.5, 0.5, b.x, b.y, L.BALL_R);
    c.addColorStop(0, '#ffffff'); c.addColorStop(0.6, chill ? '#cfe2ff' : '#ffe2a8'); c.addColorStop(1, chill ? '#7fa8e8' : '#ff9a3a');
    ctx.fillStyle = c; ctx.beginPath(); ctx.arc(b.x, b.y, L.BALL_R, 0, 6.283); ctx.fill();
  }

  function draw(ctx, S, g, extra) {
    extra = extra || {};
    bg(ctx, g);
    for (var i = 0; i < S.bricks.length; i++) if (!S.bricks[i].dead) brick(ctx, S.bricks[i]);
    if (S.boss) boss(ctx, S.boss, g);
    // слитки
    for (var c = 0; c < S.caps.length; c++) {
      var cp = S.caps[c], col = P.pw[cp.kind], x = cp.x - L.CAP_W / 2, y = cp.y - L.CAP_H / 2;
      var gr = ctx.createLinearGradient(0, y, 0, y + L.CAP_H); gr.addColorStop(0, shade(col, 0.35)); gr.addColorStop(1, shade(col, -0.35));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(x + 4, y); ctx.lineTo(x + L.CAP_W - 4, y); ctx.lineTo(x + L.CAP_W, y + L.CAP_H); ctx.lineTo(x, y + L.CAP_H); ctx.closePath(); ctx.fill();
      glyph(ctx, cp.kind, cp.x, cp.y + 0.5, 0.75, '#1a1210');
    }
    // лучи резака
    ctx.save(); ctx.shadowColor = P.pw.cutter; ctx.shadowBlur = 8; ctx.fillStyle = '#ffd0e4';
    for (var o = 0; o < S.bolts.length; o++) ctx.fillRect(S.bolts[o].x - 1.5, S.bolts[o].y - 7, 3, 14);
    ctx.restore();
    // искры
    for (var s = 0; s < S.sparks.length; s++) {
      var sk = S.sparks[s], m = Math.hypot(sk.vx, sk.vy) || 1;
      ctx.strokeStyle = 'rgba(255,140,40,.55)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sk.x, sk.y); ctx.lineTo(sk.x - sk.vx / m * 14, sk.y - sk.vy / m * 14); ctx.stroke();
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.arc(sk.x, sk.y, 4, 0, 6.283); ctx.fill();
    }
    if (S.phase !== 'over') paddle(ctx, S, g);
    for (var b = 0; b < S.balls.length; b++) ball(ctx, S.balls[b], S);
    if (extra.bare) return;
    K.ui.hud(g, ctx, S, P);
    K.ui.powers(g, ctx, S, P, glyph);
    if (extra.toasts) K.ui.toasts(g, ctx, extra.toasts, P);
    K.ui.banner(g, ctx, S, P);
  }

  K.modern = { P: P, bg: bg, draw: draw, glyph: glyph };
})(typeof window !== 'undefined' ? window : globalThis);
