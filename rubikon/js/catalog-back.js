/* РУБИКОН · помощник кнопки «назад в каталог» (вынесен из inline). */
(function () {
  var link = document.getElementById('catalog-back');
  if (!link) return;

  /* На file:// каталог лежит в index.html корня: «../» открыл бы листинг. */
  if (location.protocol === 'file:') link.setAttribute('href', '../index.html');

  /* Не даём клику/Enter всплывать в игровые обработчики (старт, пауза и т.п.). */
  ['pointerdown', 'click', 'keydown'].forEach(function (type) {
    link.addEventListener(type, function (event) { event.stopPropagation(); }, true);
  });

  /* --- адаптивное размещение, чтобы не перекрывать меню и кнопки игр --- */
  var INTERACTIVE = 'a,button,input,select,textarea,[role="button"],[tabindex],[onclick]';
  link.style.setProperty('transform', 'none', 'important');

  function interactiveBoxes() {
    var boxes = [];
    var nodes = document.querySelectorAll(INTERACTIVE);
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (el === link || el.contains(link)) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      var cs = window.getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.05) continue;
      if (cs.pointerEvents === 'none') continue;
      boxes.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
    }
    return boxes;
  }

  function overlap(a, b) {
    return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  }

  function place() {
    var w = link.offsetWidth;
    var h = link.offsetHeight;
    if (!w || !h) return;
    var W = window.innerWidth;
    var H = window.innerHeight;
    var m = 10;
    var candidates = [
      { name: 'left-mid', left: 0, top: Math.round((H - h) / 2), shape: 'tab' },
      { name: 'bottom-left', left: m, top: H - h - m, shape: 'round' },
      { name: 'top-left', left: m, top: m, shape: 'round' },
      { name: 'bottom-right', left: W - w - m, top: H - h - m, shape: 'round' },
      { name: 'top-right', left: W - w - m, top: m, shape: 'round' },
      { name: 'bottom-center', left: Math.round((W - w) / 2), top: H - h - m, shape: 'round' },
      { name: 'top-center', left: Math.round((W - w) / 2), top: m, shape: 'round' }
    ];
    var boxes = interactiveBoxes();
    var chosen = candidates[0];
    for (var i = 0; i < candidates.length; i += 1) {
      var c = candidates[i];
      var box = { left: c.left, top: c.top, right: c.left + w, bottom: c.top + h };
      var hit = false;
      for (var j = 0; j < boxes.length; j += 1) {
        if (overlap(box, boxes[j])) { hit = true; break; }
      }
      if (!hit) { chosen = c; break; }
    }
    link.style.setProperty('left', chosen.left + 'px', 'important');
    link.style.setProperty('top', chosen.top + 'px', 'important');
    link.classList.toggle('catalog-back-round', chosen.shape === 'round');
    link.dataset.place = chosen.name;
  }

  var timer = 0;
  function schedule() {
    window.clearTimeout(timer);
    timer = window.setTimeout(place, 120);
  }

  place();
  window.setTimeout(place, 350);
  window.setTimeout(place, 1200);
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true });
  document.addEventListener('fullscreenchange', schedule);
})();
