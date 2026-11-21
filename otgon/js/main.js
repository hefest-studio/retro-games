/* ОТГОН · сборка игры на фреймворке Гефест Arcade v2: сцены (заставка с живым фоном, путь, ночёвка у костра, финал),
   ввод (клавиши, тач-крестовина, стик пальцем по канве, тап — идти в точку, кнопки свиста и посоха),
   сохранение по чекпоинтам-турам и ночёвкам, музыка по участкам, связь логики (game.js) с рендером. */
(function (global) {
  'use strict';
  var O = global.OTGON, L = O.logic, RD = O.render;
  var W = 960, H = 540, SAVE = 'otgon.save';

  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'otgon', strings: O.STR, theme: 'modern' });
  O.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  g.fit(980); addEventListener('resize', function () { g.fit(980); });

  // ---------- Сохранение ----------
  function loadSave() { try { var s = localStorage.getItem(SAVE); s = s ? JSON.parse(s) : null; return s && s.v === 1 && s.herd && s.herd.length ? s : null; } catch (e) { return null; } }
  function writeSave(sn) { g.storeSet(SAVE, JSON.stringify(sn)); }   // localStorage сразу + облако площадки
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} if (g.platform) g.storeSet(SAVE, ''); }
  // ---------- облако и мета-прогрессия: выбор участка, звёзды (js/meta.js) ----------
  var Store = Arcade.Store, M = O.meta, START_KEY = 'arcade.otgon.start';
  var prog = M.Progress({ get: function (k) { return Store.get(k, null); }, set: function (k, v) { g.storeSet(k, v); } });
  g.persist(SAVE, 'last'); g.persist(START_KEY, 'last'); g.persist('arcade.best.otgon', 'max');
  for (var lv = 1; lv <= M.LEVELS; lv++) g.persist(M.key(lv), 'max');
  function startLv() { var v = parseInt(Store.get(START_KEY, '1'), 10) || 1; return prog.unlocked(v) ? v : 1; }
  function nextStart(dir) { g.storeSet(START_KEY, prog.next(startLv(), dir || 1)); }
  function legSnap(lv) { var herd = []; for (var i = 0; i < L.HERD; i++) herd.push({ id: i, mark: i, food: 0.9, pep: 0.9 }); return { v: 1, lv: lv, x: 220, herd: herd, gone: [], T: 0 }; }
  var legRec = { lost: 0 }, pendingAlone = false, starNote = null;
  function recordLeg(lv) { var s = game.state(), r = M.stars({ lost: legRec.lost, alive: game.alive().length, total: s.total }), isNew = prog.record(lv + 1, r.n); starNote = { text: M.starStr(r.n) + (isNew ? '  ' + g.t('starNew') : ''), t: 3 }; legRec = { lost: 0 }; }
  // отладка/скриншоты: #at=<участок 1..6>:<x> — начать с точки пути
  function debugSnap() {
    var m = /[#&?]at=(\d+):(\d+)/.exec(location.hash + location.search); if (!m) return null;
    var herd = []; for (var i = 0; i < L.HERD; i++) herd.push({ id: i, mark: i, food: 0.8, pep: 0.8 });
    return { v: 1, lv: Math.max(0, Math.min(L.LEGS.length - 1, +m[1] - 1)), x: +m[2], herd: herd, gone: [], T: 0 };
  }

  var game = null, banners = [], final = null, lastDt = 1 / 60;
  function music(i) { var T = Arcade.otgonTracks; if (T && T[i]) g.audio.setMusic(T[i]); }
  function onEvent(type, d) {
    O.sfx(g, type, d);
    if (type === 'checkpoint') { writeSave(d.save); banners.push({ kind: 'cp', t: 1.8 }); }
    else if (type === 'lost') { legRec.lost++; var s = game.state(), mk = d.id; s.gone.forEach(function (q) { if (q.id === d.id) mk = q.mark; }); banners.push({ kind: 'lost', mark: mk, why: d.why, t: 3.2 }); }
    else if (type === 'leg') music(d.lv);
    else if (type === 'camp') { recordLeg(d.lv); var sn = game.snapshot(); sn.lv = d.lv + 1; sn.x = 220; writeSave(sn); sync(); g.goto('camp'); }
    else if (type === 'win') { recordLeg(game.state().lv); final = d; clearSave(); sync(); g.win(); }
    else if (type === 'alone') { banners.push({ kind: 'alone', t: 2.6 }); }
  }
  function sync() { if (!game) return; var s = game.state(); g.state.score = game.alive().length; g.state.level = s.lv + 1; }
  function newGame(snap) {
    game = O.Game({ rng: L.mulberry32((Date.now() & 0xffff) + 7), onEvent: onEvent, snapshot: snap || null }).start(); O.current = game;
    RD.resetCam(); banners = []; final = null; music(game.state().lv); sync();
    if (!snap) writeSave(game.state().cp);
  }

  // ---------- Стандартные экраны + своя заставка с живым фоном ----------
  g.useStandardScreens({ get subtitle() { return g.t('subtitle'); }, lives: 0 });
  // ---------- Площадка (движок v2.8): «Без рекламы» (товар no_ads) в меню и паузе; таблицы лидеров нет — в игре нет счёта
  // (итог участка — сколько ветроногов дошло из десяти, у всех одинаковый максимум). Список для Консоли — promo/otgon/platform.json.
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  var contItem = { key: 'cont', label: function () { var s = loadSave(); return g.t('cont') + (s ? ' · ' + (s.lv + 1) + '/' + L.LEGS.length : ''); }, onSelect: function () { O._resume = loadSave(); this.goto('play'); }, before: 'play' };
  // пункт «Участок N ★★☆» — с какого участка начинать «Новый путь» (со всем стадом): выбор/тап — следующий открытый, ← → — по кругу
  g.menu.addItem({ key: 'legpick', after: 'play', label: function () { var n = startLv(); return g.t('legPick') + ' ' + n + '/' + L.LEGS.length + '  ' + M.starStr(prog.get(n)); }, onSelect: function () { nextStart(1); } });
  // Реклама за награду (только площадки с рекламой): стадо разбрелось — «ещё один шанс»: двое последних отбившихся снова рядом
  // (иначе — как раньше, возврат к последнему туру); бонус в паузе — вернуть одного отбившегося (раз за партию).
  g.useRewardedContinue({ revive: function () { pendingAlone = false; if (game) game.reviveAd(); } });
  g.useRewardedBonus({ key: 'rwBack', scene: 'pause', label: function () { return g.t('rwBack'); },
    available: function () { return !!game && game.canReturn(); }, grant: function () { if (game) game.returnOne(); } });
  var goEnter = g.scenes.gameover.enter;
  g.scenes.gameover.enter = function (d) { if (pendingAlone) { pendingAlone = false; newGame(loadSave() || (game && game.state().cp)); this.goto('play', { resume: true }); return; } if (goEnter) goEnter.call(this, d); };
  var title = g.scenes.title, menu = title._menu;
  title.press = function (a) { var it = menu && menu.current(); if (it && it.key === 'legpick' && (a === 'left' || a === 'right')) { nextStart(a === 'left' ? -1 : 1); this.audio.beep(600, 0.03); } };
  function refreshMenu() {
    var has = !!loadSave(), items = g.menu.items('title');
    if (has && items.indexOf('cont') < 0) g.menu.addItem(contItem);
    if (!has && items.indexOf('cont') >= 0) g.menu.removeItem('cont');
    var m = g.menu.get('title'); if (m) m.sel = 0;
  }
  var demo = null;
  function newDemo() { var herd = []; for (var i = 0; i < L.HERD; i++) herd.push({ id: i, mark: i, food: 1, pep: 1 }); demo = O.Game({ snapshot: { v: 1, lv: 0, x: 700, herd: herd, gone: [] } }).start(); RD.resetCam(); }
  var oldEnter = title.enter;
  title.enter = function (d) { if (oldEnter) oldEnter.call(this, d); refreshMenu(); newDemo(); };
  title.update = function (dt) { if (!demo) newDemo(); var s = demo.state(); if (s.hero.x > 4300) newDemo(); demo.setMove(1, s.hero.y < 436 ? 0.6 : 0, false); demo.state().herd.forEach(function (c) { c.food = 1; c.pep = 1; }); demo.update(dt); };
  title.draw = function (ctx) {
    if (!demo) newDemo();
    var th = this.th(), retro = this.themeName === 'retro', s = demo.state();
    RD.draw(ctx, s, g, { title: true, dt: 1 / 60 });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.5)' : 'rgba(16,20,26,.42)'; ctx.fillRect(0, 0, W, H);
    var pw = 460, ph = 300, px = (W - pw) / 2, py = 96;
    panel(ctx, px, py, pw, ph, retro);
    this.text(this.t('title'), W / 2, py + 64, { size: 50, align: 'center', color: retro ? '#f8a030' : '#f0a04b', weight: 900 });
    this.text(this.t('subtitle'), W / 2, py + 96, { size: 14, align: 'center', color: th.muted, weight: 600 });
    menu.draw(this, W / 2, py + 134, 26);
    this.text(this.t('starsHint') + ' · ' + prog.total() + '/' + (M.LEVELS * 3) + (this.state.best ? '   ' + this.t('best') + ': ' + this.state.best + ' ' + this.t('of') + ' ' + L.HERD : ''), W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600, maxWidth: pw - 24 });
    this.text(this.t(this.input.touchOnly ? 'hintTouch' : 'hint'), W / 2, this.input.touchOnly ? 20 : H - 14, { size: 12, align: 'center', color: '#e8ecee', weight: 600 }); // на телефоне — подсказка про тач, сверху (низ занят кнопками)
  };
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function panel(ctx, px, py, pw, ph, retro) {
    if (retro) { ctx.fillStyle = '#181028'; ctx.fillRect(px, py, pw, ph); ctx.fillStyle = '#f8a030'; ctx.fillRect(px, py, pw, 4); ctx.fillRect(px, py + ph - 4, pw, 4); ctx.fillRect(px, py, 4, ph); ctx.fillRect(px + pw - 4, py, 4, ph); }
    else { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 30; ctx.fillStyle = 'rgba(22,28,34,.9)'; rr(ctx, px, py, pw, ph, 18); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#3d6f78'; ctx.lineWidth = 1.5; rr(ctx, px + 0.5, py + 0.5, pw - 1, ph - 1, 18); ctx.stroke(); }
  }

  // ---------- Путь ----------
  var stick = null, runLock = false;
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (d && d.resume) return;
      var snap = O._resume || debugSnap(); O._resume = null; legRec = { lost: 0 }; pendingAlone = false; g.resetRun();   // «раз за партию» — и для «Продолжить»
      if (!snap) { clearSave(); if (startLv() > 1) snap = legSnap(startLv() - 1); }
      newGame(snap);
    },
    press: function (a) { if (a === 'pause') this.pause(); else if (a === 'action' && game) game.whistle(); },
    update: function (dt) {
      if (!game) return; lastDt = dt;
      var inp = this.input, dx = inp.dir.x, dy = inp.dir.y, run = !!(inp.codes.ShiftLeft || inp.codes.ShiftRight) || runLock;
      if (stick && stick.mag > 0.18) { dx = stick.x; dy = stick.y; run = run || stick.mag > 0.9; }
      game.setMove(dx, dy, run);
      game.update(dt);
      var s = game.state();
      if (s.phase === 'alone') { s.aloneT = (s.aloneT || 0) + dt; if (s.aloneT > 2.4 && !pendingAlone) { s.aloneT = -99; pendingAlone = true; g.gameover(); return; } }   // «ещё один шанс» (площадка) или возврат к туру
      if (s.lv === L.LEGS.length - 1 && s.hero.x > 7000 && !s._fin) { s._fin = true; music(6); }
      O.ambience(g, s, dt);
      for (var i = banners.length - 1; i >= 0; i--) { banners[i].t -= dt; if (banners[i].t <= 0) banners.splice(i, 1); }
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var s = game.state(); RD.draw(ctx, s, g, { dt: lastDt });
      drawBanners(ctx, s);
      if (starNote && starNote.t > 0) { starNote.t -= lastDt; this.text(starNote.text, W / 2, 40, { size: 22, align: 'center', color: '#f0a04b', weight: 900, maxWidth: W - 40 }); }
      if (s.lv === 0 && s.T < 45 && s.hero.x < 2000 && !this.input.touchOnly) drawKeys(ctx, s, this);
      if (stick && stick.mag > 0.05) { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(stick.ox, stick.oy, 46, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.arc(stick.ox + stick.x * stick.mag * 46, stick.oy + stick.y * stick.mag * 46, 16, 0, 7); ctx.fill(); }
    }
  });
  // баннеры-пиктограммы: тур (чекпоинт), ушедшее существо (метка гаснет), стадо разбрелось
  function drawBanners(ctx, s) {
    var P = RD.PAL[g.themeName === 'retro' ? 'retro' : 'modern'], y = 58;
    banners.forEach(function (b) {
      var a = Math.min(1, b.t * 1.5); ctx.save(); ctx.globalAlpha = a;
      if (b.kind === 'cp') { var x = W - 44; ctx.fillStyle = P.hud; rr(ctx, x - 22, y, 44, 44, 8); ctx.fill(); ctx.fillStyle = P.stoneD; el(ctx, x, y + 34, 12, 5); ctx.fillStyle = P.stone; el(ctx, x, y + 26, 9, 4.5); ctx.fillStyle = P.stoneD; el(ctx, x, y + 19, 6, 3.6); ctx.fillStyle = P.lamp; el(ctx, x, y + 11, 3, 4); }
      else if (b.kind === 'lost') { var lx = W / 2; ctx.fillStyle = P.hud; rr(ctx, lx - 44, y, 88, 44, 8); ctx.fill(); ctx.globalAlpha = a * (0.35 + 0.65 * Math.min(1, b.t / 3.2)); RD.mark(ctx, b.mark, lx - 18, y + 22, 10, P.marks[b.mark % P.marks.length]); ctx.globalAlpha = a; ctx.strokeStyle = P.hudM; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(lx + 4, y + 22); ctx.lineTo(lx + 30, y + 22); ctx.moveTo(lx + 22, y + 14); ctx.lineTo(lx + 30, y + 22); ctx.lineTo(lx + 22, y + 30); ctx.stroke(); }
      else if (b.kind === 'alone') { ctx.fillStyle = 'rgba(10,12,18,' + (0.6 * (1 - b.t / 2.6)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
      ctx.restore();
    });
  }
  // подсказка без слов в начале пути: клавиши и их пиктограммы (идти, бег, свист, посох)
  function drawKeys(ctx, s, eng) {
    var P = RD.PAL[g.themeName === 'retro' ? 'retro' : 'modern'], a = Math.min(1, (45 - s.T) / 4, s.T / 1.5), y = H - 84, x = W / 2 - 250;
    ctx.save(); ctx.globalAlpha = a * 0.92; ctx.fillStyle = P.hud; rr(ctx, x - 16, y - 12, 532, 52, 12); ctx.fill();
    function cap(cx, w, label) { ctx.fillStyle = P.hudL; rr(ctx, cx, y, w, 28, 6); ctx.fill(); eng.text(label, cx + w / 2, y + 19, { size: 13, align: 'center', color: '#20242c', weight: 800 }); return cx + w + 8; }
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = P.hudL;
    var cx = cap(x, 62, '← ↑ ↓ →'); ctx.fillStyle = P.hat; el(ctx, cx + 8, y + 7, 7, 2.6); ctx.fillStyle = P.coat; ctx.fillRect(cx + 4, y + 10, 8, 11); ctx.beginPath(); ctx.moveTo(cx + 5, y + 21); ctx.lineTo(cx + 2, y + 28); ctx.moveTo(cx + 11, y + 21); ctx.lineTo(cx + 14, y + 28); ctx.stroke();
    cx = cap(cx + 38, 48, 'Shift'); ctx.fillStyle = P.accent; for (var i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * 9, y + 7); ctx.lineTo(cx + 9 + i * 9, y + 14); ctx.lineTo(cx + i * 9, y + 21); ctx.closePath(); ctx.fill(); }
    cx = cap(cx + 42, 86, 'Space'); ctx.fillStyle = P.hudL; el(ctx, cx + 4, y + 14, 3, 3); for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(cx + 4, y + 14, 7 + k * 4, -0.7, 0.7); ctx.stroke(); }
    cx = cap(cx + 42, 30, 'E'); ctx.beginPath(); ctx.moveTo(cx + 2, y + 26); ctx.lineTo(cx + 12, y + 4); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 15, y + 4, 3, 3.14, 6.9); ctx.stroke();
    ctx.strokeStyle = P.accent; ctx.beginPath(); ctx.moveTo(cx + 24, y + 14); ctx.lineTo(cx + 44, y + 14); ctx.moveTo(cx + 37, y + 8); ctx.lineTo(cx + 44, y + 14); ctx.lineTo(cx + 37, y + 20); ctx.stroke();
    ctx.restore();
  }
  function el(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832); ctx.fill(); }

  // ---------- Ночёвка у костра: стадо отдыхает, можно сменить метки ----------
  var campSel = 0, campT = 0;
  // межстраничная — по выходу с ночёвки (действие игрока)
  function campGo() { if (game && game.state().phase === 'camp') g.adBreak(); if (game && game.nextLeg()) { RD.resetCam(); g.goto('play', { resume: true }); music(game.state().lv); g.audio.music.play(true); } }
  function campMark(dir) { var a = game.alive(); if (!a.length) return; var c = a[campSel % a.length]; game.setMark(c.id, c.mark + dir); O.sfx(g, 'mark'); var sn = loadSave(); if (sn) { sn.herd.forEach(function (h) { if (h.id === c.id) h.mark = c.mark; }); writeSave(sn); } }
  g.scene('camp', {
    realtime: true,
    enter: function () { campSel = 0; campT = 0; },
    press: function (a) {
      var n = game ? game.alive().length : 0; if (!n) return;
      if (a === 'left') campSel = (campSel + n - 1) % n; else if (a === 'right') campSel = (campSel + 1) % n;
      else if (a === 'up') campMark(1); else if (a === 'down') campMark(-1);
      else if ((a === 'start' || a === 'action') && campT > 0.6) campGo();
    },
    update: function (dt) { campT += dt; if (game) game.state().t += dt; },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var s = game.state(), retro = this.themeName === 'retro', P = RD.PAL[retro ? 'retro' : 'modern'], th = this.th(), a = game.alive();
      RD.draw(ctx, s, g, { title: true, night: true, dt: 1 / 60 });
      ctx.fillStyle = retro ? 'rgba(8,8,40,.6)' : 'rgba(12,16,40,.55)'; ctx.fillRect(0, 0, W, H);
      var pw = 760, ph = 250, px = (W - pw) / 2, py = 150;
      panel(ctx, px, py, pw, ph, retro);
      this.text(this.t('camp') + ' · ' + this.t('leg') + ' ' + (s.lv + 1) + '/' + L.LEGS.length, W / 2, py + 40, { size: 24, align: 'center', color: retro ? '#f8a030' : '#f0a04b', weight: 900 });
      RD.campfire(ctx, px + pw - 44, py + 64, P, s.t, retro, false, null);
      var n = s.total, gap = 70, x0 = W / 2 - (n - 1) * gap / 2, gone = {}; s.gone.forEach(function (q) { gone[q.id] = q; });
      for (var i = 0; i < n; i++) {
        var cr = null; s.herd.forEach(function (q) { if (q.id === i) cr = q; });
        var x = x0 + i * gap, y = py + 128, ok = cr && cr.st === 'ok', idx = ok ? a.indexOf(cr) : -1;
        if (idx === campSel) { ctx.strokeStyle = P.accent; ctx.lineWidth = 2.5; rr(ctx, x - 30, y - 62, 60, 96, 10); ctx.stroke(); ctx.fillStyle = P.accent; ctx.beginPath(); ctx.moveTo(x - 6, y - 68); ctx.lineTo(x + 6, y - 68); ctx.lineTo(x, y - 76); ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 6, y + 40); ctx.lineTo(x + 6, y + 40); ctx.lineTo(x, y + 48); ctx.fill(); }
        var view = { id: i, temper: L.TEMPERS[i], mark: ok ? cr.mark : (gone[i] && gone[i].mark != null ? gone[i].mark : i), face: 1, vx: 0, vy: 0, ph: 0 };
        RD.creature(ctx, view, x - 2, y, P, s.t, { scale: 1.5, sleep: ok, ghost: !ok });
        if (ok) { RD.mark(ctx, cr.mark, x, y + 20, 8, P.marks[cr.mark % P.marks.length]); temperIcon(ctx, L.TEMPERS[i], x + 20, y - 48, P); }
      }
      if (starNote && starNote.t > 0) this.text(starNote.text, W / 2, py + 64, { size: 16, align: 'center', color: th.ink, weight: 800 });
      this.text(this.t(this.input.touchOnly ? 'campHintTouch' : 'campHint'), W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600 });
    }
  });
  // значок нрава: вожак — колокольчик, упрямец — крестик, пугливый — «!», обжора — травинки, копуша — дуги сна
  function temperIcon(ctx, tp, x, y, P) {
    ctx.save(); ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.strokeStyle = P.hudL; ctx.fillStyle = P.hudL;
    if (tp === 'lead') { ctx.fillStyle = P.bell; el(ctx, x, y, 4, 4); ctx.fillRect(x - 1, y + 3, 2, 3); }
    else if (tp === 'stubborn') { ctx.beginPath(); ctx.moveTo(x - 3.5, y - 3.5); ctx.lineTo(x + 3.5, y + 3.5); ctx.moveTo(x + 3.5, y - 3.5); ctx.lineTo(x - 3.5, y + 3.5); ctx.stroke(); }
    else if (tp === 'timid') { ctx.strokeStyle = P.bad; ctx.fillStyle = P.bad; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 1); ctx.stroke(); el(ctx, x, y + 4.5, 1.2, 1.2); }
    else if (tp === 'glutton') { ctx.strokeStyle = P.grassL; ctx.beginPath(); ctx.moveTo(x - 3, y + 4); ctx.lineTo(x - 4, y - 3); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 5); ctx.moveTo(x + 3, y + 4); ctx.lineTo(x + 4, y - 3); ctx.stroke(); }
    else if (tp === 'dawdler') { ctx.strokeStyle = P.waterL; ctx.beginPath(); ctx.arc(x - 2, y + 2, 3, 3.6, 5.8); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 3, y - 3, 2.2, 3.6, 5.8); ctx.stroke(); }
    ctx.restore();
  }

  // ---------- Финал: летнее пастбище, кто дошёл ----------
  var win = g.scenes.win, winEnter = win.enter;
  win.enter = function (d) { if (winEnter) winEnter.call(this, d); O.sfx(g, 'win'); };
  win.update = function (dt) { if (game) { var s = game.state(); s.t += dt; s.herd.forEach(function (c) { if (c.st === 'ok') { c.graze = true; c.vx = c.vy = 0; } }); } };
  win.draw = function (ctx) {
    if (!game) { this.clear(); return; }
    var s = game.state(), retro = this.themeName === 'retro', P = RD.PAL[retro ? 'retro' : 'modern'], th = this.th();
    RD.draw(ctx, s, g, { title: true, dt: 1 / 60 });
    ctx.fillStyle = retro ? 'rgba(0,0,0,.35)' : 'rgba(16,20,26,.28)'; ctx.fillRect(0, 0, W, H);
    var pw = 560, ph = 190, px = (W - pw) / 2, py = 60, home = game.alive().length;
    panel(ctx, px, py, pw, ph, retro);
    this.text(this.t('win'), W / 2, py + 48, { size: 32, align: 'center', color: retro ? '#f8a030' : '#f0a04b', weight: 900 });
    this.text(this.t('home') + ': ' + home + ' ' + this.t('of') + ' ' + s.total, W / 2, py + 84, { size: 18, align: 'center', color: th.ink, weight: 800 });
    var gone = {}; s.gone.forEach(function (q) { gone[q.id] = q; });
    for (var i = 0; i < s.total; i++) { var cr = null; s.herd.forEach(function (q) { if (q.id === i) cr = q; }); var ok = cr && cr.st === 'ok', mk = cr ? cr.mark : i, x = W / 2 - (s.total - 1) * 21 + i * 42; ctx.globalAlpha = ok ? 1 : 0.25; RD.mark(ctx, mk, x, py + 122, 10, ok ? P.marks[mk % P.marks.length] : P.hudM); ctx.globalAlpha = 1; }
    var T = final && final.time || s.T || 0;
    this.text(Math.floor(T / 60) + ':' + ('0' + Math.floor(T % 60)).slice(-2) + (this.state.best ? '   ·   ' + this.t('best') + ': ' + this.state.best + ' ' + this.t('of') + ' ' + s.total : ''), W / 2, py + 164, { size: 13, align: 'center', color: th.muted, weight: 600 });
    this.text(this.t('tapstart'), W / 2, H - 20, { size: 12, align: 'center', color: '#e8ecee', weight: 600 });
  };

  // ---------- Клавиши посоха/свиста, тач-кнопки, стик и тап по канве ----------
  addEventListener('keydown', function (e) {
    if (g._sceneName !== 'play' || !game || e.repeat) return;
    if (e.code === 'KeyE' || e.code === 'KeyF' || e.code === 'KeyX') game.staff();
    else if (e.code === 'KeyQ' || e.code === 'KeyZ') game.whistle();
  });
  function hold(id, fn) { var b = document.getElementById(id); if (!b) return; var h = function (e) { e.preventDefault(); fn(b); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); }
  hold('bWhistle', function () { if (g._sceneName === 'play' && game) game.whistle(); else if (g._sceneName === 'camp') campGo(); });
  hold('bStaff', function () { if (g._sceneName === 'play' && game) game.staff(); });
  hold('bRun', function (b) { runLock = !runLock; b.classList.toggle('on', runLock); });
  hold('bPause', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

  var cv = g.canvas, ptr = null;
  function pos(clientX, clientY) { var r = cv.getBoundingClientRect(); return { x: (clientX - r.left) * W / r.width, y: (clientY - r.top) * H / r.height }; }
  function campTap(p) {
    var s = game.state(), a = game.alive(), n = s.total, gap = 70, x0 = W / 2 - (n - 1) * gap / 2;
    if (campT > 0.6 && p.x > 740 && p.x < 856 && p.y > 160 && p.y < 240) { campGo(); return; } // сам костёр с шалашом (816, 214) — «тап по костру»: раньше попадал в ряд существ и не срабатывал
    if (p.y > 216 && p.y < 330) { var i = Math.round((p.x - x0) / gap), cr = null; s.herd.forEach(function (q) { if (q.id === i && q.st === 'ok') cr = q; }); if (cr) { var idx = a.indexOf(cr); if (idx === campSel) campMark(1); else campSel = idx; return; } }
    if (campT > 0.6 && (p.y > 330 || p.y < 150)) campGo();
  }
  function down(clientX, clientY) {
    var p = pos(clientX, clientY);
    if (g._sceneName === 'camp' && game) { campTap(p); return; }
    if (g._sceneName !== 'play' || !game) return;
    ptr = { x: p.x, y: p.y, t: performance.now(), moved: false }; stick = { ox: p.x, oy: p.y, x: 0, y: 0, mag: 0 };
  }
  function move(clientX, clientY) {
    if (!ptr || !stick) return; var p = pos(clientX, clientY), dx = p.x - ptr.x, dy = p.y - ptr.y, d = Math.hypot(dx, dy);
    if (d > 12) ptr.moved = true;
    stick.mag = Math.min(1, d / 46); stick.x = d ? dx / d : 0; stick.y = d ? dy / d : 0;
  }
  function up() {
    if (ptr && !ptr.moved && performance.now() - ptr.t < 400 && game && g._sceneName === 'play') { var w = RD.toWorld(game.state(), ptr.x, ptr.y); game.moveTo(w.x, w.y); }
    ptr = null; stick = null;
  }
  cv.addEventListener('mousedown', function (e) { down(e.clientX, e.clientY); });
  addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
  addEventListener('mouseup', up);
  cv.addEventListener('touchstart', function (e) { if (g._sceneName === 'play' || g._sceneName === 'camp') { e.preventDefault(); var t0 = e.changedTouches[0]; down(t0.clientX, t0.clientY); } }, { passive: false });
  cv.addEventListener('touchmove', function (e) { if (ptr) { e.preventDefault(); var t0 = e.changedTouches[0]; move(t0.clientX, t0.clientY); } }, { passive: false });
  cv.addEventListener('touchend', function (e) { if (ptr) { e.preventDefault(); up(); } }, { passive: false });
  cv.addEventListener('touchcancel', function () { ptr = null; stick = null; });

  // P / Esc на паузе — продолжить
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // подпись под канвой — язык
  var lastLang = null;
  function syncDom() { if (lastLang === g.i18n.lang) return; lastLang = g.i18n.lang; var f = document.getElementById('foot'); if (f) f.textContent = g.t('foot') + ' ' + g.t('hint') + '.'; }   // <title> не трогаем: в сборке под площадку он задан по языку (5.1.3)
  g.onCloud(function () { if (g._sceneName === 'title') refreshMenu(); });
  syncDom(); setInterval(syncDom, 250);

  g.start('title');
})(window);
