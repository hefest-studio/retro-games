/* СКОК (EN: KEYWINDER) · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js, save.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover/continue — g.useStandardScreens (+ реклама за награду движка); титул перерисован;
   в меню — «Сбросить прогресс», в паузе — «К верстаку». Сцена play: режимы 'select' (Верстак — выбор уровня) ↔ 'level'.
   Ввод: ←→/AD — бег; Пробел/Z/K — прыжок; X/J — заводной ключ; тач: ◀ ▶, ● прыжок, ⚙ ключ, II пауза;
   геймпад (движок v2.9): стик/крестовина — бег, A — прыжок, B — ключ (B шлёт KeyX), Start — пауза.
   Прогресс — localStorage arcade.save.skok (save.js, v3), счёт игры = сумма лучших результатов уровней (рекорд и таблица «skok»). */
(function (global) {
  'use strict';
  var SK = global.SKOK, L = SK.logic, R = SK.R, FX = R.FX, VW = R.VW, VH = R.VH, T = L.T, MAP = SK.MAP;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#1c1210', panel: '#2a1c18', ink: '#fff4e6', muted: '#c9b49c', accent: '#ff9a4a', good: '#8fe08a', bad: '#ff6b5b', warn: '#ffd34d', grid: '#3a2a22' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var ls = null; try { ls = global.localStorage; } catch (e) {}
  var LSX = ls || { getItem: function () { return null; }, setItem: function () {}, removeItem: function () {} };
  // переделка 2026-11: старое сохранение (v1/v2) → v3; прежний рекорд считался по-другому (накопительный счёт) — уходит в историю
  var oldBest = 0;
  try { var raw0 = LSX.getItem(SK.save.KEY) || LSX.getItem(SK.save.OLD), o0 = raw0 ? JSON.parse(raw0) : null;
    if (o0 && (o0.v | 0) < 3) { oldBest = +LSX.getItem('arcade.best.skok') || 0; if (oldBest) { LSX.setItem('arcade.skok.oldBest', String(oldBest)); LSX.removeItem('arcade.best.skok'); } } } catch (e) {}
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'skok', leaderboard: 'skok', strings: SK.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  SK.g = g;
  g.input.bindDpad(document.querySelector('.pad'));
  var store = SK.save.store(LSX);
  var prog = store.load();
  var titleNote = prog.migrated ? { text: g.t('migrated') + (oldBest ? ' · ' + g.t('oldBest') + ': ' + oldBest : ''), a: 8 } : null;
  if (prog.migrated) { delete prog.migrated; store.save(prog); }

  var game = null, mode = 'select', playSince = 0, cam = 0, runLives = L.K.LIVES;
  var ui = { toasts: [], banner: null, msg: null, runPh: 0, shake: 0 };
  var M = { prog: prog, sel: prog.at, note: '', noteA: 0 };
  var held = {}, extra = { jump: false }, result = null, tut = {};
  function S() { return game.state(); }
  function th() { return g.th(); }
  function retro() { return g.themeName === 'retro'; }
  function col(m, r) { return retro() ? r : m; }
  function syncScore() { g.state.score = SK.save.total(prog); if (g.state.score > (g.state.best | 0)) g.saveBest(); }
  function toast(text, color, x, y, big) {
    for (var i = 0; i < ui.toasts.length; i++) if (Math.abs(ui.toasts[i].y - y) < 10 && Math.abs(ui.toasts[i].x - x) < 50) y -= 12;
    var life = big ? 1.6 : 0.9; ui.toasts.push({ text: text, color: color, x: x, y: y, t: life, life: life, big: !!big }); if (ui.toasts.length > 14) ui.toasts.shift();
  }
  function msg(text, color, dur) { ui.msg = { text: text, color: color, a: dur || 1.8 }; }
  function banner(title, sub, dur, lines, color) { ui.banner = { title: title, sub: sub, a: dur || 2.4, lines: lines, color: color, hiLast: true }; }
  var curTrack = null;
  function music(tr) { if (curTrack === tr) return; curTrack = tr; g.setMusic(tr); g.audio.music.step = 0; }

  // ---------- события логики ----------
  function onEvent(type, d) {
    d = d || {};
    SK.sfx(g, type, d);
    var s = game ? S() : null, P = s && s.hero, E = R.E, t = th();
    switch (type) {
      case 'level': {
        ui.toasts = []; FX.clear(); ui.msg = null; tut = {};
        var LV = s.LV;
        music(LV.fort ? SK.MUSIC.fort : SK.MUSIC.level);
        if (LV.fort) banner(g.t('n_' + LV.id), g.t('b_' + LV.boss) + ' · ' + g.t('bd'), 3);
        else banner(g.t('n_' + LV.id), g.t('r' + LV.r) + ' · ' + LV.r + '-' + LV.n, 2.4);
        break;
      }
      case 'nut': FX.add(d.x, d.y, { n: 5, sp: 60, life: 0.3, c: col('#e8ecf2', E.w), r: 1.5, g: 0 }); break;
      case 'crate': toast('+3', col('#e8ecf2', E.w), d.x, d.y - 6); FX.add(d.x, d.y, { n: 10, sp: 100, life: 0.5, c: col('#d7b27a', E.y), r: 2, g: 500 }); break;
      case 'stopE': toast('+' + L.PTS.stop, col('#ffe08a', E.y), d.x, d.y - 10); FX.add(d.x, d.y, { n: 8, sp: 70, life: 0.35, c: col('#e0b040', E.y), r: 1.8 }); if (tut.key && !tut.stop && s.LV.r === 1) { tut.stop = 1; msg(g.t('tutStop'), t.accent, 3.2); } break;
      case 'dismantle': toast('+' + L.PTS.dismantle, col('#fff4e6', E.w), d.x, d.y - 8); FX.add(d.x, d.y, { n: 14, sp: 120, life: 0.5, c: col('#c9cdd4', E.l), r: 2, g: 400 }); break;
      case 'wind': FX.add(d.x, d.y - 16, { n: 10, sp: 70, life: 0.4, c: col('#ffd27a', E.y), r: 1.8 }); break;
      case 'boing': if (P) FX.add(P.x, P.y, { n: 8, sp: 80, life: 0.35, c: col('#ffffff', E.w), r: 1.8, a: Math.PI / 2, spread: 2.4 }); break;
      case 'heart': toast(g.t('heart'), col('#ff8a9a', E.R), d.x, d.y - 12, true); break;
      case 'camp': toast(g.t('camp'), col('#ffd27a', E.y), d.x, d.y - 32); break;
      case 'land': if (d.v > 380 && P) FX.add(P.x, P.y, { n: 4, sp: 40, life: 0.3, c: col('#e8d7c0', E.l), r: 1.5, a: -Math.PI / 2, spread: 2.6, g: 120 }); break;
      case 'hurt': ui.shake = 0.25; FX.add(d.x, d.y - 10, { n: 10, sp: 110, c: col('#ff8a8a', E.R), r: 2 }); break;
      case 'die': ui.shake = 0.4; msg(g.t('d_' + d.why, ''), t.bad, 1.6); break;
      case 'thud': if (d.big) ui.shake = Math.max(ui.shake, 0.25); break;
      case 'bossIntro': banner(g.t('b_' + d.k), g.t('bd'), 2.2, null, t.bad); break;
      case 'bossHit': FX.add(d.x, d.y, { n: 12, sp: 130, c: col('#ffe36a', E.y), r: 2 }); ui.shake = 0.2; break;
      case 'bossDown': ui.shake = 0.6; FX.add(d.x, d.y, { n: 40, sp: 200, c: col('#ffd27a', E.y), r: 2.6, life: 0.9 }); break;
      case 'finish': FX.add(d.x, d.y - 30, { n: 30, sp: 150, c: col('#ffd27a', E.y), r: 2.2, life: 0.8 }); break;
      case 'clear': onClear(d); break;
      case 'gameover':
        runLives = L.K.LIVES; syncScore();
        setTimeout(function () { if (g._sceneName === 'play' && game && S().phase === 'over') { syncScore(); g.gameover(); } }, 1400);
        break;
    }
  }
  function onClear(d) {
    var s = S(), LV = s.LV, rg = d.ring || {};
    runLives = s.lives;
    var nb = SK.save.apply(prog, d.id, d.stars, d.score);
    var nx = MAP.next(d.id); prog.at = nx && MAP.isOpen(prog, nx) ? nx : d.id;
    store.save(prog); syncScore();
    var lines = [];
    if (!rg.boss) lines.push(g.t('tFinish') + ' +' + L.PTS.finish);
    else lines.push(g.t('b_' + LV.boss) + ' +' + L.PTS.boss);
    if (rg.time) lines.push(g.t('tTime') + ' +' + rg.time);
    if (rg.all) lines.push('★ ' + g.t('tAll') + ' +' + L.PTS.allNuts);
    if (rg.noHit) lines.push('★ ' + g.t('tNoHit') + ' +' + L.PTS.noHit);
    lines.push(g.t('score') + ': ' + d.score + (nb ? ' · ' + g.t('newBest') : ''));
    lines.push(g.t('next'));
    banner(rg.boss ? g.t('clearBoss') : g.t('clear'), g.t('n_' + d.id) + '  ' + '★★★'.slice(0, d.stars) + '☆☆☆'.slice(0, 3 - d.stars), 99, lines, th().good);
    result = { id: d.id, t: 0, final: d.id === MAP.FINAL };
  }

  // ---------- забег / Верстак / уровень ----------
  function newRun() {
    runLives = L.K.LIVES;
    game = SK.Game({ onEvent: onEvent, rng: L.mulberry32((Date.now() & 0xffff) + 1) });
    SK.current = game; ui.toasts = []; ui.banner = null; ui.msg = null; FX.clear(); result = null;
    toSelect(prog.at);
  }
  function toSelect(at) {
    mode = 'select'; result = null; ui.banner = null; ui.msg = null;
    if (!MAP.isOpen(prog, at)) at = MAP.FIRST;
    M.prog = prog; M.sel = at; M.note = '';
    syncScore(); music(SK.MUSIC.map);
  }
  function enterLevel(id) {
    if (!MAP.isOpen(prog, id)) { M.note = g.t('locked'); M.noteA = 1.4; SK.sfx(g, 'map', { ok: false }); return; }
    mode = 'level'; prog.at = id; store.save(prog);
    game.startLevel(id, { lives: runLives }); cam = -1; playSince = g.time; ui.runPh = 0;
  }
  function selMove(a) {
    var n = MAP.node(M.sel), r = n.r, k = n.n;
    if (a === 'left') k--; else if (a === 'right') k++; else if (a === 'up') r--; else if (a === 'down') r++; else return;
    if (k < 1) { if (r > 1) { r--; k = 5; } else k = 1; }
    if (k > 5) { if (r < MAP.REGIONS) { r++; k = 1; } else k = 5; }
    r = Math.max(1, Math.min(MAP.REGIONS, r));
    var id = MAP.region(r)[k - 1]; if (!id || id === M.sel) return;
    M.sel = id; M.note = ''; SK.sfx(g, 'map', { ok: MAP.isOpen(prog, id) });
  }
  function finishResult() {
    if (!result) return;
    var r = result; result = null; ui.banner = null;
    if (r.final) { syncScore(); g.win(); return; }
    var go = function () { if (g._sceneName === 'play' && mode === 'level') toSelect(prog.at); };
    var p = g.adBreak(); if (p && p.then) p.then(go, go); else go();   // межстраничная — по нажатию игрока между уровнями
  }

  // ---------- стандартные экраны и меню ----------
  g.useStandardScreens({ lives: L.K.LIVES });
  var resetArm = 0;
  g.menu.addItem({ key: 'reset', after: 'play', label: function () { return resetArm > g.time ? g.t('resetQ') : g.t('reset'); },
    onSelect: function () { if (resetArm > g.time) { prog = store.reset(); M.prog = prog; resetArm = 0; game = null; syncScore(); titleNote = { text: g.t('resetDone'), a: 2 }; } else resetArm = g.time + 3; } });
  g.menu.addItem({ key: 'tosel', scene: 'pause', before: 'menu', label: function () { return g.t('toSel'); },
    onSelect: function () { if (game && mode === 'level') { var s = S(); runLives = Math.max(1, s.lives); s.phase = 'idle'; toSelect(prog.at); } g.goto('play', { resume: true }); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  // ---------- площадка (движок v2.8/2.9): таблица лидеров «skok», «Без рекламы» (no_ads) в меню и паузе, реклама за награду ----------
  // Консоль: Яндекс — лидерборд с техническим именем «skok», GamePush — числовое поле игрока «skok» + лидерборд; товар no_ads
  // (постоянный). Список — promo/skok/platform.json (arcade-full). На сайте (без площадки) пунктов нет.
  var LB = 'skok';
  g.persist('arcade.best.skok', 'max'); g.persist(SK.save.KEY, 'last');
  function lbBest() { var b = g.state.best; if (b > 0) g.leaderboard.submit(b, { board: LB }); }
  g.useLeaderboard({ boards: [{ id: LB, label: function () { return g.t('best'); } }], after: 'end' });
  g.useNoAds({ scene: ['title', 'pause'], after: 'end' });
  g.onCloud(function (keys) { if (keys.length) lbBest(); });   // облако слито: рекорд с другого устройства — в таблицу
  g.onCloud(function (keys) { if (keys.indexOf(SK.save.KEY) >= 0) { prog = store.load(); M.prog = prog; if (mode === 'select') M.sel = prog.at; syncScore(); } });
  // «Ещё один шанс» (раз за партию): 3 пружины, с последнего фонаря; бонус в паузе — все сердца
  g.useRewardedContinue({ revive: function () { if (game && mode === 'level') game.revive(); } });
  g.useRewardedBonus({ key: 'rwHeart', scene: 'pause', label: function () { return g.t('rwHeart'); },
    available: function () { return !!game && mode === 'level' && game.canBoost(); }, grant: function () { if (game) game.boost(); } });
  // меню вмещает пункты площадки («Лидеры», «Без рекламы»): если пунктов больше, чем помещается, шаг сжимается (не меньше 16)
  function menuFit(m, y0, base, yMin, yMax) { var n = m.items.length, need = base * (n - 1); if (n < 2 || y0 + need <= yMax) return [y0, base]; var st = Math.max(16, Math.min(base, (yMax - yMin) / (n - 1))); return [Math.max(yMin, yMax - st * (n - 1)), st]; }

  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      ctx.save(); ctx.translate(this.W / 2, this.H / 2 - 50); ctx.scale(2, 2);
      R.hero(ctx, 0, 0, { face: 1, run: name === 'win' ? this.time * 8 : 0, air: name === 'win' && Math.sin(this.time * 4) > 0.5 }, retro(), this.time);
      ctx.restore();
      var st = SK.save.stats(prog);
      this.text('✓ ' + st.cleared + '/' + st.total + ' · ★ ' + st.stars + '/' + st.maxStars, this.W / 2, this.H / 2 + 44, { size: 12, align: 'center', color: th().muted, weight: 700 });
    };
  });

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var rtr = retro(), Wc = this.W, Hc = this.H, t = this.time, Pc = th();
    ctx.imageSmoothingEnabled = !rtr;
    R.background(ctx, 1, t * 18, rtr, t);
    var P = R.REG[1][rtr ? 'r' : 'm'];
    for (var i = 0; i < 17; i++) { var X = i * 32; ctx.fillStyle = P.g[i % 4]; ctx.fillRect(X, Hc - 44, 32, 44); ctx.fillStyle = P.top; ctx.fillRect(X, Hc - 44, 32, 5); }
    if (!rtr) { ctx.fillStyle = 'rgba(20,10,8,.35)'; ctx.fillRect(0, 0, Wc, Hc - 44); }
    var tt = this.t('title');
    R.cog(ctx, Wc / 2, 46, 34, 12, rtr ? R.E.n : 'rgba(255,190,110,.22)', t * 0.4, rtr ? 0 : 16);
    ctx.save(); ctx.textAlign = 'center';
    var fs = tt.length > 6 ? (rtr ? 36 : 42) : (rtr ? 46 : 54);
    ctx.font = rtr ? 'bold ' + fs + 'px "Courier New", monospace' : '900 ' + fs + 'px Inter, system-ui, sans-serif';
    if (rtr) { ctx.fillStyle = R.E.r; ctx.fillText(tt, Wc / 2 + 3, 65); ctx.fillStyle = R.E.y; ctx.fillText(tt, Wc / 2, 62); }
    else { ctx.fillStyle = 'rgba(40,10,0,.55)'; ctx.fillText(tt, Wc / 2 + 2, 66); var lg = ctx.createLinearGradient(0, 22, 0, 64); lg.addColorStop(0, '#fff4e0'); lg.addColorStop(0.5, '#ffb066'); lg.addColorStop(1, '#d9662a'); ctx.fillStyle = lg; ctx.fillText(tt, Wc / 2, 63); }
    ctx.restore();
    this.text(this.t('subtitle'), Wc / 2, 88, { size: rtr ? 10 : 11, align: 'center', color: Pc.ink, weight: 700, maxWidth: Wc - 30, minSize: 8 });
    // Скок останавливает ключом шестерёнку: взмах — серая, ключ торчит
    var ph = (t * 0.8) % 3, sw = ph > 1 && ph < 1.25 ? (ph - 1) / 0.25 : 0, stoppedG = ph > 1.15;
    ctx.save(); ctx.translate(86, Hc - 44); ctx.scale(2.4, 2.4);
    R.hero(ctx, 0, 0, { face: 1, run: 0, air: false, swing: sw }, rtr, t);
    ctx.restore();
    R.enemy(ctx, { k: 'g', x: stoppedG ? 142 : 200 - Math.min(1, ph) * 58, y: Hc - 44, dir: -1, alive: true, h: 12, hw: 6, stop: stoppedG ? 5 * (1 - (ph - 1.15) / 1.85) : 0 }, stoppedG ? 0 : t, rtr);
    var mf = menuFit(menu, 120, 24, 104, Hc - 60); menu.draw(this, Wc / 2 + 40, mf[0], mf[1]);
    var line = [], st = SK.save.stats(prog);
    if (this.state.best) line.push(this.t('best') + ': ' + this.state.best);
    if (st.cleared) line.push('✓ ' + st.cleared + '/' + st.total + ' ★ ' + st.stars);
    if (titleNote && titleNote.a > 0) { titleNote.a -= 1 / 60; this.text(titleNote.text, Wc / 2, Hc - 32, { size: 10, align: 'center', color: Pc.warn, weight: 800, maxWidth: Wc - 20, minSize: 7 }); }
    else if (line.length) this.text(line.join('   '), Wc / 2, Hc - 32, { size: 11, align: 'center', color: Pc.ink, weight: 800, maxWidth: Wc - 20, minSize: 8 });
    this.text(this.t('hint'), Wc / 2, Hc - 12, { size: rtr ? 9 : 10, align: 'center', color: rtr ? R.E.w : '#fff4e6', weight: 700, maxWidth: Wc - 20, minSize: 7 });
  };

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  function tutorial(s) {   // подсказки обучения — только в первом крае, один раз за уровень
    if (s.LV.r !== 1 || s.phase !== 'play') return;
    var P = s.hero;
    if (!tut.key && s.enemies.some(function (e) { return e.alive && !e.stop && e.k !== 'P' && Math.abs(e.x - P.x) < 110 && Math.abs(e.y - P.y) < 40; })) { tut.key = 1; msg(g.t('tutKey'), th().accent, 3.2); }
    s.LV.groups.forEach(function (gr) {
      var spring = gr.tiles.some(function (q) { return q.k === 'S'; }), k = spring ? 'spring' : 'winch';
      if (!tut[k] && !(gr.t > 0) && Math.abs(gr.winch.tx * T + 8 - P.x) < 90) { tut[k] = 1; msg(g.t('tutWinch') + (spring ? ' · ' + g.t('tutSpring') : ''), th().accent, 3.4); }
    });
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) {
      if (!(d && d.resume) || !game) newRun();
      else if (mode === 'select') music(SK.MUSIC.map);
      playSince = g.time;
    },
    press: function (a) {
      if (a === 'pause') { this.pause(); return; }
      if (!game) return;
      if (mode === 'select') {
        if (a === 'left' || a === 'right' || a === 'up' || a === 'down') selMove(a);
        else if ((a === 'action' || a === 'start') && g.time - playSince > 0.2) enterLevel(M.sel);
        return;
      }
      if (result && result.t > 0.8 && (a === 'action' || a === 'start')) finishResult();
    },
    update: function (dt) {
      if (!game) return;
      var i;
      for (i = 0; i < ui.toasts.length; i++) ui.toasts[i].t -= dt;
      ui.toasts = ui.toasts.filter(function (q) { return q.t > 0; });
      if (ui.banner) { ui.banner.a -= dt; if (ui.banner.a <= 0) ui.banner = null; }
      if (ui.msg) { ui.msg.a -= dt; if (ui.msg.a <= 0) ui.msg = null; }
      if (ui.shake > 0) ui.shake = Math.max(0, ui.shake - dt);
      if (mode === 'select') { if (M.noteA > 0) { M.noteA -= dt; if (M.noteA <= 0) M.note = ''; } return; }
      var s = S(), dir = this.input.dir, live = g.time - playSince > 0.25 && s.phase === 'play';
      var jump = live && (this.input.pressed('action') || extra.jump);
      game.setInput(live ? dir.x : 0, jump);
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k2 = 0; k2 < n; k2++) game.update(STEP);
      s = S();
      if (!s.LV) return;
      tutorial(s);
      var P = s.hero;
      ui.runPh += Math.abs(P.vx) * 0.12 * dt;
      var maxC = Math.max(0, s.LV.w * T - VW), tgt = Math.max(0, Math.min(maxC, P.x - VW / 2 + P.face * 40));
      if (s.LV.fort && s.boss && s.boss.st !== 'sleep' && s.boss.alive) tgt = Math.max(tgt, s.LV.arenaX);
      if (cam < 0) cam = tgt; else cam += (tgt - cam) * Math.min(1, dt * 5);
      FX.step(dt);
      if (result) { result.t += dt; if (result.t > 9) finishResult(); }
    },
    draw: function (ctx) {
      if (!game) { this.clear(); return; }
      if (mode === 'select') { SK.renderSelect(g, ctx, M); return; }
      ui.cam = cam + (ui.shake > 0 ? (Math.random() - 0.5) * 8 * ui.shake / 0.4 : 0);
      SK.renderLevel(g, ctx, S(), ui);
    }
  });

  // ---------- доп. клавиши, тач, указатель ----------
  var JUMP = { KeyZ: 1, KeyK: 1 }, KEY = { KeyX: 1, KeyJ: 1 };
  function inLevel() { return g._sceneName === 'play' && game && mode === 'level' && S().phase === 'play' && g.time - playSince > 0.25; }
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play';
    if (JUMP[e.code]) { held[e.code] = true; extra.jump = !!(held.KeyZ || held.KeyK); if (ip) e.preventDefault(); if (ip && mode !== 'level' && !e.repeat) g.scenes.play.press.call(g, 'action'); return; }
    if (KEY[e.code]) { if (ip) e.preventDefault(); if (!e.repeat && inLevel()) game.strike(); else if (!e.repeat && ip && mode === 'level' && result) g.scenes.play.press.call(g, 'action'); }
  });
  addEventListener('keyup', function (e) { if (JUMP[e.code]) { held[e.code] = false; extra.jump = !!(held.KeyZ || held.KeyK); } });
  addEventListener('blur', function () { held = {}; extra.jump = false; });
  function tap(id, fn) { var b = document.getElementById(id); if (!b) return; var h = function (e) { if (!Arcade.touchOk(e)) return; fn(); b.classList.add('on'); setTimeout(function () { b.classList.remove('on'); }, 120); }; b.addEventListener('touchstart', h, { passive: false }); b.addEventListener('mousedown', h); }
  tap('bKey', function () { if (inLevel()) game.strike(); else if (g._sceneName === 'play' && game && (mode === 'select' || result)) g.scenes.play.press.call(g, 'action'); });
  tap('bPause', function () { if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });
  // Верстак мышью/тапом: тап по клетке — выбрать, по выбранной — в путь
  g.canvas.addEventListener('pointerdown', function (e) {
    if (g._sceneName !== 'play' || !game) return;
    if (mode === 'level') { if (result && result.t > 0.8) finishResult(); return; }
    var rc = g.canvas.getBoundingClientRect(), x = (e.clientX - rc.left) * VW / rc.width, y = (e.clientY - rc.top) * VH / rc.height, id = R.selectAt(x, y);
    if (!id) return;
    e.preventDefault();
    if (id === M.sel) enterLevel(id); else { M.sel = id; M.note = ''; SK.sfx(g, 'map', { ok: MAP.isOpen(prog, id) }); }
  });

  // ---------- DOM: подгонка канвы, подписи, тема страницы ----------
  function fit() {
    var c = g.canvas, wrap = c.parentElement, padEl = document.querySelector('.pad');
    var padFixed = padEl && getComputedStyle(padEl).position === 'fixed';
    var padH = padEl && !padFixed && getComputedStyle(padEl).display !== 'none' ? padEl.offsetHeight + 16 : 0;
    var foot = document.getElementById('foot'), footH = foot && getComputedStyle(foot).display !== 'none' ? foot.offsetHeight + 18 : 0;
    var w = Math.min(1120, (wrap && wrap.clientWidth) || g.W, (innerHeight - padH - footH - 40) * g.W / g.H);
    w = Math.max(200, Math.floor(w)); c.style.width = w + 'px'; c.style.height = Math.round(w * g.H / g.W) + 'px';
  }
  var lastLang = null, lastTheme = null;
  function domSync() {
    if (g.i18n.lang !== lastLang) {
      lastLang = g.i18n.lang; document.documentElement.lang = lastLang;
      var f = document.getElementById('foot'); if (f) f.innerHTML = g.t('foot');   // строки — наши, из i18n.js
      fit();
    }
    if (g.themeName !== lastTheme) { lastTheme = g.themeName; document.body.setAttribute('data-theme', lastTheme); }
    requestAnimationFrame(domSync);
  }
  addEventListener('resize', fit); fit(); domSync();

  syncScore();
  g.start('title');
  SK.app = { g: g, game: function () { return game; }, mode: function () { return mode; }, prog: function () { return prog; }, enterLevel: enterLevel, toSelect: toSelect, ui: ui, M: M };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
