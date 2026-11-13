/* ШУСТРИК · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован, в паузе — «С контрольной точки».
   Ввод: ←→/AD — бег; Пробел/Z/J — прыжок; X/K/Ctrl/F — огонь (держать — автоогонь), ↑/W — прицел по диагонали;
   тач: дпад (▲ — прицел вверх), ● — прыжок, ✷ — огонь (держать), II — пауза.
   Лучшее время каждого акта — localStorage `arcade.shustrik.times` ({"1-1": секунды, …}). */
(function (global) {
  'use strict';
  var SH = global.SHUSTRIK, L = SH.logic, R = SH.R, FX = R.FX, VW = R.VW, VH = R.VH;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#120e14', panel: '#1b1520', ink: '#f5efe6', muted: '#b0a6a0', accent: '#ffa62b', grid: '#2e2630' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'shustrik', strings: SH.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  SH.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  // ---------- лучшее время актов ----------
  var TKEY = 'arcade.shustrik.times';
  function loadTimes() { try { var v = JSON.parse(global.localStorage.getItem(TKEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function saveTime(key, sec) {
    var t = loadTimes(), better = !(t[key] > 0) || sec < t[key];
    if (better) { t[key] = Math.round(sec * 10) / 10; try { global.localStorage.setItem(TKEY, JSON.stringify(t)); } catch (e) {} }
    return { best: t[key], isNew: better };
  }
  function fmt(sec) { var m = Math.floor(sec / 60), s = sec - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }

  var game = null, toasts = [], banner = null, playSince = 0, cam = { x: null, y: null }, extraJump = false, fireHeld = false, padFire = false;
  function S() { return game.state(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.world; }
  function retro() { return g.themeName === 'retro'; }
  function col(m, r) { return retro() ? r : m; }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < toasts.length; i++) if (Math.abs(toasts[i].y - y) < 12 && Math.abs(toasts[i].x - x) < 120 && toasts[i].t > toasts[i].life - 0.5) y -= 14;
    var life = big ? 1.9 : 1.1; toasts.push({ text: text, color: color, x: x, y: y, t: life, life: life, big: !!big });
    if (toasts.length > 14) toasts.shift();
  }
  function showBanner(title, sub, dur, lines, lastHi) { banner = { title: title, sub: sub, a: dur || 2.4, dur: dur || 2.4, lines: lines, lastHi: lastHi }; }
  function actName(s) { return g.t('world') + ' ' + s.world + ' · ' + g.t('w' + s.world); }

  function onEvent(type, d) {
    d = d || {};
    SH.sfx(g, type, d);
    var s = game ? S() : null, P = s && s.hero, E = R.E;
    switch (type) {
      case 'act': toasts = []; FX.clear(); cam.x = null; showBanner(actName(s), g.t('act') + ' ' + s.act + (s.act === 2 ? ' · ' + g.t('boss') : '') + ' — ' + g.t('intro'), 2.6); break;
      case 'bonus': toasts = []; FX.clear(); cam.x = null; showBanner(g.t('bonusStage'), g.t('bonusGoal').replace('{n}', s.LV.need).replace('{t}', s.LV.time), 2.4); break;
      case 'gear': FX.add(d.x, d.y, { n: 3, sp: 60, life: 0.3, c: col('#ffe08a', E.y), r: 1.5, g: 0 }); break;
      case 'cap':
        toast(g.t('c_' + d.k), col('#9ff3dc', E.Cc), d.x, d.y - 18, true);
        FX.add(d.x, d.y, { n: 12, sp: 120, life: 0.45, c: col('#dff6ff', E.w), r: 2 }); break;
      case 'secret': toast(g.t('secret'), col('#5ce0ff', E.Cc), d.x, d.y - 20, true); FX.add(d.x, d.y, { n: 20, sp: 140, c: col('#5ce0ff', E.Cc) }); break;
      case 'token': toast(g.t('token'), col('#d86bff', E.M), d.x, d.y - 40, true); break;
      case 'cp': toast(g.t('cp'), col('#62ff9a', E.G), d.x, d.y - 56); break;
      case 'tier': if (d.tier > 0 && P) toast(g.t('tier' + (d.tier + 1)), d.tier === 2 ? col('#ff8a3a', E.R) : col('#ffc24a', E.y), P.x, P.y - 40, d.tier === 2); break;
      case 'crate': FX.add(d.x, d.y, { n: 14, sp: 220, life: 0.6, c: col('#c98a4a', E.n), r: 2.5, a: P && P.face < 0 ? Math.PI : 0, spread: 2.2 }); toast('+30', col('#ffc24a', E.y), d.x, d.y - 10); break;
      case 'kill': toast('+' + d.pts, col('#ffc24a', E.y), d.x, d.y - 10); FX.add(d.x, d.y, { n: 16, sp: 160, c: col('#c8ced8', E.l), r: 2.2 }); FX.add(d.x, d.y, { n: 6, sp: 60, c: col('#ffffff', E.w), r: 4, g: -40, puff: true, life: 0.6 }); break;
      case 'enemyHit': case 'bossHit': FX.add(d.x, d.y, { n: 4, sp: 90, life: 0.25, c: col('#ffd166', E.y), r: 1.6 }); break;
      case 'spark': FX.add(d.x, d.y, { n: 3, sp: 70, life: 0.2, c: col('#dff6ff', E.w), r: 1.4 }); break;
      case 'pop': FX.add(d.x, d.y, { n: 6, sp: 80, life: 0.3, c: col('#ffffff', E.w), r: 2, g: 0 }); break;
      case 'boom': FX.add(d.x, d.y, { n: 18, sp: 200, life: 0.4, c: col('#ff9a3a', E.R), r: 2.6, g: 100 }); break;
      case 'spring': FX.add(d.x, d.y - 6, { n: 6, sp: 80, a: -Math.PI / 2, spread: 1.4, c: col('#ffffff', E.w), r: 3, puff: true, g: 0 }); break;
      case 'pipe': case 'pipeOut': if (P) FX.add(P.x, P.y - 12, { n: 10, sp: 120, c: col('#ffffff', E.w), r: 4, puff: true, g: -60, life: 0.6 }); break;
      case 'steam': break;
      case 'hurt': case 'shieldHit': FX.add(d.x, d.y - 12, { n: 10, sp: 140, c: type === 'hurt' ? col('#7ff0e0', E.Cc) : col('#64b5ff', E.B), r: 2 }); break;
      case 'die': FX.add(d.x, d.y - 12, { n: 24, sp: 180, c: col('#c4844a', E.n), r: 2.4 }); FX.add(d.x, d.y - 12, { n: 10, sp: 70, c: col('#ffffff', E.w), r: 5, puff: true, g: -50, life: 0.9 }); break;
      case 'life': if (P) toast(g.t('life'), col('#ff8aa0', E.R), P.x, P.y - 46, true); break;
      case 'boss': showBanner(g.t('boss'), g.t('b_' + s.LV.arena.boss), 1.8); break;
      case 'bossDown': FX.add(d.x, d.y, { n: 40, sp: 240, c: col('#ff9a3a', E.R), r: 3, life: 0.9 }); toast('+5000', col('#ffc24a', E.y), d.x, d.y - 40, true); showBanner(g.t('bossDown'), '', 2); break;
      case 'bossBump': cam.shake = 0.35; break;
      case 'clear':
        var bt = saveTime(d.world + '-' + d.act, d.time);
        var lines = [g.t('tTime') + ': ' + fmt(d.time) + '   ' + g.t('tBest') + ': ' + fmt(bt.best) + (bt.isNew ? ' ★' : ''),
          g.t('tSpeed') + ' +' + d.tb + '   ' + g.t('tGears') + ' +' + d.gb + '   ' + g.t('tSecrets') + ' +' + d.sb, g.t('tTotal') + ' +' + d.bonus];
        if (d.token) lines.push(g.t('token'));
        showBanner(g.t('clear'), actName(s) + ' · ' + g.t('act') + ' ' + d.act + (bt.isNew ? ' · ' + g.t('newBest') : ''), 3.1, lines, true); break;
      case 'bonusEnd': showBanner(d.done ? g.t('bonusOk') : g.t('bonusFail'), d.got + ' ' + g.t('got'), 2.3); break;
      case 'respawn': cam.x = null; toasts = []; break;
      case 'win': sync(); setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 1500); break;
      case 'gameover': sync(); g.state.lives = 0; setTimeout(function () { if (g._sceneName === 'play') g.gameover(); }, 900); break;
    }
    sync();
  }
  function newGame() { game = SH.Game({ onEvent: onEvent }); toasts = []; banner = null; FX.clear(); cam = { x: null, y: null }; game.start(); SH.current = game; sync(); }
  function inPlay() { return g._sceneName === 'play' && game && g.time - playSince > 0.15; }

  // ---------- Стандартные экраны ----------
  g.useStandardScreens({ lives: L.K.LIVES });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (game) { game.restartAct(); sync(); } if (game && game.state().over) g.gameover(); else g.goto('play', { resume: true }); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      if (!game) return;
      var s = S(), rt = retro();
      if (name === 'win') { R.hero(ctx, this.W / 2 - 40, this.H / 2 - 64, { face: 1, ground: true, runT: this.time * 8 }, this.time, { retro: rt, scale: 2.2, speed: 300 }); }
      else R.fox(ctx, this.W / 2, this.H / 2 - 84, { dir: -1, h: 40, state: 'wait', flash: 0 }, this.time, rt, false);
      this.text(this.t('world') + ': ' + (s.won ? 4 : s.world) + '/4 · ' + this.t('gears') + ': ' + s.gears + ' · ★ ' + s.secrets, this.W / 2, this.H / 2 + 46, { size: 13, align: 'center', color: this.th().muted, weight: 700 });
    };
  });

  // ---------- Титул ----------
  var title = g.scenes.title, menu = g.menu.get('title'), demoS = null;
  function demoState() {
    if (demoS) return demoS;
    var LV = L.getLV(1, 1);
    demoS = { LV: LV, world: 1, act: 1, got: {}, enemies: [], shots: [], eshots: [], booms: [], vents: [], boss: null, cp: { x: 0 }, hero: L.newHero(400, LV.start.y), score: 0, gears: 0, lives: 3, actTime: 0, phase: 'title' };
    return demoS;
  }
  var titleCam = { x: 0, y: null };
  title.draw = function (ctx) {
    var rt = retro(), Wc = this.W, Hc = this.H, th = this.th(), ds = demoState(), time = this.time;
    // фон — первый мир, медленно едет
    var bg = R.bgLayers(1, rt);
    if (bg) { ctx.drawImage(bg.sky, 0, 0); var fx = -((time * 12) % 1280); ctx.drawImage(bg.far, fx, 0); ctx.drawImage(bg.far, fx + 1280, 0); var mx = -((time * 40) % 1024); ctx.drawImage(bg.mid, mx, 20); ctx.drawImage(bg.mid, mx + 1024, 20); }
    ctx.fillStyle = rt ? 'rgba(0,0,0,.55)' : 'rgba(12,8,14,.45)'; ctx.fillRect(0, 0, Wc, Hc);
    // логотип
    var tt = this.t('title');
    ctx.save(); ctx.font = (rt ? 'bold 52px "Courier New", monospace' : '900 58px Inter, system-ui, sans-serif'); ctx.textAlign = 'center';
    if (!rt) { ctx.save(); ctx.transform(1, 0, -0.18, 1, 0, 0); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(tt, Wc / 2 + 3 + 12, 74); var lg = ctx.createLinearGradient(0, 30, 0, 76); lg.addColorStop(0, '#ffe3a0'); lg.addColorStop(0.5, '#ffa62b'); lg.addColorStop(1, '#c4582a'); ctx.fillStyle = lg; ctx.fillText(tt, Wc / 2 + 12, 71); ctx.restore();
      for (var sl = 0; sl < 4; sl++) { ctx.fillStyle = 'rgba(255,166,43,' + (0.5 - sl * 0.1) + ')'; ctx.fillRect(Wc / 2 - 230 - sl * 22, 40 + sl * 8, 60 - sl * 10, 3); } }
    else { ctx.fillStyle = R.E.r; ctx.fillText(tt, Wc / 2 + 3, 72); ctx.fillStyle = R.E.y; ctx.fillText(tt, Wc / 2, 69); }
    ctx.restore();
    this.text(this.t('subtitle'), Wc / 2, 96, { size: rt ? 12 : 13, align: 'center', color: th.ink, weight: 700 });
    this.text(this.t('sub2'), Wc / 2, 114, { size: rt ? 10 : 11, align: 'center', color: th.muted, weight: 600 });
    // герой бежит, лис удирает
    var hx = 120 + Math.sin(time * 0.7) * 16;
    R.hero(ctx, hx, 300, { face: 1, ground: true, runT: time * 10, rot: 0, mode: 'run' }, time, { retro: rt, scale: 2.4, speed: 420, flash: Math.floor(time * 4) % 3 === 0 });
    for (var i = 0; i < 5; i++) { ctx.fillStyle = rt ? R.E.w : 'rgba(255,255,255,' + (0.25 - i * 0.04) + ')'; ctx.beginPath(); ctx.arc(hx - 70 - i * 18 - ((time * 90) % 18), 270 + Math.sin(i + time * 5) * 4, 6 + i * 2, 0, Math.PI * 2); ctx.fill(); }
    R.fox(ctx, Wc - 110, 286, { dir: 1, h: 40, state: 'dash', flash: 0 }, time, rt, false);
    menu.draw(this, Wc / 2, 150, 28);
    var best = this.state.best;
    if (best) this.text(this.t('best') + ': ' + best, Wc / 2, 290, { size: 12, align: 'center', color: th.muted, weight: 700 });
    this.text(this.t('hint'), Wc / 2, Hc - 12, { size: rt ? 10 : 11, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- Игровая сцена ----------
  var STEP = 1 / 60, trailT = 0, trailN = 0;
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      var i;
      for (i = 0; i < toasts.length; i++) toasts[i].t -= dt;
      toasts = toasts.filter(function (q) { return q.t > 0; });
      if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
      var dir = this.input.dir, live = g.time - playSince > 0.15;
      var jump = live && (this.input.pressed('action') || extraJump);
      game.setInput(dir.x, live ? dir.y : 0, jump);
      game.setFire(live && (fireHeld || padFire));
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      var s = S(), P = s.hero, sp = L.speedOf(P);
      // след пара на 3-й скорости, искры на рельсе
      trailT -= dt;
      if (trailT <= 0 && s.phase === 'play') {
        trailT = 0.05;
        if (P.mode === 'rail') FX.add(P.x - P.face * 4, P.y, { n: 3, sp: 120, a: Math.PI + (P.face > 0 ? 0.3 : -0.3) + (P.face < 0 ? Math.PI : 0), spread: 0.8, life: 0.25, c: col('#ffd166', R.E.y), r: 1.4, g: 400 });
        else if (P.tier === 2 && Math.abs(sp) > 360 && P.mode === 'run' && (trailN = (trailN + 1) % 2) === 0) FX.add(P.x - P.face * 22, P.y - 20, { n: 1, sp: 20, life: 0.45, c: col('#ffffff', R.E.w), r: 3, puff: true, g: -40, vx: -P.face * 60 });
        if (P.steam) FX.add(P.x, P.y, { n: 1, sp: 30, a: Math.PI / 2, life: 0.4, c: col('#ffffff', R.E.w), r: 5, puff: true, g: -80 });
      }
      FX.step(dt);
      R.camera(cam, s, dt, cam.x == null);
      if (cam.shake > 0) cam.shake -= dt;
      sync();
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      var c2 = cam;
      if (cam.shake > 0) c2 = { x: cam.x + (Math.random() - 0.5) * 6, y: cam.y + (Math.random() - 0.5) * 6 };
      SH.render(this, ctx, S(), { toasts: toasts, banner: banner, cam: c2, aimUp: this.input.dir.y < -0.3 });
    }
  });

  // ---------- Доп. клавиши и тач-кнопки ----------
  var JUMP = { KeyZ: 1, KeyJ: 1 }, FIRE = { KeyX: 1, KeyK: 1, ControlLeft: 1, ControlRight: 1, KeyF: 1 }, held = {};
  function refresh() { extraJump = !!(held.KeyZ || held.KeyJ); fireHeld = !!(held.KeyX || held.KeyK || held.ControlLeft || held.ControlRight || held.KeyF); }
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play';
    if (JUMP[e.code] || FIRE[e.code]) { held[e.code] = true; refresh(); if (ip) e.preventDefault(); if (FIRE[e.code] && ip && inPlay() && !e.repeat) game.fire(); }
  });
  addEventListener('keyup', function (e) { if (JUMP[e.code] || FIRE[e.code]) { held[e.code] = false; refresh(); } });
  addEventListener('blur', function () { held = {}; refresh(); padFire = false; });
  (function () {
    var b = document.getElementById('bFire'); if (!b) return;
    var on = function (e) { e.preventDefault(); padFire = true; if (inPlay()) game.fire(); }, off = function (e) { e.preventDefault(); padFire = false; };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
    b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
  })();
  (function () {
    var b = document.getElementById('bPause'); if (!b) return;
    var h = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); };
    b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h);
  })();

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, pad = document.querySelector('.pad');
    var padFixed = pad && getComputedStyle(pad).position === 'fixed';
    var padH = pad && !padFixed && getComputedStyle(pad).display !== 'none' ? pad.offsetHeight + 16 : 0;
    var w = Math.min(1120, (wrap && wrap.clientWidth) || g.W, (innerHeight - padH - 64) * g.W / g.H);
    w = Math.max(240, Math.floor(w)); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    if (g.i18n.lang !== lastLang) {
      lastLang = g.i18n.lang; document.documentElement.lang = lastLang;
      var b = document.getElementById('backLink'); if (b) b.innerHTML = '&larr; ' + g.t('back');
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
    }
    if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();

  g.start('title');
  SH.app = { g: g, game: function () { return game; }, cam: function () { return cam; }, times: loadTimes };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
