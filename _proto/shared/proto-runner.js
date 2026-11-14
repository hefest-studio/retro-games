/*
 * Минимальная «песочница» для прототипов оформления «КВЕСТ».
 * Не игра: только чтобы увидеть стиль в движении. Логика — здесь, рисование — в window.KvestTheme.
 *
 * Порядок кадра: drawScene(pass:'back') → drawNpc → drawHero → drawScene(pass:'front')
 *                → drawThought → drawUI → drawCursor.
 * opts для drawScene: { pass: 'back'|'front'|'all', npcSeparate: true, pixelRatio }.
 *   pass:'back'  — небо, слои depth 0..2 и объекты; pass:'front' — слой depth 3 (перед героем).
 * state для drawUI: { inventory:[id], slots:[{x,y,w,h}], hintBtn:{x,y,w,h}, hover, sceneId, mood }.
 *
 * URL: ?scene=1|2 — стартовая сцена; ?shot=1 — режим скриншота (мысль NPC видна всегда,
 *      курсор «использовать» над объектом, без HTML-панели).
 */
(function () {
  'use strict';
  var W = 960, H = 540;
  var T = window.KvestTheme;
  var params = new URLSearchParams(location.search);
  var SHOT = params.get('shot') === '1';
  var scenes = JSON.parse(JSON.stringify(window.KvestDemoScenes));
  var canvas = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var pixelRatio = 1;

  var S = {
    si: Math.max(0, Math.min(scenes.length - 1, (parseInt(params.get('scene'), 10) || 1) - 1)),
    hero: { x: 0, y: 0, dir: 1 },
    target: null, pending: null,
    pose: null, poseUntil: 0,
    heroThought: null,
    npcThought: {},
    inventory: [],
    mouse: { x: -100, y: -100, inside: false },
    hover: null, cursor: 'default'
  };

  var slots = [], i;
  for (i = 0; i < 6; i++) slots.push({ x: 304 + i * 60, y: 12, w: 52, h: 52 });
  var hintBtn = { x: 892, y: 12, w: 52, h: 52 };

  function scene() { return scenes[S.si]; }
  function obj(id) { var o = scene().objects; for (var k = 0; k < o.length; k++) if (o[k].id === id) return o[k]; return null; }

  function walkY(x) {
    var w = scene().walk;
    if (x <= w[0][0]) return w[0][1];
    for (var k = 1; k < w.length; k++) {
      if (x <= w[k][0]) { var a = w[k - 1], b = w[k], f = (x - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * f; }
    }
    return w[w.length - 1][1];
  }
  function clampX(x) { var w = scene().walk; return Math.max(w[0][0], Math.min(w[w.length - 1][0], x)); }

  function enter(idx, fromId) {
    S.si = idx;
    var sc = scene();
    S.hero.x = sc.hero.x;
    if (fromId) { // встаём у двери, через которую пришли
      var hs = sc.hotspots.filter(function (h) { return h.to === fromId; })[0];
      if (hs) S.hero.x = clampX(hs.rect[0] + hs.rect[2] / 2 + 40);
    }
    S.hero.y = walkY(S.hero.x);
    S.hero.dir = 1; S.target = null; S.pending = null;
    S.heroThought = null; S.npcThought = {};
    sc.objects.forEach(function (o) { if (o.kind === 'door') o.state.open = false; });
    var btns = document.querySelectorAll('[data-scene]');
    for (var k = 0; k < btns.length; k++) btns[k].classList.toggle('on', +btns[k].dataset.scene === idx + 1);
  }

  function now() { return performance.now() / 1000; }

  function inRect(p, r) { return p.x >= r[0] && p.x <= r[0] + r[2] && p.y >= r[1] && p.y <= r[1] + r[3]; }
  function inBox(p, b) { return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h; }

  function hotspotAt(p) {
    var hs = scene().hotspots;
    for (var k = hs.length - 1; k >= 0; k--) {
      var h = hs[k], o = obj(h.id);
      if (o && o.kind === 'item' && o.state.taken) continue;
      if (inRect(p, h.rect)) return h;
    }
    return null;
  }

  function hintIcons() {
    var sc = scene();
    if (sc.id === 'yard') {
      var g = obj('gear');
      return g && !g.state.taken ? ['eye', 'gear', 'hand'] : ['gear', 'arrow', 'gate'];
    }
    var m = obj('machine');
    return m && m.state.on ? ['cup', 'arrow', 'cat'] : ['hand', 'lever', 'gear'];
  }

  function showNpcThought(o) { S.npcThought[o.id] = { start: now(), until: now() + 4.2 }; }

  function act(h) {
    var o = obj(h.id), t = now();
    S.hero.dir = (h.rect[0] + h.rect[2] / 2) >= S.hero.x ? 1 : -1;
    if (o && o.kind === 'item') {
      o.state.taken = true;
      if (S.inventory.indexOf(o.item) < 0) S.inventory.push(o.item);
      S.pose = 'happy'; S.poseUntil = t + 1.1; return;
    }
    if (o && o.kind === 'npc') { showNpcThought(o); S.pose = 'think'; S.poseUntil = t + 1.6; return; }
    if (h.to) {
      if (o && o.kind === 'door') o.state.open = true;
      S.pose = 'reach'; S.poseUntil = t + 0.45;
      var target = scenes.map(function (s) { return s.id; }).indexOf(h.to);
      var from = scene().id;
      setTimeout(function () { if (target >= 0) enter(target, from); }, 450);
      return;
    }
    if (o && o.kind === 'gate') o.state.open = !o.state.open;
    if (o && o.kind === 'machine') { o.state.on = !o.state.on; var lv = obj('lever'); if (lv) lv.state.down = o.state.on; }
    if (o && o.kind === 'lever') { o.state.down = !o.state.down; var mc = obj('machine'); if (mc) mc.state.on = o.state.down; }
    S.pose = 'reach'; S.poseUntil = t + 0.6;
  }

  function click(p) {
    if (inBox(p, hintBtn)) { S.heroThought = { icons: hintIcons(), start: now(), until: now() + 3.6 }; return; }
    for (var k = 0; k < slots.length; k++) if (inBox(p, slots[k])) return;
    var h = hotspotAt(p);
    if (h) {
      var cx = h.rect[0] + h.rect[2] / 2;
      var standX = clampX(cx + (cx > S.hero.x ? -36 : 36));
      if (h.to) standX = clampX(cx);
      if (obj(h.id) && obj(h.id).kind === 'npc') standX = clampX(cx - 70);
      S.target = standX; S.pending = h; return;
    }
    if (p.y > 300) { S.target = clampX(p.x); S.pending = null; }
  }

  function toLogical(e) {
    var r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  canvas.addEventListener('pointermove', function (e) { var p = toLogical(e); S.mouse.x = p.x; S.mouse.y = p.y; S.mouse.inside = true; });
  canvas.addEventListener('pointerleave', function () { S.mouse.inside = false; });
  canvas.addEventListener('pointerdown', function (e) { var p = toLogical(e); S.mouse.x = p.x; S.mouse.y = p.y; click(p); });
  window.addEventListener('keydown', function (e) {
    if (e.key === '1') enter(0); else if (e.key === '2') enter(1);
  });
  var btns = document.querySelectorAll('[data-scene]');
  for (i = 0; i < btns.length; i++) btns[i].addEventListener('click', function () { enter(+this.dataset.scene - 1); });

  function resize() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var cw = Math.min(vw, vh * W / H), ch = cw * H / W;
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    pixelRatio = canvas.width / W;
  }
  window.addEventListener('resize', resize);
  resize();

  var last = now(), fpsAcc = 0, fpsN = 0, fpsEl = document.getElementById('fps');
  window.__proto = { fps: 0, state: S, scenes: scenes };

  function update(dt, t) {
    if (S.target !== null) {
      var dx = S.target - S.hero.x, step = 150 * dt;
      if (Math.abs(dx) <= step) {
        S.hero.x = S.target; S.target = null;
        if (S.pending) { var h = S.pending; S.pending = null; act(h); }
      } else { S.hero.x += Math.sign(dx) * step; S.hero.dir = dx > 0 ? 1 : -1; }
      S.hero.y = walkY(S.hero.x);
    }
    // NPC думает сам по таймеру
    scene().objects.forEach(function (o) {
      if (o.kind !== 'npc') return;
      if (SHOT) { if (!S.npcThought[o.id]) S.npcThought[o.id] = { start: t - 2, until: 1e9 }; return; }
      var th = S.npcThought[o.id];
      if (!th) { S.npcThought[o.id] = { start: t + 2.5, until: t + 2.5 + 4.2 }; return; }
      if (t > th.until + 5) S.npcThought[o.id] = { start: t, until: t + 4.2 };
    });
    if (S.heroThought && t > S.heroThought.until) S.heroThought = null;
    // ховер/курсор
    var p = S.mouse;
    S.hover = null; S.cursor = 'default';
    if (SHOT && !S.mouse.inside) { // в режиме скриншота показываем курсор над интерактивным объектом
      var sh = scene().id === 'yard' ? obj('gate') : obj('lever');
      p = { x: sh.x + sh.w * 0.62, y: sh.y + sh.h * 0.45 }; S.mouse.x = p.x; S.mouse.y = p.y; S.mouse.inside = true;
    }
    if (inBox(p, hintBtn)) { S.hover = 'hint'; S.cursor = 'use'; }
    else {
      var hh = hotspotAt(p);
      if (hh) { S.hover = hh.id; S.cursor = hh.cursor; }
    }
  }

  function heroPose(t) {
    if (S.target !== null) return 'walk';
    if (t < S.poseUntil && S.pose) return S.pose;
    if (S.heroThought) return 'think';
    return 'idle';
  }

  function frame() {
    var t = now(), dt = Math.min(0.05, t - last); last = t;
    var t0 = performance.now();
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { window.__proto.fps = Math.round(fpsN / fpsAcc); if (fpsEl) fpsEl.textContent = window.__proto.fps + ' fps'; fpsAcc = 0; fpsN = 0; }
    update(dt, t);
    var sc = scene();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    var opts = { pixelRatio: pixelRatio, npcSeparate: true };
    opts.pass = 'back'; T.drawScene(ctx, sc, t, opts);
    sc.objects.forEach(function (o) {
      if (o.kind !== 'npc') return;
      var th = S.npcThought[o.id];
      T.drawNpc(ctx, o, th && t >= th.start && t < th.until ? 'think' : 'idle', t);
    });
    T.drawHero(ctx, S.hero, heroPose(t), t);
    opts.pass = 'front'; T.drawScene(ctx, sc, t, opts);
    sc.objects.forEach(function (o) {
      if (o.kind !== 'npc') return;
      var th = S.npcThought[o.id];
      if (th && t >= th.start && t < th.until) T.drawThought(ctx, o.x + o.w * 0.5, o.y + 4, o.thought || ['question'], t - th.start);
    });
    if (S.heroThought) T.drawThought(ctx, S.hero.x, S.hero.y - 140, S.heroThought.icons, t - S.heroThought.start);
    T.drawUI(ctx, { inventory: S.inventory, slots: slots, hintBtn: hintBtn, hover: S.hover, sceneId: sc.id, mood: sc.mood }, t);
    if (S.mouse.inside) T.drawCursor(ctx, S.cursor, S.mouse.x, S.mouse.y);
    var ms = performance.now() - t0; window.__proto.ms = window.__proto.ms ? window.__proto.ms * 0.95 + ms * 0.05 : ms;
    requestAnimationFrame(frame);
  }

  if (SHOT) document.documentElement.classList.add('shot');
  if (window.self !== window.top) { var bar = document.querySelector('.bar'); if (bar) bar.style.display = 'none'; } // внутри страницы сравнения — свои кнопки
  enter(S.si);
  if (SHOT) { // в кадре: предмет поднят (виден в инвентаре), герой у объекта
    S.inventory.push(S.si === 0 ? 'key' : 'gear');
    S.hero.x = S.si === 0 ? 520 : 300; S.hero.y = walkY(S.hero.x);
  }
  requestAnimationFrame(frame);
})();
