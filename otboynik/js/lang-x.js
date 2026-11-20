/* Гефест Arcade · языки сверх RU/EN (TR / ES / PT-BR) поверх движка v2.6 — без правки _shared/engine.js.
   Движок знает только ru/en (LANGS в engine.js: ?lang=tr он игнорирует, язык площадки сводит к ru/en).
   Приём: при TR/ES/PT движок работает в режиме 'en' (DOM data-en, ссылка «← Каталог» на EN-каталог, строки движка —
   EN-откат), а таблица strings.en на это время подменяется на «EN + перевод» (ключа нет в переводе → EN).
   Выбор языка: 1) ?lang=tr|es|pt в адресе; 2) язык площадки Platform.lang() (Яндекс 2.14) после init;
   3) сохранённый arcade.lang.x — только если arcade.lang = 'en' (другие игры аркады видят 'en' — EN-откат).
   Цикл L / пункт меню «Язык»: RU → EN → TR → ES → PT → RU. DOM: data-tr / data-es / data-pt (нет атрибута — data-en).
   API: ArcadeLangX.install(g, { tr:{…}, es:{…}, pt:{…} }) → g.lang() — код языка ('ru','en','tr','es','pt').
   Заодно: заголовок g.overlay и подсказка под меню уменьшают кегль под ширину холста (длинные строки TR/ES/PT).
   Файл одинаковый в kaskad/, otboynik/, kladka/ (тесты сравнивают копии). Что нужно от движка — README игры. */
(function (global) {
  'use strict';
  var ORDER = ['ru', 'en', 'tr', 'es', 'pt'], X = { tr: 1, es: 1, pt: 1 }, KEY = 'arcade.lang.x';
  function lsGet(k) { try { return global.localStorage ? global.localStorage.getItem(k) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (!global.localStorage) return; if (v == null) global.localStorage.removeItem(k); else global.localStorage.setItem(k, v); } catch (e) {} }
  function urlCode() {
    try { var m = /[?&]lang=([a-z]{2})(?:[&#]|$)/i.exec((global.location && global.location.search) || ''); return m ? m[1].toLowerCase() : null; } catch (e) { return null; }
  }
  // Длинные строки (TR/ES/PT длиннее RU/EN): заголовок финала/паузы (g.overlay) и подсказка под меню (g.menu._drawHint)
  // уменьшают кегль, пока строка не влезет в ширину холста (у движка кегль фиксированный).
  function fitSize(ctx, s, maxW, size, min, weight, font) {
    while (size > min) { ctx.font = weight + ' ' + size + 'px ' + font; if (ctx.measureText(s).width <= maxW) break; size -= 1; }
    return size;
  }
  function fitText(g) {
    g.overlay = function (title, sub, color) {
      var th = this.th(), c = this.ctx, W = this.W; c.save();
      c.fillStyle = 'rgba(6,8,12,.82)'; c.fillRect(0, 0, W, this.H);
      var sz = fitSize(c, String(title), W - 24, Math.floor(Math.min(44, W / 9)), 14, 800, th.font);
      this.text(title, W / 2, this.H / 2 - 20, { size: sz, align: 'center', color: color || th.accent });
      if (sub) this.text(sub, W / 2, this.H / 2 + 14, { size: fitSize(c, String(sub), W - 24, 15, 10, 600, th.font), align: 'center', color: th.muted, weight: 600 });
      c.restore();
    };
    var M = g.menu; if (!M || !M._hints) return;
    M._drawHint = function (scene) {
      var fn = this._hints[scene]; if (!fn) return; var th = g.th(), lines = fn.call(g) || [];
      for (var i = 0; i < lines.length; i++) {
        var ln = lines[i], txt = typeof ln === 'string' ? ln : ln.text, dim = typeof ln === 'object' && ln && ln.dim; if (!txt) continue;
        g.text(txt, g.W / 2, g.H - 72 + i * 20, { size: fitSize(g.ctx, txt, g.W - 16, 13, 9, 700, th.font), align: 'center', weight: 700, color: dim ? th.muted : th.ink });
      }
    };
  }
  function install(g, extra) {
    var i18n = g.i18n, tables = extra || {}, base = Object.assign({}, i18n.tables.en || {});
    var origSet = i18n.set, origDom = i18n.applyDom;
    i18n.xlang = null;
    function has(l) { return !!(X[l] && tables[l]); }
    function code() { return i18n.xlang || i18n.lang; }
    function domX() {
      var doc = global.document, x = i18n.xlang; if (!x || !doc || !doc.querySelectorAll) return;
      try {
        if (doc.documentElement) doc.documentElement.lang = x;
        var els = doc.querySelectorAll('[data-' + x + ']');
        for (var i = 0; i < els.length; i++) { var v = els[i].getAttribute('data-' + x); if (v != null && els[i].innerHTML !== v) els[i].innerHTML = v; }
      } catch (e) {}
    }
    i18n.applyDom = function () { origDom.call(this); domX(); };
    i18n.set = function (l) {
      if (has(l)) { this.xlang = l; this.tables.en = Object.assign({}, base, tables[l]); lsSet(KEY, l); origSet.call(this, 'en'); return; }
      this.xlang = null; this.tables.en = base;
      if (l === 'ru' || l === 'en') { lsSet(KEY, null); origSet.call(this, l); }
    };
    i18n.toggle = function () {
      var i = ORDER.indexOf(code()), n = i;
      do { n = (n + 1) % ORDER.length; } while (X[ORDER[n]] && !has(ORDER[n]) && n !== i);
      this.set(ORDER[n]); return this.lang;
    };
    i18n.code = code; g.lang = code;
    // начальный выбор (движок уже применил ?lang=ru|en и arcade.lang)
    var u = urlCode();
    if (has(u)) i18n.set(u);
    else if (u === 'ru' || u === 'en') lsSet(KEY, null);
    else { var s = lsGet(KEY); if (has(s) && i18n.lang === 'en') i18n.set(s); }
    // язык площадки (Яндекс 2.14): движок выбрал ru/en; если SDK сказал tr/es/pt — ставим его, иначе снимаем TR/ES/PT
    var PF = g.platform;
    if (PF && !u && typeof PF.init === 'function') PF.init().then(function () {
      var l = String((PF.lang && PF.lang()) || '').slice(0, 2).toLowerCase();
      if (has(l)) i18n.set(l); else if (l && i18n.xlang) i18n.set(i18n.lang);
    }, function () {});
    fitText(g);
    // пункт «Язык: XX» заставки — пять языков (у движка подпись только RU/EN)
    if (g.menu && g.menu.addItem) g.menu.addItem({ key: 'lang', scene: 'title', after: 'play',
      label: function () { return g.t('language', 'Язык') + ': ' + code().toUpperCase(); }, onSelect: function () { i18n.toggle(); } });
    return code;
  }
  global.ArcadeLangX = { install: install, ORDER: ORDER.slice(), KEY: KEY };
})(typeof window !== 'undefined' ? window : globalThis);
