/* tools/promo/art-default.js — общий рисунок иконки и обложки для tools/promo-build.mjs, если у игры нет promo/<slug>/art.js.
   Только по палитре игры (promo.json → palette): градиент, узор из квадратов, эмблема-«ромб». Без текста на иконке,
   без рамок и скруглённых углов (Яндекс 8.3.3), без чужих брендов. Своя игра — лучше свой art.js (см. promo/kaskad/art.js). */
(function (w) {
  function shade(hex, k) { var n = parseInt(String(hex).replace('#', ''), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255;
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)))); }; return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')'; }
  function rnd(seed) { var s = seed || 7; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
  var A = {
    shade: shade, rnd: rnd,
    pattern: function (x, W, H, P, seed) { var r = rnd(seed * 31 + 5), s = Math.max(W, H) / 22; x.fillStyle = P.accent;
      for (var i = 0; i < 90; i++) { var q = s * (0.3 + r() * 0.7); x.globalAlpha = 0.05 + r() * 0.12; x.fillRect(r() * W, r() * H, q, q); } x.globalAlpha = 1; },
    emblem: function (x, cx, cy, R, P) {
      x.save(); x.translate(cx, cy); x.rotate(Math.PI / 4);
      var g = x.createLinearGradient(-R, -R, R, R); g.addColorStop(0, shade(P.accent, 0.35)); g.addColorStop(1, shade(P.accent, -0.35));
      x.fillStyle = g; x.fillRect(-R * 0.7, -R * 0.7, R * 1.4, R * 1.4);
      x.fillStyle = shade(P.bg, 0.1); x.fillRect(-R * 0.35, -R * 0.35, R * 0.7, R * 0.7);
      x.fillStyle = P.accent2 || P.ink; x.fillRect(-R * 0.15, -R * 0.15, R * 0.3, R * 0.3); x.restore();
    },
    icon: function (x, S, P) { var g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, P.panel || P.bg); g.addColorStop(1, P.bg); x.fillStyle = g; x.fillRect(0, 0, S, S);
      A.pattern(x, S, S, P, 3); A.emblem(x, S / 2, S / 2, S * 0.36, P); },
    cover: function (x, W, H, P) { var g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, P.panel || P.bg); g.addColorStop(1, P.bg); x.fillStyle = g; x.fillRect(0, 0, W, H);
      A.pattern(x, W, H, P, 9); A.emblem(x, W * 0.5, H * 0.62, H * 0.3, P); return { title: { x: W / 2, y: H * 0.2, w: W * 0.86, size: H * 0.18 } }; }
  };
  w.PromoArtBase = A; if (!w.PromoArt) w.PromoArt = A;
})(window);
