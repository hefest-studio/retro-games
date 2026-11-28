/* ЧЕРТОГ (GLOAMSTAGE) · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js) + рендер обеих тем + звук + площадка.
   Сцены title/pause/win — g.useStandardScreens (титул перерисован); пункты: «Продолжить» (сохранение в начале сцены), в паузе «Сцена заново».
   Ввод: ←→/AD — шаг (удержание повторяет), ↑/W — прыжок через яму, Пробел/X — рычаг (или ждать), Z/Backspace — отмена хода, R — сцена заново;
   геймпад: A — действие, B — отмена (раскладка движка); тач: стик (←→ шаг, ↑ прыжок) + ● действие + ↶ отмена + II пауза.
   Миграция игроков сайта: механика сменилась — прежний рекорд и сохранение сбрасываются один раз (ключ arcade.chertog.ver). */
(function (global) {
  'use strict';
  var C = global.CHERTOG, L = C.logic, R = C.R;
  var VER_KEY = 'arcade.chertog.ver', notice = false;
  try {
    var ls = global.localStorage;
    if (ls.getItem(VER_KEY) !== '2') {
      if (ls.getItem('arcade.best.chertog') || ls.getItem('arcade.save.chertog')) notice = true;
      ls.removeItem('arcade.best.chertog'); ls.removeItem('arcade.save.chertog'); ls.removeItem('arcade.besttime.chertog'); ls.setItem(VER_KEY, '2');
    }
  } catch (e) {}
  var TH = Arcade.themes || {}, Store = Arcade.Store, SAVE = 'arcade.save.chertog', LB = 'chertog';
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0e0820', panel: '#1c1233', ink: '#f6ecd8', muted: '#a698c8', accent: '#ffc94a', good: '#8cf0c0', bad: '#ff6a6a', warn: '#ffd36a', grid: '#2a1c4a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#f8d838', muted: '#a8a8a8', ink: '#ffffff', good: '#58f8a8', bad: '#f85858', warn: '#f8d878' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: R.W, height: R.H, gameId: 'chertog', leaderboard: 'chertog', strings: C.STR, theme: 'modern', lives: 1, themes: themes });
  C.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);
  var stick = global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'));
  var N = C.LEVELS.length, G = null, ui = { msg: null, banner: null, shake: 0 }, msgQ = [], pending = null, latch = { undo: false, restart: false, jump: false, tapX: 0, exp: 0 }, held = {}, prevUp = false, cool = 0;
  function th() { return g.th(); }
  function sync() { if (G) { g.state.score = G.score; g.state.level = G.fi + 1; } }
  function loadSave() { try { var o = JSON.parse(Store.get(SAVE, 'null')); return o && o.v === 2 && o.fi >= 0 && o.fi < N ? o : null; } catch (e) { return null; } }
  function writeSave(o) { Store.set(SAVE, JSON.stringify(Object.assign({ v: 2 }, o))); }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }

  // ---------- Площадка: таблица «chertog», «Без рекламы» (no_ads), реклама за награду (подсказка ходов). Список для Консоли — promo/chertog/platform.json ----------
  g.persist('arcade.best.chertog', 'max');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });
  g.useRewardedBonus({ key: 'rwHint', scene: 'pause', label: function () { return g.t('rwHint'); },
    available: function () { return !!G && G.phase === 'play' && !G.s.dead; }, grant: function () { showHint(); } });
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(17, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  // ---------- сцена-уровень ----------
  function litTarget(G2) { return L.lit(G2.P, G2.s.lamps); }
  function snapVis(G2) {
    var s = G2.s, lit = litTarget(G2), i;
    G2.hv = { x: s.hx, y: Math.min(s.hy, L.H - 1), arc: 0, moving: false, sx: s.hx, sy: s.hy, jump: false };
    G2.gv = s.guards.map(function (q) { return { x: q[0], y: q[1], d: q[2], alive: q[3], dz: !!lit[q[1] * L.W + q[0]] }; });
    G2.lampV = s.lamps.map(function (li, k) { var p = G2.P.lamps[k][li]; return { x: p[0], y: p[1] }; });
    G2.litA = new Float32Array(lit.length); for (i = 0; i < lit.length; i++) G2.litA[i] = lit[i];
    G2.deadT = 0;
  }
  function loadLevel(fi, score) {
    var def = C.LEVELS[fi], P = L.parse(def);
    G = { fi: fi, def: def, P: P, s: L.init(def), hist: [], undos: 0, score: score || 0, base: score || 0, phase: 'play', clearT: 0, hint: null, hv: null, gv: null, lampV: null, litA: null, deadT: 0 };
    snapVis(G); ui.banner = { title: g.t('level').toUpperCase() + ' ' + (fi + 1) + ' · ' + g.t('f_' + def.id), a: 2.0 };
    ui.msg = null; msgQ = [];
    if (fi === 0) { msgQ.push(g.t('tutMove')); }
    if (fi < 4) msgQ.push(g.t('tut' + (fi + 1)));
    writeSave({ fi: fi, score: score || 0 }); sync();
  }
  function onEv(ev) { for (var i = 0; i < ev.length; i++) C.sfx(g, ev[i].t === 'die' ? 'die' : ev[i].t, ev[i]); }
  function act(a) {
    if (!G || G.phase !== 'play' || G.s.dead || G.s.won || busy()) return false;
    var n = L.step(G.P, G.s, a); if (n === G.s) return false;
    G.hist.push(G.s); if (G.hist.length > 400) G.hist.shift();
    var prev = G.s; G.s = n; G.hint = null;
    var ev = n.ev; onEv(ev);
    var hv = G.hv; hv.sx = hv.x; hv.sy = hv.y; hv.jump = ev.some(function (e) { return e.t === 'jump'; });
    if (n.dead) { G.deadT = 0; ui.shake = 0.4; }
    if (n.won) { G.phase = 'clear'; G.clearT = 0; var bonus = 200 + 10 * Math.max(0, G.def.par + 4 - n.moves) + (G.undos === 0 ? 100 : 0); G.score = G.base + bonus; G.bonus = bonus; ui.banner = { title: g.t('clear'), a: 2.4 }; C.sfx(g, 'clear'); g.saveBest && 0; sync(); bestSave(); }
    sync(); return true;
  }
  function bestSave() { g.state.score = G.score; if (g.saveBest) g.saveBest(); lbBest(); }
  function undo() {
    if (!G || G.phase !== 'play' || !G.hist.length) return;
    G.s = G.hist.pop(); G.undos++; G.hint = null; C.sfx(g, 'undo'); G.deadT = 0;
    var keepLit = G.litA; snapVis(G); G.litA = keepLit; G.hv.x = Math.min(G.hv.x, L.W); sync();
  }
  function restart() { if (!G) return; var fi = G.fi, sc = G.base; loadLevel(fi, sc); }
  function showHint() {
    if (!G || G.s.dead) return;
    var sol = L.solve(G.def, { from: G.s, limit: 300000 }); C.sfx(g, 'hint');
    if (sol) { G.hint = sol; ui.msg = { text: g.t('hintOn'), color: th().good, a: 2.2 }; } else ui.msg = { text: g.t('hintEmpty'), color: th().bad, a: 2.2 };
  }
  function busy() { if (!G) return false; if (G.hv.moving) return true; for (var i = 0; i < G.gv.length; i++) if (G.gv[i].moving) return true; return false; }
  function approach(v, t, d) { return v < t ? Math.min(t, v + d) : Math.max(t, v - d); }
  function stepVis(dt) {
    var hv = G.hv, s = G.s, i, lit = litTarget(G), tx = s.hx, ty = Math.min(s.hy, L.H + 1);
    var dx = tx - hv.x, dy = ty - hv.y;
    hv.x = approach(hv.x, tx, dt * (hv.jump ? 9 : 11));
    if (Math.abs(dx) < 0.001 || hv.y !== ty) { var vy = Math.abs(dy) > 0.01 ? (hv.vy || 0) + dt * 40 : 0; hv.vy = vy; hv.y = approach(hv.y, ty, Math.max(dt * 8, vy * dt)); } 
    var total = Math.abs(tx - hv.sx), fr = total > 0.01 ? Math.abs(hv.x - hv.sx) / total : 1;
    hv.arc = hv.jump && total > 0.01 ? Math.sin(Math.min(1, fr) * Math.PI) * 0.5 : 0;
    var mv = Math.abs(tx - hv.x) > 0.02 || Math.abs(ty - hv.y) > 0.02; hv.moving = mv && !(s.dead === 'fall' && hv.y >= L.H - 0.01 && Math.abs(tx - hv.x) < 0.02); if (!mv) { hv.jump = false; hv.vy = 0; }
    if (s.dead === 'fall' && hv.y >= L.H) hv.moving = false;
    for (i = 0; i < G.gv.length; i++) { var q = s.guards[i], v = G.gv[i]; v.alive = q[3]; v.d = q[2]; v.dz = !!lit[q[1] * L.W + q[0]];
      v.x = approach(v.x, q[0], dt * 6); v.y = approach(v.y, q[1], dt * 9); v.moving = Math.abs(v.x - q[0]) > 0.02 || Math.abs(v.y - q[1]) > 0.02; }
    for (i = 0; i < G.lampV.length; i++) { var p = G.P.lamps[i][s.lamps[i]]; G.lampV[i].x = approach(G.lampV[i].x, p[0], dt * 10); G.lampV[i].y = approach(G.lampV[i].y, p[1], dt * 10); }
    for (i = 0; i < lit.length; i++) G.litA[i] = approach(G.litA[i], lit[i], dt * 7);
    if (s.dead) G.deadT += dt;
  }
  function advance() {
    if (G.fi + 1 >= N) { sync(); clearSave(); g.state.score = G.score; g.win(); return; }
    loadLevel(G.fi + 1, G.score);
  }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({ lives: 1 });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  g.menu.addItem({ key: 'continue', after: 'play', label: function () { var sv = loadSave(); return sv ? g.t('cont') + ' · ' + g.t('level').toLowerCase() + ' ' + (sv.fi + 1) : g.t('cont') + ' —'; },
    onSelect: function () { var sv = loadSave(); if (!sv) return; pending = sv; g.goto('play'); } });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); }, onSelect: function () { restart(); g.goto('play', { resume: true }); } });
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var retro = g.themeName === 'retro', Wc = this.W, Hc = this.H, t = this.time, Pc = th(), P = R.PAL[retro ? 'retro' : 'modern'];
    ctx.imageSmoothingEnabled = !retro;
    if (retro) { ctx.fillStyle = '#000020'; ctx.fillRect(0, 0, Wc, Hc); } else { var gr = ctx.createLinearGradient(0, 0, 0, Hc); gr.addColorStop(0, '#2a1850'); gr.addColorStop(1, '#0e0820'); ctx.fillStyle = gr; ctx.fillRect(0, 0, Wc, Hc); }
    // лампа качается, тень героя на стене растёт и уезжает
    var lx = 110 + Math.sin(t * 0.9) * 70, ly = 60, hx = 110, hy = Hc - 56;
    ctx.fillStyle = retro ? '#505090' : 'rgba(246,217,160,.30)'; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(0, Hc); ctx.lineTo(240, Hc); ctx.closePath(); ctx.fill();
    ctx.save(); var sc = 3.4, off = (hx - lx) * 1.8; ctx.translate(hx + off, Hc - 6); ctx.scale(sc, sc * 0.7); ctx.globalAlpha = 0.6; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, -19, 6.5, 0, 6.3); ctx.fill(); ctx.fillRect(-6, -15, 12, 15); ctx.restore(); ctx.globalAlpha = 1;
    ctx.fillStyle = retro ? '#f8f8f8' : '#4a3a78'; ctx.fillRect(0, Hc - 6, 240, 6);
    R.lamp(ctx, (lx - 16) / 32, (ly - 48) / 32 + 0.0 + 0.0, 0, retro, t);
    R.hero(ctx, hx, Hc - 6, 1, { moving: false }, t, retro, P);
    var cx = Wc / 2 + 120;
    this.text(this.t('title'), cx, 56, { size: retro ? 34 : 38, align: 'center', color: Pc.accent, weight: 900, maxWidth: 250 });
    this.text(this.t('subtitle'), cx, 80, { size: retro ? 9 : 10, align: 'center', color: Pc.ink, weight: 700, maxWidth: 270 });
    this.text(this.t('sub2'), cx, 95, { size: retro ? 8 : 9, align: 'center', color: Pc.muted, weight: 600, maxWidth: 270 });
    var mf = menuFit(menu, 116, 20, 108, Hc - 56);
    menu.draw(this, cx, mf[0], mf[1]);
    var foot = this.state.best ? this.t('best') + ': ' + this.state.best : '';
    if (foot) this.text(foot, cx, Hc - 30, { size: 11, align: 'center', color: Pc.warn, weight: 800, maxWidth: 270 });
    if (notice) this.text(this.t('migrated'), cx, Hc - 14, { size: 9, align: 'center', color: Pc.good, weight: 700, maxWidth: 270 });
  };

  // ---------- карточка «сцена пройдена» перед межстраничной ----------
  var cardGoing = false;
  function cardGo() { if (cardGoing || g._sceneName !== 'card') return; cardGoing = true; g.adBreak().then(function () { cardGoing = false; if (g._sceneName === 'card') g.goto('play', { resume: true }); }); }
  g.scene('card', {
    enter: function () { cardGoing = false; },
    press: function (a) { if (a === 'action' || a === 'start') cardGo(); else if (a === 'pause') this.goto('play', { resume: true }); },
    draw: function (ctx) {
      var Pc = th(), retro = g.themeName === 'retro';
      this.clear(); ctx.fillStyle = retro ? '#000020' : '#150c2a'; ctx.fillRect(0, 0, this.W, this.H);
      this.text(this.t('cardClear'), this.W / 2, this.H / 2 - 20, { size: 28, align: 'center', color: Pc.accent, weight: 900, maxWidth: this.W - 40 });
      this.text(this.t('level') + ' ' + (G ? G.fi + 1 + '/' + N + ' · ' + this.t('score') + ': ' + G.score : ''), this.W / 2, this.H / 2 + 10, { size: 14, align: 'center', color: Pc.ink, weight: 700, maxWidth: this.W - 40 });
      this.text(this.t('cardNext'), this.W / 2, this.H / 2 + 40, { size: 12, align: 'center', color: Pc.muted, weight: 600, maxWidth: this.W - 40 });
    }
  });
  g.canvas.addEventListener('pointerdown', function () { if (g._sceneName === 'card') cardGo(); });

  // ---------- игровая сцена ----------
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (!(d && d.resume) || !G) { var sv = pending; pending = null; notice = false; loadLevel(sv ? sv.fi : 0, sv ? sv.score : 0); g.resetRun && g.resetRun(); }
      else if (G.phase === 'clear') advance();
      cool = 0.15;
    },
    press: function (a) {
      if (!G) return;
      if (a === 'pause') { this.pause(); return; }
      if (a === 'action') act('A');
    },
    update: function (dt) {
      if (!G) return;
      var i, dir = this.input.dir, td = stick.active ? { x: Math.abs(stick.x) > 0.35 ? Math.sign(stick.x) : 0, y: stick.y < -0.55 ? -1 : 0 } : null;
      var dx = td ? td.x : dir.x, up = td ? td.y < 0 : dir.y < 0;
      latch.exp -= dt; if (latch.exp <= 0) { latch.tapX = 0; latch.jump = false; }
      if (!dx && latch.tapX) dx = latch.tapX;   // короткое нажатие между кадрами не теряется
      if (ui.msg) { ui.msg.a -= dt; if (ui.msg.a <= 0) ui.msg = null; }
      if (!ui.msg && msgQ.length) ui.msg = { text: msgQ.shift(), color: th().warn, a: 5.5 };
      if (ui.banner) { ui.banner.a -= dt; if (ui.banner.a <= 0) ui.banner = null; }
      if (ui.shake > 0) ui.shake = Math.max(0, ui.shake - dt);
      cool -= dt; stepVis(dt);
      if (latch.undo) { latch.undo = false; undo(); }
      if (latch.restart) { latch.restart = false; restart(); }
      if (up && !prevUp) { latch.jump = true; latch.exp = Math.max(latch.exp, 0.35); }
      if (G.phase === 'play' && !G.s.dead && cool <= 0 && !busy()) {
        var jump = latch.jump, a = null;
        if (jump) a = dx < 0 ? 'UL' : dx > 0 ? 'UR' : 'U'; else if (dx < 0) a = 'L'; else if (dx > 0) a = 'R';
        if (a) { var did = act(a); latch.jump = false; if (did) { cool = 0.03; latch.tapX = 0; } }
      }
      prevUp = up;
      if (G.phase === 'clear') { G.clearT += dt; if (G.clearT > 1.3 && !busy()) { G.phase = 'clearWait'; if (G.fi + 1 < N && g.adReady && g.adReady()) g.goto('card'); else if (g._sceneName === 'play') advance(); } }
      sync();
    },
    draw: function (ctx) {
      if (!G) { this.clear(); return; }
      C.render(g, ctx, { P: G.P, s: G.s, hv: G.hv, gv: G.gv, lampV: G.lampV, litA: G.litA, t: this.time, retro: g.themeName === 'retro', hint: G.hint, ui: ui, fi: G.fi, total: N, id: G.def.id, moves: G.s.moves, par: G.def.par, score: G.score, deadT: G.deadT });
    }
  });

  // ---------- доп. клавиши и тач-кнопки ----------
  addEventListener('keydown', function (e) {
    if (g._sceneName !== 'play') return;
    if (!e.repeat) {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') { latch.tapX = -1; latch.exp = 0.35; } else if (e.code === 'ArrowRight' || e.code === 'KeyD') { latch.tapX = 1; latch.exp = 0.35; }
      else if (e.code === 'ArrowUp' || e.code === 'KeyW') { latch.jump = true; latch.exp = 0.35; }
    }
    if (e.code === 'KeyZ' || e.code === 'Backspace' || e.code === 'KeyU') { if (!e.repeat) latch.undo = true; e.preventDefault(); }
    else if (e.code === 'KeyR') { if (!e.repeat) latch.restart = true; }
    else if (e.code === 'KeyX' || e.code === 'KeyJ') { if (!e.repeat) act('A'); e.preventDefault(); }
  });
  function tap(id, fn) { var b = document.getElementById(id); if (!b) return; var h = function (e) { if (!Arcade.touchOk(e)) return; fn(); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); }
  tap('bUndo', function () { latch.undo = true; });
  tap('bPause', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, padEl = document.querySelector('.pad');
    var padFixed = padEl && getComputedStyle(padEl).position === 'fixed';
    var padH = padEl && !padFixed && getComputedStyle(padEl).display !== 'none' ? padEl.offsetHeight + 16 : 0;
    var w = Math.min(1100, (wrap && wrap.clientWidth) || g.W, (innerHeight - padH - 64) * g.W / g.H);
    w = Math.max(240, Math.floor(w)); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    if (g.i18n.lang !== lastLang) {
      lastLang = g.i18n.lang; document.documentElement.lang = lastLang;
      var b = document.getElementById('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');
    }
    if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();
  g.start('title');
  C.app = { g: g, game: function () { return G; }, ui: ui, load: loadLevel, act: act, undo: undo, busy: busy, step: stepVis, advance: advance, notice: function () { return notice; } };
})(typeof window !== 'undefined' ? window : globalThis);
