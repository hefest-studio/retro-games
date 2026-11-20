/*! Гефест Arcade · aspect.js — режим 16:9 для порталов (Poki, CrazyGames и т.п.). v1.0.0
 * Источник — _shared/aspect.js; в игру попадает копией js/aspect.js только через tools/platform-build.mjs --aspect 16:9
 * (на сайте arcade.hefest.ru не подключается). Подключается ПОСЛЕДНИМ скриптом страницы.
 * Что делает: окно делится на «сцену» 16:9 (наибольший прямоугольник 16:9, по центру) и чёрные поля вне её
 * (если сам iframe портала не 16:9). В портретном окне (телефон стоя) сцена — всё окно: игра не сжимается до полоски. Игра (портретная или любая) вписывается в сцену по высоте без искажений:
 * размер canvas задаёт сама игра, aspect.js лишь уменьшает его, если он не помещается в сцену. Поля сцены по бокам
 * от игры закрашиваются фоном в тон темы игры (цвет фона страницы + акцент из <meta name="theme-color"> или --accent)
 * с неброским узором — без чужих брендов и без текста. Подсказка-подвал .foot скрыта (управление — в «Как играть» портала),
 * кнопки с position:fixed переносятся внутрь сцены. Тема игры сменилась (T) — фон перерисовывается.
 * Без зависимостей; ошибки не роняют игру. Проверка: node _shared/tests/platform-builds.browser.mjs <папка> (сборки *-16x9).
 */
