/* ЛАЗУТЧИК · сборка: фреймворк Гефест Arcade (engine.js) + логика (map.js, game.js) + рендер обеих тем + звук.
   Сцены движка: title (перерисован, пункт «Сложность»), pause (+ «Заново»), win, gameover (перерисованы); свои: brief, play.
   Ввод: ←→/AD — шаг; Shift — бег; ↓/S — присесть/красться (на люке — открыть); ↑/W — лестница, лифт, дрезина, рычаг, будильник;
   Пробел/X/J — рука (↑ + рука — бросок); C/K — нога (↓ + нога — подсечка); Z — предмет; F — фонарик.
   Тач: дпад + кнопки РУКА, НОГА, ВЕЩЬ, БЕГ (переключатель), СВЕТ, II — пауза.
   Рекорд времени — по сложности, localStorage `lazutchik.time.d<N>` (секунды); счёт — рекорд движка. */
(function (global) {
  'use strict';
  var LZ = global.LZ, L = LZ.logic, R = LZ.R, FX = R.FX, VW = R.VW, VH = R.VH, E = R.E, Store = Arcade.Store;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#0b0e14', panel: '#141a24', ink: '#eef2f8', muted: '#9aa6b8', accent: '#e0a23a', grid: '#1e2634', good: '#6fd38c', bad: '#ff6a5a', warn: '#ffcf5a' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: E.y, muted: E.l, ink: E.w, good: E.Gl, bad: E.R, warn: E.y })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'lazutchik', strings: LZ.STR, theme: 'modern', lives: 3, themes: themes });
  LZ.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  var diff = Math.max(1, Math.min(5, Store.getNum('lazutchik.diff', 1) | 0));
  var game = null, banner = null, tip = null, tipsShown = {}, playSince = 0, shake = 0, endT = -1, result = null;
  var held = {}, pad = { run: false };
  function S() { return game.state(); }
  function retro() { return g.themeName === 'retro'; }
  function col(m, r) { return retro() ? r : m; }
  function bestTime(d) { return Store.getNum('lazutchik.time.d' + d, 0); }
  function showBanner(title, sub, dur, color) { banner = { title: title, sub: sub, a: dur || 2.4, dur: dur || 2.4, color: color }; }
  function showTip(text, dur, key) { if (key) { if (tipsShown[key]) return; tipsShown[key] = 1; } tip = { text: text, a: dur || 3 }; }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.diff; }

  function onEvent(type, d) {
    d = d || {};
    LZ.sfx(g, type, d);
    var s = game ? S() : null, P = s && s.hero;
    switch (type) {
      case 'screen': if (s && s.time > 1) { var sc = L.screenAt(s.map, P.x, P.y); if (sc && !tipsShown['z' + sc.zone]) { tipsShown['z' + sc.zone] = 1; showBanner(g.t('z_' + sc.zone), '', 1.4); } } break;
      case 'noise': FX.ring(d.x, d.y, d.r, col(d.src === 'step' ? 'rgba(255,255,255,.5)' : 'rgba(255,200,120,.7)', d.src === 'step' ? E.l : E.y)); break;
      case 'hit': FX.add(d.x, d.y, { n: 8, sp: 110, c: col('#ffe066', E.y), r: 2, life: 0.3 }); shake = 0.08; break;
      case 'block': FX.pop(g.t('m_block'), d.x, d.y - 60, col('#cfe0ff', E.c)); break;
      case 'whiff': FX.pop(g.t('m_whiff'), d.x, d.y - 40, col('#cfd8e6', E.l)); break;
      case 'tooHeavy': FX.pop(g.t('m_heavy'), d.x, d.y - 80, col('#cfd8e6', E.l)); break;
      case 'duck': FX.pop(g.t('m_duck'), d.x, d.y - 50, col('#9fd8ff', E.c)); break;
      case 'ko': FX.pop((d.how === 'takedown' ? g.t('m_take') + ' ' : '') + '+' + d.pts, d.x, d.y - 60, col('#ffcf5a', E.y), d.how === 'takedown'); FX.add(d.x, d.y - 20, { n: 10, sp: 60, c: col('#c8ccd4', E.l), r: 4, puff: true, g: -30, life: 0.7 }); break;
      case 'hurt': FX.add(d.x, d.y - 30, { n: 10, sp: 120, c: col('#ff6a5a', E.R), r: 2 }); shake = 0.15; break;
      case 'die': FX.add(d.x, d.y - 30, { n: 22, sp: 160, c: col('#3a5590', E.B), r: 2.4 }); break;
      case 'spot': FX.pop('!', d.x, d.y - 90, col('#ff5a4a', E.R), true); showTip(g.t('m_hint2'), 4, 'h2'); break;
      case 'alarm': shake = 0.15; showBanner(g.t('alarm'), '', 1.2, col('#ff5a4a', E.R)); break;
      case 'calm': FX.pop(g.t('m_calm'), P.x, P.y - 70, col('#9fe0b0', E.Gl)); break;
      case 'door': FX.add(d.x, d.y - 40, { n: 8, sp: 60, c: col('#ffe9a0', E.Y), r: 2, life: 0.4, g: 0 }); break;
      case 'locked': showTip(g.t('m_locked') + g.t('c_' + d.color), 1.6); break;
      case 'grateLocked': showTip(g.t('m_grate'), 2); break;
      case 'grate': showTip(g.t('m_grateOpen'), 2); break;
      case 'hatch': FX.add(d.x, d.y, { n: 8, sp: 60, c: col('#8a8e94', E.g), r: 3, puff: true, g: -10, life: 0.5 }); break;
      case 'land': if (d.h > 80 || d.hatch) FX.add(d.x, d.y, { n: 6, sp: 50, a: -Math.PI / 2, spread: 2.6, c: col('#c8ccd4', E.l), r: 3, puff: true, g: 0, life: 0.35 }); break;
      case 'liftEnd': showTip(g.t('m_liftEnd'), 1.4); break;
      case 'cartCall': showTip(g.t('m_cartCall'), 2); break;
      case 'pick': FX.pop(g.t('i_' + d.k), d.x, d.y - 30, col('#e8eef8', E.w)); break;
      case 'clang': FX.add(d.x, d.y, { n: 6, sp: 120, c: col('#ffe9a0', E.Y), r: 1.5, life: 0.25 }); break;
      case 'thermos': FX.pop(g.t('m_thermos'), d.x, d.y - 40, col('#7ae0a0', E.Gl)); break;
      case 'card': showBanner(g.t('m_card') + g.t('c_' + d.color), '', 1.6, col(d.color === 'red' ? '#ff7a6a' : d.color === 'blue' ? '#7aa8ff' : '#ffd860', d.color === 'red' ? E.R : d.color === 'blue' ? E.B : E.y)); break;
      case 'matrix': showBanner(g.t('m_matrix'), '', 3, col('#ffd860', E.y)); FX.add(d.x, d.y - 60, { n: 30, sp: 140, c: col('#ffd860', E.y), r: 2.2, life: 0.8 }); break;
      case 'needMatrix': showTip(g.t('m_needMatrix'), 2); break;
      case 'planted': showBanner(g.t('m_planted'), g.t('m_short'), 4, col('#ff8a6a', E.R)); shake = 0.2; break;
      case 'tired': showTip(g.t('m_tired'), 1); break;
      case 'noItem': showTip(g.t('m_noItem'), 1); break;
      case 'flash': showTip(g.t(d.on ? 'm_flashOn' : 'm_flashOff'), 1.6); break;
      case 'respawn': FX.clear(); break;
      case 'win': case 'gameover': sync(); endT = 1.4; result = { type: type, d: d }; break;
    }
    sync();
  }
  function newGame() { game = LZ.Game({ diff: diff, onEvent: onEvent }); FX.clear(); banner = null; tip = null; tipsShown = {}; shake = 0; endT = -1; result = null; game.start(); LZ.current = game; sync(); }
  function inPlay() { return g._sceneName === 'play' && game && g.time - playSince > 0.15 && !S().over; }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({ lives: 3 });
  g.menu.addItem({ key: 'diff', after: 'play', label: function () { return g.t('diff') + ': ' + g.t('d' + diff); }, onSelect: function () { setDiff(diff % 5 + 1); } });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('play') + ' — ' + g.t('d' + diff) + ' ↺'; }, onSelect: function () { newGame(); g.goto('brief'); } });
  function setDiff(v) { diff = v; Store.set('lazutchik.diff', String(diff)); g.audio.beep(660, 0.04); }
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  var basePauseDraw = g.scenes.pause.draw;
  g.scenes.pause.draw = function (ctx) {
    basePauseDraw.call(this, ctx);
    this.text(g.t('hint'), VW / 2, VH - 14, { size: retro() ? 9 : 10, align: 'center', color: this.th().muted, weight: 600 });
  };

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.press = function (a) { if (a === 'left') setDiff(diff === 1 ? 5 : diff - 1); if (a === 'right') setDiff(diff % 5 + 1); };
  title.draw = function (ctx) {
    var rt = retro(), Wc = this.W, Hc = this.H, th = this.th(), time = this.time;
    // сцена: склад ночью — Филин присел за ящиками, мимо проходит вахтёр с конусом взгляда
    ctx.fillStyle = rt ? '#000' : '#0b0e14'; ctx.fillRect(0, 0, Wc, Hc);
    if (!rt) { var gr = ctx.createLinearGradient(0, 0, 0, Hc); gr.addColorStop(0, '#0d1220'); gr.addColorStop(1, '#1b1612'); ctx.fillStyle = gr; ctx.fillRect(0, 0, Wc, Hc); }
    for (var i = 0; i < 40; i++) { ctx.fillStyle = rt ? (i % 2 ? E.n : E.k) : (i % 2 ? '#1c1a1a' : '#181717'); ctx.fillRect(i * 16, 150, 15, 170); }
    ctx.fillStyle = rt ? E.d : '#2a2a2e'; ctx.fillRect(0, 320, Wc, 40); ctx.fillStyle = rt ? E.g : '#55555c'; ctx.fillRect(0, 320, Wc, 4);
    R.cover(ctx, { tx: 2, ty: 8, w: 2, h: 2, kind: 'crate' }, null, rt);
    var gx = 330 + Math.sin(time * 0.45) * 150, gf = Math.cos(time * 0.45) > 0 ? 1 : -1;
    var ge = { k: 'boxer', x: gx, y: 320, face: gf, st: 'patrol', wait: 0, t: time, susp: 0, down: 0, stun: 0 };
    ctx.save(); ctx.globalAlpha = rt ? 0.3 : 1; var ex = gx + gf * 6, ey = 320 - 46;
    if (rt) { ctx.fillStyle = E.Y; } else { var cg = ctx.createLinearGradient(ex, 0, ex + gf * 200, 0); cg.addColorStop(0, 'rgba(255,240,180,.3)'); cg.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = cg; }
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex + gf * 200, ey - 84); ctx.lineTo(ex + gf * 200, ey + 84); ctx.fill(); ctx.restore();
    R.guard(ctx, ge, time, rt);
    R.hero(ctx, 132, 320, { face: 1, state: 'crouch', t: time, rt: rt, clock: true, alpha: 0.8 });
    ctx.fillStyle = rt ? 'rgba(0,0,0,.5)' : 'rgba(6,8,12,.45)'; ctx.fillRect(0, 0, Wc, 150);
    var tt = this.t('title');
    ctx.save(); ctx.textAlign = 'center';
    if (!rt) {
      ctx.font = '900 58px Inter, system-ui, sans-serif';
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(tt, Wc / 2 + 4, 66);
      var lg = ctx.createLinearGradient(0, 22, 0, 66); lg.addColorStop(0, '#fff0c8'); lg.addColorStop(0.55, '#e0a23a'); lg.addColorStop(1, '#7a4a18'); ctx.fillStyle = lg; ctx.fillText(tt, Wc / 2, 62);
    } else { ctx.font = 'bold 50px "Courier New", monospace'; ctx.fillStyle = E.n; ctx.fillText(tt, Wc / 2 + 3, 63); ctx.fillStyle = E.y; ctx.fillText(tt, Wc / 2, 60); }
    ctx.restore();
    this.text(this.t('subtitle'), Wc / 2, 86, { size: rt ? 12 : 13, align: 'center', color: th.ink, weight: 700 });
    this.text(this.t('sub2'), Wc / 2, 104, { size: rt ? 9 : 10, align: 'center', color: th.muted, weight: 600 });
    ctx.fillStyle = rt ? 'rgba(0,0,0,.7)' : 'rgba(10,12,18,.72)'; ctx.fillRect(Wc / 2 - 150, 114, 300, 168);
    menu.draw(this, Wc / 2, 138, 26);
    this.text(this.t('d' + diff + 's'), Wc / 2, 274, { size: 10, align: 'center', color: th.muted, weight: 600 });
    var bt = bestTime(diff), line2 = (bt ? this.t('bestTime') + ' (' + this.t('d' + diff) + '): ' + fmtT(bt) : '') + (this.state.best ? (bt ? '   ·   ' : '') + this.t('best') + ': ' + this.state.best : '');
    if (line2) this.text(line2, Wc / 2, 300, { size: 11, align: 'center', color: th.accent, weight: 700 });
    this.text(this.t('hint'), Wc / 2, Hc - 10, { size: rt ? 9 : 10, align: 'center', color: th.muted, weight: 600 });
  };
  function wrap(ctx, text, maxW) {
    var words = text.split(' '), lines = [], cur = '';
    words.forEach(function (w) { var tst = cur ? cur + ' ' + w : w; if (ctx.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; });
    if (cur) lines.push(cur); return lines;
  }
  function fmtT(s) { s = Math.round(s); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  // ---------- бриф ----------
  g.scene('brief', {
    realtime: true,
    enter: function () { this._t = 0; },
    update: function (dt) { this._t += dt; },
    press: function (a) { if ((a === 'action' || a === 'start' || a === 'pause') && this._t > 0.25) g.goto('play', { resume: true }); },
    draw: function (ctx) {
      var rt = retro(), th = this.th(), t = this._t;
      this.clear(rt ? '#000' : '#090c12');
      ctx.fillStyle = rt ? E.b : '#142040'; ctx.fillRect(40, 40, 140, 200);
      R.hero(ctx, 110, 240, { face: 1, state: 'idle', t: this.time, rt: rt, clock: true, flash: true, scale: 2.4 });
      var yy = 70, size = rt ? 12 : 13;
      ctx.font = '700 ' + size + 'px ' + th.font;
      ['brief1', 'brief2', 'brief3'].forEach(function (k, i) {
        var a = Math.max(0, Math.min(1, t * 1.5 - i * 0.6)); ctx.globalAlpha = a;
        wrap(ctx, g.t(k), VW - 230).forEach(function (ln) { g.text(ln, 210, yy, { size: size, color: th.ink, weight: 700 }); yy += 19; });
        yy += 14; ctx.globalAlpha = 1;
      });
      this.text(this.t('d' + diff) + ' · ' + this.t('d' + diff + 's'), 210, 240, { size: 11, color: th.accent, weight: 700 });
      if (Math.floor(this.time * 2) % 2) this.text(this.t('brief4'), VW / 2, VH - 30, { size: 12, align: 'center', color: th.muted, weight: 700 });
    }
  });

  // ---------- финалы ----------
  function endDraw(name) {
    return function (ctx) {
      var rt = retro(), th = this.th(); this.clear(rt ? '#000' : '#090c12');
      if (!game) return;
      var s = S(), win = name === 'win';
      R.hero(ctx, VW / 2, 176, { face: 1, state: win ? 'idle' : 'down', t: this.time, rt: rt, clock: !s.planted, scale: 1.8 });
      if (win) { ctx.fillStyle = rt ? E.y : '#d8a83a'; ctx.fillRect(VW / 2 + 28, 128, 24, 12); ctx.fillStyle = rt ? E.N : '#a07428'; ctx.fillRect(VW / 2 + 34, 116, 12, 12); }
      this.text(this.t(win ? 'win' : 'gameover'), VW / 2, 46, { size: 30, align: 'center', color: win ? th.good : th.bad, weight: 900 });
      this.text(win ? this.t('w1') : this.t(s.lose === 'ring' ? 'lose_ring' : 'lose_caught'), VW / 2, 204, { size: 13, align: 'center', color: th.ink, weight: 700 });
      var y = 230;
      this.text(this.t('diff') + ': ' + this.t('d' + s.diff) + '   ·   ' + this.t('t_time') + ': ' + fmtT(s.time), VW / 2, y, { size: 13, align: 'center', color: th.muted, weight: 700 });
      this.text(this.t('t_kos') + ': ' + s.kos + '   ·   ' + this.t('t_alarms') + ': ' + s.alarms + '   ·   ' + this.t('score') + ': ' + s.score, VW / 2, y + 22, { size: 13, align: 'center', color: th.muted, weight: 700 });
      var bt = bestTime(s.diff);
      if (win && result && result.newBest) this.text(this.t('t_new'), VW / 2, y + 50, { size: 15, align: 'center', color: th.accent, weight: 900 });
      else if (bt) this.text(this.t('bestTime') + ': ' + fmtT(bt), VW / 2, y + 50, { size: 12, align: 'center', color: th.accent, weight: 700 });
      if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, VW / 2, y + 72, { size: 11, align: 'center', color: th.muted, weight: 600 });
      this.text(this.t('tapstart'), VW / 2, VH - 18, { size: 11, align: 'center', color: th.muted, weight: 600 });
    };
  }
  g.scenes.win.draw = endDraw('win'); g.scenes.gameover.draw = endDraw('gameover');
  var baseWinEnter = g.scenes.win.enter;
  g.scenes.win.enter = function () {
    baseWinEnter.call(this);
    var s = S(), bt = bestTime(s.diff);
    if (!bt || s.time < bt) { Store.set('lazutchik.time.d' + s.diff, String(Math.round(s.time * 10) / 10)); if (result) result.newBest = true; }
  };
  ['win', 'gameover'].forEach(function (n) { g.scenes[n].press = function (a) { if (a === 'action' || a === 'start' || a === 'pause') this.goto('title'); }; });

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      playSince = g.time;
      if (!(d && d.resume) || !game) { newGame(); this.goto('brief'); return; }
    },
    press: function (a) {
      if (a === 'pause') { this.goto('pause'); return; }
      if (a === 'action' && inPlay()) game.press('punch');
    },
    update: function (dt) {
      if (!game) return;
      if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
      if (tip) { tip.a -= dt; if (tip.a <= 0) tip = null; }
      if (shake > 0) shake -= dt;
      var dir = this.input.dir, live = inPlay();
      var run = held.Shift || pad.run;
      game.setInput(live ? dir.x : 0, live ? dir.y : 0, live && run);
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      var s = S();
      if (s.time > 2 && s.time < 3) showTip(g.t('m_hint1'), 5, 'h1');
      FX.step(dt);
      sync();
      if (endT > 0) { endT -= dt; if (endT <= 0) { endT = -1; if (s.won) g.win(); else g.gameover(); } }
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      LZ.render(this, ctx, S(), { banner: banner, tip: tip, shake: shake });
    }
  });

  // ---------- доп. клавиши и тач-кнопки ----------
  var KEYS = { KeyX: 'punch', KeyJ: 'punch', KeyC: 'kick', KeyK: 'kick', KeyZ: 'item', KeyF: 'flash' };
  addEventListener('keydown', function (e) {
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') held.Shift = true;
    var a = KEYS[e.code]; if (!a) return;
    var ip = g._sceneName === 'play';
    if (ip) e.preventDefault();
    if (ip && inPlay() && !e.repeat) game.press(a);
    else if (g._sceneName === 'brief' && !e.repeat) g.scenes.brief.press.call(g, 'action');
  });
  addEventListener('keyup', function (e) { if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') held.Shift = false; });
  addEventListener('blur', function () { held = {}; });
  function bindBtn(id, act) {
    var b = document.getElementById(id); if (!b) return;
    var on = function (e) {
      e.preventDefault();
      if (act === 'run') { pad.run = !pad.run; b.classList.toggle('on', pad.run); return; }
      if (inPlay()) game.press(act); else if (g._sceneName === 'brief') g.scenes.brief.press.call(g, 'action');
    };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('mousedown', on);
  }
  bindBtn('bPunch', 'punch'); bindBtn('bKick', 'kick'); bindBtn('bItem', 'item'); bindBtn('bRun', 'run'); bindBtn('bFlash', 'flash');
  (function () {
    var b = document.getElementById('bPause'); if (!b) return;
    var h = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.goto('pause'); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
    b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
  })();

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, padEl = document.querySelector('.pad');
    var padFixed = padEl && getComputedStyle(padEl).position === 'fixed';
    var padH = padEl && !padFixed && getComputedStyle(padEl).display !== 'none' ? padEl.offsetHeight + 16 : 0;
    var w = Math.min(1120, (wrap && wrap.clientWidth) || g.W, (innerHeight - padH - 64) * g.W / g.H);
    w = Math.max(240, Math.floor(w)); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    if (g.i18n.lang !== lastLang) {
      lastLang = g.i18n.lang; document.documentElement.lang = lastLang;
      var b = document.getElementById('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      [['bPunch', 'b_punch'], ['bKick', 'b_kick'], ['bItem', 'b_item'], ['bRun', 'b_run'], ['bFlash', 'b_flash']].forEach(function (p) { var el = document.getElementById(p[0]); if (el) el.textContent = g.t(p[1]); });
      document.title = g.t('title') + ' · ' + (lastLang === 'ru' ? 'стелс-экшен — HTML5' : 'stealth action — HTML5');
    }
    if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();

  g.start('title');
  LZ.app = { g: g, game: function () { return game; }, setDiff: setDiff };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
