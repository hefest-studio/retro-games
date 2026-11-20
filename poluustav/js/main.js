/* ПОЛУУСТАВ · сборка игры на фреймворке Гефест Arcade v2: сцены, ввод (клавиши, тач-кнопки, свайп-прыжок),
   сохранение по отметкам (localStorage poluustav.save), музыка и звук среды по страницам, связь логики с рендером.
   Отладка/скриншоты: #z=<страница 0..6>&cp=<отметка> — начать с нужного места (как «Продолжить»). */
(function (global) {
  'use strict';
  var P = global.POLU, RD = P.render;
  var W = 960, H = 540, SAVE = 'poluustav.save';
  var THEMES = {
    modern: { bg: '#efe3c6', panel: '#e5d4ae', ink: '#3b2817', muted: '#7a6346', accent: '#b4442b', good: '#4f6b2e', bad: '#b4442b', warn: '#b4442b', grid: '#d9c7a0', font: 'Georgia, "Times New Roman", serif', pixel: false, glow: false, radius: 6 },
    retro: { bg: '#f4efe1', panel: '#d8d0bc', ink: '#120e0a', muted: '#4a4038', accent: '#120e0a', good: '#120e0a', bad: '#120e0a', warn: '#120e0a', grid: '#d8d0bc', font: '"Courier New", ui-monospace, monospace', pixel: true, glow: false, radius: 0 }
  };
  var g = Arcade.createGame({ canvas: '#c', width: W, height: H, gameId: 'poluustav', strings: P.STR, theme: 'modern', themes: THEMES });
  P.g = g;
  var pad = document.querySelector('.pad');
  g.input.bindDpad(pad);

  // ---------- сохранение ----------
  function loadSave() { try { var s = localStorage.getItem(SAVE); var o = s ? JSON.parse(s) : null; return o && P.LEVELS[o.z] ? o : null; } catch (e) { return null; } }
  function writeSave(o) { try { localStorage.setItem(SAVE, JSON.stringify(o)); } catch (e) {} }
  function clearSave() { try { localStorage.removeItem(SAVE); } catch (e) {} }
  function debugStart() {
    var m = /[#&?]z=(\d+)/.exec(location.hash + location.search); if (!m) return null;
    var z = Math.min(P.LEVELS.length - 1, +m[1]), c = /[#&?]cp=(\d+)/.exec(location.hash + location.search), cp = c ? Math.min(P.LEVELS[z].cps.length - 1, +c[1]) : 0;
    return { z: z, cp: cp, snap: null };
  }

  // ---------- игра ----------
  var game = null, blot = null, walk = 0, tj = 0, touch = { jump: false, act: false };
  function music(z) { var T = Arcade.poluTracks; if (T && T[z]) g.audio.setMusic(T[z]); }
  function onEvent(type, d) {
    P.sfx(g, type, d);
    var S = game && game.state();
    if (type === 'checkpoint' && S) { var sv = game.saveData(); sv.deaths = S.deaths; sv.played = S.played; writeSave(sv); }
    if (type === 'death') blot = { x: d.x, y: d.y, t: 0, seed: (Math.random() * 1e6) | 0 };
    if (type === 'zone') { music(d.z); if (S) S._enterT = 1; RD.cam.z = -1; }
    if (type === 'win') {
      clearSave(); var s2 = game.state();
      g.state.score = Math.max(100, Math.round(7000 - s2.deaths * 40 - s2.played / 2)); g.state.level = 7;
      setTimeout(function () { if (g._sceneName === 'play') g.win(); }, 1600); music(7);
    }
  }
  function newGame(save) {
    game = P.Game({ onEvent: onEvent, save: save || null }); P.current = game; game.start();
    var S = game.state(); if (save) { S.deaths = save.deaths || 0; S.played = save.played || 0; }
    RD.cam.z = -1; blot = null; S._enterT = 1;
    g.state.score = 0; g.state.level = S.z + 1;
  }

  // ---------- стандартные экраны: меню «Продолжить», пауза «К последней отметке» ----------
  g.useStandardScreens({ get subtitle() { return g.t('subtitle'); }, lives: 0 });
  function contItem() { return { key: 'cont', label: function () { var s = loadSave(); return g.t('cont') + (s ? ' · ' + (s.z + 1) + '/7' : ''); }, onSelect: function () { P._resume = loadSave(); this.goto('play'); }, before: 'play' }; }
  function refreshMenu() {
    var has = !!loadSave(), items = g.menu.items('title');
    if (has && items.indexOf('cont') < 0) g.menu.addItem(contItem());
    if (!has && items.indexOf('cont') >= 0) g.menu.removeItem('cont');
    var m = g.menu.get('title'); if (m) m.sel = 0;
  }
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); }, onSelect: function () { if (game) game.restartCp(); this.goto('play', { resume: true }); } });
  var title = g.scenes.title, menu = title._menu, oldEnter = title.enter;
  title.enter = function (d) { if (oldEnter) oldEnter.call(this, d); refreshMenu(); P.stopAmbience(); };
  // живой фон заставки: первая страница, ученик идёт сам
  var demo = P.Game({ zone: 0 }).start(), demoT = 0;
  title.update = function (dt) {
    demoT += dt; var s = demo.state(), h = s.hero;
    var go = h.x < 380 ? 1 : 0; if (h.x > 360 && demoT > 6) { demo.loadZone(0); demoT = 0; }
    demo.setInput({ x: go }); demo.update(dt); walk += Math.abs(h.vx) * dt * 0.09;
  };
  title.draw = function (ctx) {
    var th = this.th(), retro = this.themeName === 'retro', pal = RD.PAL[retro ? 'retro' : 'modern'];
    RD.draw(ctx, demo.state(), g, { game: demo, dt: 1 / 60, walk: walk, overlay: function (c) {
      var pw = 470, ph = 300, px = (W - pw) / 2, py = 100;
      c.save(); c.globalAlpha = 0.93; c.drawImage(RD.paperTex(retro ? 'retro' : 'modern'), px, py, pw, ph, px, py, pw, ph); c.restore();
      RD.pen(c, RD.rectPts(px, py, pw, ph), 1.8, 51, pal.ink, true); RD.pen(c, RD.rectPts(px + 6, py + 6, pw - 12, ph - 12), 0.8, 52, pal.soft, true);
      // буквица-заставка: киноварный квадрат с завитком (без буквы)
      c.fillStyle = pal.verm; c.fillRect(px + 22, py + 22, 34, 34); RD.pen(c, RD.rectPts(px + 22, py + 22, 34, 34), 1.4, 53, pal.ink, true);
      var sw = []; for (var k = 0; k < 24; k++) { var a = k / 24 * Math.PI * 3; sw.push([px + 39 + Math.cos(a) * (12 - k * 0.4), py + 39 + Math.sin(a) * (12 - k * 0.4)]); } RD.pen(c, sw, 1.2, 54, retro ? '#ffffff' : pal.paper);
      g.text(g.t('title'), W / 2 + 16, py + 62, { size: 46, align: 'center', color: pal.ink, weight: 700, font: th.font });
      g.text(g.t('subtitle'), W / 2, py + 92, { size: 15, align: 'center', color: th.muted, weight: 400, font: th.font });
      menu.draw(g, W / 2, py + 136, 30);
      if (g.state.best) g.text(g.t('best') + ': ' + g.state.best, W / 2, py + ph - 14, { size: 12, align: 'center', color: th.muted, weight: 600 });
      c.save(); c.globalAlpha = 0.9; c.drawImage(RD.paperTex(retro ? 'retro' : 'modern'), 40, H - 48, W - 80, 28, 40, H - 48, W - 80, 28); c.restore();
      g.text(g.t('hint'), W / 2, H - 29, { size: 12, align: 'center', color: pal.ink, weight: 600 });
    } });
  };

  // ---------- игровая сцена ----------
  var lastDt = 1 / 60;
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (d && d.resume) return;
      var sv = P._resume || debugStart(); P._resume = null;
      if (!sv) clearSave();
      newGame(sv);
    },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return; lastDt = dt;
      var inp = this.input, c = inp.codes;
      tj = Math.max(0, tj - dt);
      game.setInput({
        x: inp.dir.x, y: inp.dir.y > 0 ? 1 : 0, up: inp.dir.y < 0,
        jump: inp.pressed('action') || !!c.KeyZ || !!c.KeyK || touch.jump || tj > 0,
        act: !!(c.KeyE || c.KeyX || c.KeyJ || c.ShiftLeft || c.ShiftRight || c.KeyF) || touch.act
      });
      game.update(dt);
      var S = game.state(), h = S.hero;
      walk += Math.abs(h.vx) * dt * 0.09;
      if (blot) { blot.t += dt; if (blot.t > 1.2) blot = null; }
      if (S._enterT > 0) S._enterT = Math.max(0, S._enterT - dt * 1.4);
      P.ambience(g, S, dt);
      g.state.level = S.z + 1;
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      RD.draw(ctx, game.state(), g, { game: game, dt: lastDt, walk: walk, blot: blot });
    }
  });
  // пауза: лист бумаги поверх страницы
  g.scenes.pause.draw = function (ctx) {
    var retro = this.themeName === 'retro', pal = RD.PAL[retro ? 'retro' : 'modern'], th = this.th(), pm = g.menu.get('pause');
    if (game) RD.draw(ctx, game.state(), g, { game: game, dt: 0, walk: walk, overlay: function (c) {
      c.fillStyle = retro ? 'rgba(0,0,0,0.35)' : 'rgba(40,25,10,0.35)'; c.fillRect(0, 0, W, H);
      var pw = 360, ph = 256, px = (W - pw) / 2, py = (H - ph) / 2;
      c.drawImage(RD.paperTex(retro ? 'retro' : 'modern'), px, py, pw, ph, px, py, pw, ph); RD.pen(c, RD.rectPts(px, py, pw, ph), 1.8, 61, pal.ink, true);
      // пиктограмма паузы — две черты пером
      RD.pen(c, [[W / 2 - 9, py + 26], [W / 2 - 9, py + 56]], 4, 62, pal.ink); RD.pen(c, [[W / 2 + 9, py + 26], [W / 2 + 9, py + 56]], 4, 63, pal.ink);
      if (pm) pm.draw(g, W / 2, py + 100, 32);
      var S = game.state(); g.text('● ' + S.deaths + '   ' + (S.z + 1) + '/7', W / 2, py + ph - 14, { size: 13, align: 'center', color: th.muted, weight: 600 });
    } });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  // финал: колофон — рукопись закрыта
  g.scenes.win.draw = function (ctx) {
    var retro = this.themeName === 'retro', pal = RD.PAL[retro ? 'retro' : 'modern'], th = this.th(), t = this.time;
    ctx.drawImage(RD.paperTex(retro ? 'retro' : 'modern'), 0, 0);
    var cx = W / 2, cy = 230, k;
    var book = [[cx - 150, cy + 60], [cx - 140, cy - 60], [cx, cy - 74], [cx + 140, cy - 60], [cx + 150, cy + 60], [cx, cy + 46]];
    RD.poly(ctx, book); ctx.fillStyle = pal.paper2; ctx.fill(); RD.hatch(ctx, book, cx - 160, cy - 80, 320, 150, 0.8, 4, pal.soft, 0.8, 71);
    RD.pen(ctx, book, 2, 72, pal.ink, true); RD.pen(ctx, [[cx, cy - 74], [cx, cy + 46]], 1.6, 73, pal.ink);
    for (k = 0; k < 6; k++) RD.pen(ctx, [[cx - 120 + k * 8, cy + 58 - k], [cx - 4, cy + 44 - k * 2]], 0.6, 74 + k, pal.soft);
    RD.lamp(ctx, cx + 190, cy + 40, pal, t, retro ? 'retro' : 'modern');
    var seal = RD.splat(cx, cy - 4, 26, 9, 7, 0.08); RD.poly(ctx, seal); ctx.fillStyle = pal.verm; ctx.fill(); RD.pen(ctx, seal, 1.4, 81, pal.ink, true);
    this.text(this.t('win'), cx, 372, { size: 40, align: 'center', color: pal.ink, weight: 700, font: th.font });
    var S = game && game.state();
    var line = this.t('score') + ': ' + (this.state.score | 0) + (this.state.best ? '   ' + this.t('best') + ': ' + this.state.best : '') + (S ? '   ● ' + S.deaths + ' ' + this.t('blots') : '');
    this.text(line, cx, 404, { size: 15, align: 'center', color: th.muted, weight: 600, font: th.font });
    this.text(this.t('tapstart'), cx, H - 30, { size: 12, align: 'center', color: th.muted, weight: 600 });
  };

  // ---------- тач: прыжок, действие, пауза; свайп вверх по канве — прыжок ----------
  function hold(id, key) {
    var b = document.getElementById(id); if (!b) return;
    var on = function (e) { e.preventDefault(); touch[key] = true; }, off = function (e) { e.preventDefault(); touch[key] = false; };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
    b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
  }
  hold('bJump', 'jump'); hold('bAct', 'act');
  var bp = document.getElementById('bPause');
  if (bp) { var tp = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; bp.addEventListener('touchstart', tp, { passive: false }); bp.addEventListener('mousedown', tp); }
  var cv = g.canvas, sw = null;
  cv.addEventListener('touchstart', function (e) { if (g._sceneName !== 'play') return; var t0 = e.changedTouches[0]; sw = { x: t0.clientX, y: t0.clientY, t: Date.now() }; e.preventDefault(); }, { passive: false });
  cv.addEventListener('touchmove', function (e) { if (!sw || g._sceneName !== 'play') return; var t0 = e.changedTouches[0]; if (sw.y - t0.clientY > 36 && Date.now() - sw.t < 400) { tj = 0.12; sw = null; } e.preventDefault(); }, { passive: false });
  cv.addEventListener('touchend', function () { sw = null; });

  // подпись под канвой — по языку
  var lastLang = null;
  function syncDom() { if (lastLang === g.i18n.lang) return; lastLang = g.i18n.lang; var f = document.getElementById('foot'); if (f) f.textContent = g.t('foot') + ' ' + g.t('hint') + '.'; }
  syncDom(); setInterval(syncDom, 250);

  g.start('title');
})(window);
