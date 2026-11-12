/* Гефест Arcade · кооп-надстройка (локальная, поверх engine.js v2.1, _shared/ не трогает).
   Даёт игре «на двоих за одной клавиатурой»:
   - пункт меню «Игроки: 1/2» в title-меню движка (+ клавиши 1/2 на заставке), выбор хранится
     в localStorage `arcade.players.<gameId>`;
   - раздельный ввод по e.code: у каждого игрока свои клавиши (P1 — стрелки, P2 — WASD);
     в режиме 1 игрока обе раскладки управляют P1;
   - тач-дпад (кнопки [data-d]) управляет только P1; на тач-устройстве без клавиатуры кооп
     заблокирован (только 1 игрок), разблокируется первой же нажатой физической клавишей;
   - подсказку раскладки на заставке.
   Кандидат на подъём в движок: Menu.insert/addItem + g.input по игрокам (см. README игры).
   Использование:
     var co = Arcade.coop(g, { bind:{ p1:{left:['ArrowLeft'],…, fire:['Slash']}, p2:{…} },
       actions:['fire'], repeat:['fire'], touch:{L:'left',R:'right',U:'up',D:'down',A:'fire'},
       hint:{ ru:['…','…'], en:['…','…'] }, pad:document.querySelector('.pad') });
     co.players() → 1|2; co.held(pi,'left') → bool; co.onAction(function(pi,name){…}); co.arm(). */
(function (A) {
  'use strict';
  A.coop = function (g, o) {
    var Store = A.Store, key = 'arcade.players.' + g.gameId;
    var touchOnly = false;
    try { touchOnly = !!(window.matchMedia && matchMedia('(hover: none) and (pointer: coarse)').matches); } catch (e) {}
    var n = Store.get(key, '1') === '2' ? 2 : 1;
    if (touchOnly) n = 1;
    var keys = Object.create(null), touch = Object.create(null), cbs = [], armedAt = 0;
    var actions = o.actions || [], repeat = o.repeat || [];
    // code → [{pi,name}] (P2-клавиши в одиночке тоже ведут P1)
    function lookup(code) {
      var out = [];
      ['p1', 'p2'].forEach(function (p, i) {
        var b = o.bind[p] || {};
        for (var name in b) if (b[name].indexOf(code) >= 0) out.push({ pi: n === 2 ? i : 0, name: name });
      });
      return out;
    }
    function inPlay() { return g._sceneName === 'play' && performance.now() - armedAt > 120; }
    function emit(pi, name) { for (var i = 0; i < cbs.length; i++) cbs[i](pi, name); }
    function setN(v) {
      if (touchOnly && v === 2) { g.audio.beep(200, 0.06); return; }
      n = v === 2 ? 2 : 1; Store.set(key, String(n)); g.audio.beep(700, 0.04);
    }

    // Клавиатура — capture-фаза, чтобы срабатывать раньше обработчика движка.
    addEventListener('keydown', function (e) {
      touchOnly = false; // есть физическая клавиатура — кооп доступен
      var hits = lookup(e.code);
      if (!hits.length) {
        if (g._sceneName === 'title' && (e.code === 'Digit1' || e.code === 'Numpad1')) setN(1);
        if (g._sceneName === 'title' && (e.code === 'Digit2' || e.code === 'Numpad2')) setN(2);
        return;
      }
      keys[e.code] = true;
      if (g._sceneName !== 'play') return;
      e.preventDefault(); // Slash в Firefox — быстрый поиск и т.п.
      if (!inPlay()) return;
      hits.forEach(function (h) {
        if (actions.indexOf(h.name) >= 0 && (!e.repeat || repeat.indexOf(h.name) >= 0)) emit(h.pi, h.name);
      });
    }, true);
    addEventListener('keyup', function (e) { keys[e.code] = false; }, true);
    addEventListener('blur', function () { keys = Object.create(null); touch = Object.create(null); });

    // Тач: те же кнопки [data-d], что и у g.input.bindDpad (меню), — только P1.
    if (o.pad && o.touch) {
      o.pad.querySelectorAll('[data-d]').forEach(function (btn) {
        var name = o.touch[btn.dataset.d]; if (!name) return;
        var on = function (e) { e.preventDefault(); if (touch[name]) return; touch[name] = true; if (inPlay() && actions.indexOf(name) >= 0) emit(0, name); };
        var off = function (e) { e.preventDefault(); touch[name] = false; };
        btn.addEventListener('touchstart', on, { passive: false }); btn.addEventListener('touchend', off, { passive: false });
        btn.addEventListener('touchcancel', off, { passive: false }); btn.addEventListener('mousedown', on);
        btn.addEventListener('mouseup', off); btn.addEventListener('mouseleave', off);
      });
      var pb = o.pad.querySelector('[data-pause]');
      if (pb) {
        var hp = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
        pb.addEventListener('touchstart', hp, { passive: false }); pb.addEventListener('mousedown', hp);
      }
    }

    // Пункт меню «Игроки» — вторым, сразу после «Играть».
    var title = g.scenes.title;
    if (title && title._menu) {
      title._menu.items.splice(1, 0, {
        label: function () { return g.t('players', 'Игроки') + ': ' + n + (touchOnly ? ' · ' + g.t('touch1p', 'тач — 1 игрок') : ''); },
        onSelect: function () { setN(n === 2 ? 1 : 2); }
      });
      var draw0 = title.draw;
      title.draw = function (ctx) {
        draw0.call(this, ctx);
        var lines = (o.hint && (o.hint[g.i18n.lang] || o.hint.ru)) || [];
        if (touchOnly) lines = lines.slice(0, 1);
        for (var i = 0; i < lines.length; i++) {
          var on2 = i === 1 && n === 2;
          g.text(lines[i], g.W / 2, g.H - 72 + i * 20, { size: 13, align: 'center', weight: 700, color: (i === 0 || on2) ? g.th().ink : g.th().muted });
        }
      };
    }

    return {
      players: function () { return n; },
      setPlayers: setN,
      held: function (pi, name) {
        if (pi === 0 && touch[name]) return true;
        var lists = [];
        if (pi === 0) { lists.push(o.bind.p1[name]); if (n === 1) lists.push(o.bind.p2[name]); }
        else if (n === 2) lists.push(o.bind.p2[name]);
        for (var i = 0; i < lists.length; i++) { var l = lists[i] || []; for (var j = 0; j < l.length; j++) if (keys[l[j]]) return true; }
        return false;
      },
      onAction: function (cb) { cbs.push(cb); },
      arm: function () { armedAt = performance.now(); },
      isTouchOnly: function () { return touchOnly; }
    };
  };
})(window.Arcade = window.Arcade || {});