(function (global) {
  'use strict';
  var doc = global.document; if (!doc || !doc.body) return;
  var m = doc.querySelector('meta[name="arcade-aspect"]'), spec = (m && m.getAttribute('content')) || '16:9';
  var p = /^(\d+)\s*[:x]\s*(\d+)$/.exec(spec); var RATIO = p ? (+p[1] / +p[2]) : 16 / 9;
  var root = doc.documentElement, body = doc.body;
  root.classList.add('arcade-aspect');
  var st = doc.createElement('style');
  st.textContent = 'html.arcade-aspect,html.arcade-aspect body{width:100%;height:100%;overflow:hidden!important;margin:0}' +
    'html.arcade-aspect body{background:transparent!important;min-height:0!important;box-sizing:border-box}' +
    'html.arcade-aspect .foot{display:none!important}' +
    '#arcade-aspect-bg{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;display:block}';
  (doc.head || root).appendChild(st);
  var bg = doc.createElement('canvas'); bg.id = 'arcade-aspect-bg'; bg.setAttribute('aria-hidden', 'true'); body.insertBefore(bg, body.firstChild);
  var stage = { x: 0, y: 0, w: 0, h: 0 }, lastKey = '';

  function themeColors() {
    // фон страницы — до того, как aspect.js сделал body прозрачным, он запомнен в data-arcade-bg; дальше — из CSS-переменных/темы
    var cs = getComputedStyle(body), v = (cs.getPropertyValue('--bg') || '').trim();
    var base = v || body.getAttribute('data-arcade-bg') || '#0e1016';
    var acc = (cs.getPropertyValue('--accent') || '').trim();
    if (!acc) { var tc = doc.querySelector('meta[name="theme-color"]'); acc = '#4f8cff'; if (tc && /^#[0-9a-f]{6}$/i.test(tc.content) && tc.content.toLowerCase() !== base.toLowerCase()) acc = tc.content; }
    return { base: base, accent: acc, theme: body.getAttribute('data-theme') || root.getAttribute('data-theme') || '' };
  }
  function rgba(hex, a) { var h = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!h) return 'rgba(255,255,255,' + a + ')'; var n = parseInt(h[1], 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function toHex(c) { var mm = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); if (!mm) return c; return '#' + [mm[1], mm[2], mm[3]].map(function (x) { return ('0' + (+x).toString(16)).slice(-2); }).join(''); }

  function paint() {
    var W = global.innerWidth, H = global.innerHeight, dpr = Math.min(2, global.devicePixelRatio || 1), c = themeColors();
    var key = [W, H, c.base, c.accent, c.theme].join('|'); if (key === lastKey) return; lastKey = key;
    bg.width = Math.round(W * dpr); bg.height = Math.round(H * dpr);
    var x = bg.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);                                   // вне сцены — чёрные поля
    x.save(); x.beginPath(); x.rect(stage.x, stage.y, stage.w, stage.h); x.clip();
    x.fillStyle = c.base; x.fillRect(stage.x, stage.y, stage.w, stage.h);
    var pix = c.theme === 'retro', step = pix ? 16 : 28;                                  // узор: ретро — «пиксельная» сетка, модерн — мягкая диагональ
    x.fillStyle = rgba(toHex(c.accent), pix ? 0.10 : 0.06);
    if (pix) { for (var yy = stage.y; yy < stage.y + stage.h; yy += step) for (var xx = stage.x + ((yy / step) % 2 ? step / 2 : 0); xx < stage.x + stage.w; xx += step) x.fillRect(Math.round(xx), Math.round(yy), 4, 4); }
    else { x.lineWidth = 2; x.strokeStyle = rgba(toHex(c.accent), 0.07); for (var d = -stage.h; d < stage.w; d += step) { x.beginPath(); x.moveTo(stage.x + d, stage.y + stage.h); x.lineTo(stage.x + d + stage.h, stage.y); x.stroke(); } }
    var g = x.createRadialGradient(stage.x + stage.w / 2, stage.y + stage.h / 2, stage.h * 0.25, stage.x + stage.w / 2, stage.y + stage.h / 2, stage.w * 0.62);
    g.addColorStop(0, rgba(toHex(c.accent), 0.10)); g.addColorStop(1, 'rgba(0,0,0,0.55)');
    x.fillStyle = g; x.fillRect(stage.x, stage.y, stage.w, stage.h);
    x.restore();
  }
  function bigCanvas() { var cs = doc.querySelectorAll('canvas:not(#arcade-aspect-bg)'), best = null, a = 0; for (var i = 0; i < cs.length; i++) { var r = cs[i].getBoundingClientRect(), s = r.width * r.height; if (s > a) { a = s; best = cs[i]; } } return best; }
  function layout() {
    try {
      var W = global.innerWidth, H = global.innerHeight, w = W, h = W / RATIO;
      if (h > H) { h = H; w = H * RATIO; }
      if (W < H) { w = W; h = H; }   // портретное окно (телефон стоя): сцена — всё окно, иначе портретная игра станет крошечной
      stage = { x: Math.floor((W - w) / 2), y: Math.floor((H - h) / 2), w: Math.floor(w), h: Math.floor(h) };
      body.style.paddingTop = stage.y + 'px'; body.style.paddingBottom = stage.y + 'px';
      var c = bigCanvas();
      if (c) {
        var r = c.getBoundingClientRect(), lim = stage.y + stage.h - 6;
        if (r.bottom > lim + 0.5 || r.width > stage.w) { // не помещается в сцену — уменьшить, сохранив пропорции canvas
          var k = Math.min((lim - r.top) / r.height, stage.w / r.width), nw = Math.max(120, Math.floor(r.width * k));
          c.style.width = nw + 'px'; c.style.height = Math.round(nw * c.height / c.width) + 'px';
          var wrap = c.parentElement; if (wrap && wrap.style && wrap.style.width) wrap.style.width = nw + 'px';
        }
      }
      // элементы position:fixed (кнопки паузы/встряски) — внутрь сцены: их исходные отступы считаются от углов сцены
      var all = body.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) { var el = all[i]; if (el === bg || el.tagName === 'SCRIPT') continue;
        if (!el.hasAttribute('data-arcade-fx')) { var cs = getComputedStyle(el); if (cs.position !== 'fixed') continue;
          var rr = el.getBoundingClientRect(), W0 = global.innerWidth, H0 = global.innerHeight;   // исходные отступы от ближайших краёв окна
          el.setAttribute('data-arcade-fx', JSON.stringify({ v: rr.top <= H0 - rr.bottom ? ['top', rr.top] : ['bottom', H0 - rr.bottom], h: rr.left <= W0 - rr.right ? ['left', rr.left] : ['right', W0 - rr.right] })); }
        var o = JSON.parse(el.getAttribute('data-arcade-fx')), W2 = global.innerWidth, H2 = global.innerHeight;
        var off = { top: stage.y, left: stage.x, right: W2 - stage.x - stage.w, bottom: H2 - stage.y - stage.h }, opp = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
        el.style[o.v[0]] = (o.v[1] + off[o.v[0]]) + 'px'; el.style[opp[o.v[0]]] = 'auto';
        el.style[o.h[0]] = (o.h[1] + off[o.h[0]]) + 'px'; el.style[opp[o.h[0]]] = 'auto';
      }
      paint();
    } catch (e) {}
  }
  try { body.setAttribute('data-arcade-bg', toHex(getComputedStyle(body).backgroundColor) || '#0e1016'); } catch (e) {}
  global.addEventListener('resize', function () { setTimeout(layout, 0); });          // после обработчиков игры (они подписаны раньше)
  global.addEventListener('orientationchange', function () { setTimeout(layout, 50); });
  setInterval(paint, 500);                                                              // смена темы игры (T) меняет фон страницы
  layout(); setTimeout(layout, 50); setTimeout(layout, 400);
  global.ArcadeAspect = { ratio: RATIO, stage: function () { return Object.assign({}, stage); }, layout: layout, version: '1.0.0' };
})(typeof window !== 'undefined' ? window : globalThis);
