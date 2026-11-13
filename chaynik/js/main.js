/* ЧАЙНИК · сборка: фреймворк Гефест Arcade (engine.js) + логика (levels.js, game.js) + рендер обеих тем + звук.
   Сцены title/pause/win/gameover — g.useStandardScreens; титул перерисован; своя сцена «продолжить?» (2 продолжения).
   Ввод: ←→/AD — ход; Пробел/Z — прыжок; X/J/F/Ctrl — пар (держать; ↑/↓ — прицел); C/K/Shift — кипяток;
   ↑ у крюка — хват; R — заново головоломку; тач: дпад, ● прыжок, ≋ пар (держать), ✹ кипяток, II пауза.
   Рекорд — arcade.best.chaynik (движок). Темы уровней — Arcade.tracks['chaynik:N'] из js/music.js. */
(function (global) {
  'use strict';
  var CH = global.CHAYNIK, L = CH.logic, R = CH.R, FX = R.FX, VW = R.VW, VH = R.VH, LVL = CH.levels;
  var TH = Arcade.themes || {};
  var themes = {
    modern: Object.assign({}, TH.modern, { bg: '#17110f', panel: '#211815', ink: '#f7efe2', muted: '#b9aa98', accent: '#e8b04a', grid: '#3a2c24', good: '#7bd389', bad: '#ff6b5a', warn: '#ffd166' }),
    retro: Object.assign({}, TH.retro, { bg: '#000000', panel: '#000000', accent: '#ffff55', muted: '#aaaaaa', ink: '#ffffff', good: '#55ff55', bad: '#ff5555', warn: '#ffff55' })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'chaynik', strings: CH.STR, theme: 'modern', lives: L.K.LIVES, themes: themes });
  CH.g = g;
  g.input.bindDpad(document.querySelector('.pad'));

  var game = null, banner = null, cam = { x: 0, y: 0 }, playSince = 0, padFire = false, padBoil = false, shake = 0;
  function S() { return game.state(); }
  function sync() { if (!game) return; var s = S(); g.state.score = s.score; g.state.lives = Math.max(0, s.lives); g.state.level = s.level; }
  function retro() { return g.themeName === 'retro'; }
  function col(m, r) { return retro() ? r : m; }
  function showBanner(title, sub, dur, lines, color) { banner = { title: title, sub: sub, a: dur || 2.4, dur: dur || 2.4, lines: lines, color: color }; }
  function lvName(n) { return g.t('level') + ' ' + n + ' · ' + g.t('l' + n); }
  function track(n) { var t = Arcade.tracks; return (t && t['chaynik:' + n]) || (t && t.chaynik); }
  function txt(x, y, s, c, big) { FX.text(x, y, s, c, big); }

  function heroXY() { var s = S(); if (s.hero) return { x: s.hero.x, y: s.hero.y - 24 }; if (s.fly) return { x: s.fly.x + cam.x, y: s.fly.y - 20 }; return { x: 0, y: 0 }; }
  function onEvent(type, d) {
    d = d || {};
    CH.sfx(g, type, d);
    var s = game ? S() : null, E = R.E, p;
    switch (type) {
      case 'level':
        FX.clear(); banner = null; cam.snap = true;
        g.setMusic(track(d.n));
        showBanner(lvName(d.n), g.t('g' + d.n), 3); break;
      case 'kill': FX.add(d.x, d.y, { n: 12, sp: 140, c: col('#f2e6c8', E.w), r: 2.2 }); FX.add(d.x, d.y, { n: 5, sp: 50, c: col('#ffffff', E.w), r: 5, g: -60, puff: true, life: 0.6 }); txt(d.x, d.y - 10, '+' + d.pts, col('#ffd166', E.y)); break;
      case 'enemyHit': FX.add(d.x, d.y - 8, { n: 2, sp: 60, life: 0.2, c: col('#ffffff', E.w), r: 1.5 }); break;
      case 'puffWall': FX.add(d.x, d.y, { n: d.boil ? 10 : 2, sp: d.boil ? 140 : 40, life: 0.35, c: col('#ffffff', E.w), r: d.boil ? 4 : 3, puff: true, g: -40 }); break;
      case 'sugar': FX.add(d.x, d.y, { n: 4, sp: 60, life: 0.3, c: col('#ffffff', E.w), r: 1.5, g: 0 }); txt(d.x, d.y - 8, '+50', col('#ffffff', E.w)); break;
      case 'leaf': FX.add(d.x, d.y, { n: 8, sp: 80, life: 0.4, c: col('#7bd389', E.G), r: 2, g: 0 }); txt(d.x, d.y - 12, d.full ? g.t('leafFull') : '+', col('#7bd389', E.G), d.full); break;
      case 'heart': txt(d.x, d.y - 12, g.t('heart'), col('#ff8aa0', E.R), true); break;
      case 'life': p = heroXY(); txt(p.x, p.y - 30, g.t('life'), col('#ff8aa0', E.R), true); break;
      case 'cp': if (s.kind === 'fly') txt(VW / 2, 80, g.t('cp'), col('#7bd389', E.G), true); else txt(d.x, d.y - 50, g.t('cp'), col('#7bd389', E.G)); break;
      case 'grab': FX.add(d.x, d.y, { n: 5, sp: 50, life: 0.25, c: col('#ffe08a', E.y), r: 1.6, g: 0 }); break;
      case 'overheat': p = heroXY(); if (s.kind !== 'fly' && s.kind !== 'race') { FX.add(p.x, p.y - 10, { n: 14, sp: 120, a: -Math.PI / 2, spread: 1.4, c: col('#ffffff', E.w), r: 5, g: -80, puff: true, life: 0.9 }); txt(p.x, p.y - 30, g.t('overheat'), col('#ff6b5a', E.R), true); } break;
      case 'cooled': break;
      case 'boil': if (s.kind === 'plat' || s.kind === 'boss') FX.add(d.x, d.y, { n: 12, sp: 160, c: col('#ffd38a', E.y), r: 3, puff: true, g: -30, life: 0.5 }); shake = 0.15; break;
      case 'noCharge': p = heroXY(); txt(p.x, p.y - 24, g.t('noCharge'), col('#b9aa98', E.l)); break;
      case 'scald': FX.add(d.x, d.y - 4, { n: 10, sp: 140, a: -Math.PI / 2, spread: 1.6, c: col('#ff8a2a', E.R), r: 2.5, life: 0.5 }); break;
      case 'hurt': if (s.kind === 'fly') FX.add(d.x, d.y - 70, { n: 10, sp: 120, c: col('#f6ead0', E.w), r: 2.5 }); else FX.add(d.x, d.y - 14, { n: 10, sp: 140, c: col('#ffd38a', E.y), r: 2 }); shake = 0.2; break;
      case 'die':
        shake = 0.35;
        if (d.kind === 'boil') FX.add(d.x, d.y - 14, { n: 30, sp: 160, a: -Math.PI / 2, spread: 2.2, c: col('#ffffff', E.w), r: 6, g: -90, puff: true, life: 1.4 });
        else if (d.kind === 'crack') FX.add(d.x, d.y - 14, { n: 16, sp: 160, c: col('#d9a43c', E.y), r: 2.5, life: 1 });
        else if (d.kind === 'pop') FX.add(d.x, d.y - 74, { n: 20, sp: 200, c: col('#f6ead0', E.w), r: 3, life: 0.9 });
        else if (d.kind === 'cold') FX.add(d.x, d.y - 14, { n: 14, sp: 50, c: col('#cfe6ff', E.Cc), r: 2, g: -30, life: 1.4 });
        var key = 'd_' + (d.kind === 'woke' ? 'woke_' + d.why : d.kind);
        showBanner(g.t(key), (s.lives - 1) > 0 ? g.t('dsub').replace('{n}', s.lives - 1) : '', 1.8, null, themes[g.themeName === 'retro' ? 'retro' : 'modern'].bad); break;
      case 'respawn': cam.snap = true; break;
      case 'demag': FX.add(d.x, d.y, { n: 16, sp: 120, c: col('#ff8a8a', E.R), r: 2 }); txt(d.x, d.y - 20, g.t('demag'), col('#ffd166', E.y), true); break;
      case 'tap': p = heroXY(); if (s.kind === 'plat' || s.kind === 'boss') FX.add(p.x, p.y - 16, { n: 6, sp: 40, c: col('#9fdcff', E.Cc), r: 2, g: 100, life: 0.5 }); break;
      case 'toast': break;
      case 'splat': FX.add(d.x, d.y, { n: 6, sp: 80, c: d.k === 'toast' ? col('#d9a05a', E.n) : d.k === 'drop' ? col('#b5651d', E.n) : col('#ffffff', E.w), r: 2, life: 0.4 }); break;
      case 'crack': FX.add(d.x, d.y, { n: 14, sp: 150, c: col('#f7f4ee', E.w), r: 2.5, life: 0.7 }); txt(d.x, d.y - 30, g.t('crackTxt') + (d.n > 1 ? ' ×2' : ''), col('#ffd166', E.y), true); shake = 0.25; break;
      case 'shield': txt(d.x, d.y - 40, g.t('shield'), col('#9fc3ff', E.Cc)); break;
      case 'ting': if (Math.random() < 0.3) FX.add(d.x, d.y, { n: 2, sp: 60, life: 0.2, c: col('#ffffff', E.w), r: 1.4 }); break;
      case 'shatter': FX.add(d.x, d.y, { n: 40, sp: 240, c: col('#f7f4ee', E.w), r: 3, life: 1 }); FX.add(d.x, d.y, { n: 14, sp: 160, c: col('#2f63b8', E.B), r: 2.5, life: 1 }); txt(d.x, d.y - 40, '+3000', col('#ffd166', E.y), true); shake = 0.45; break;
      case 'stage2': showBanner(g.t('stage2'), '', 1.6); break;
      case 'slam': shake = 0.3; FX.add(d.x, d.y, { n: 10, sp: 120, c: col('#f7f4ee', E.w), r: 2, life: 0.4 }); break;
      case 'lidOut': FX.add(d.x, d.y - 60, { n: 30, sp: 200, c: col('#ffe7a3', E.y), r: 2.5, life: 1 }); break;
      case 'lid': txt(d.x, d.y - 30, g.t('lid'), col('#ffd166', E.y), true); break;
      case 'crash': shake = 0.3; FX.add(d.x, L.trackY(d.x) - 20, { n: 16, sp: 160, c: col('#ffffff', E.w), r: 2.5, life: 0.6 }); break;
      case 'bumpCrumb': FX.add(d.x, L.trackY(d.x) - 6, { n: 6, sp: 80, c: col('#c98a4a', E.n), r: 2, life: 0.4 }); break;
      case 'blast': FX.add(d.x, d.y, { n: 18, sp: 180, c: col('#ffd38a', E.y), r: 3, life: 0.6, puff: true, g: -40 }); txt(d.x, d.y - 20, '+200', col('#ffd166', E.y)); break;
      case 'count': showBanner(d.n > 0 ? String(d.n) : g.t('count'), '', 0.9); break;
      case 'swatDown': FX.add(d.x, d.y + 20, { n: 40, sp: 220, c: col('#3aa35a', E.g), r: 3, life: 1 }); break;
      case 'pz_puff': pzPuff(); break;
      case 'pz_blow': pzBlow(+d.k); break;
      case 'clear':
        var lines = [g.t('tTime') + ': ' + d.time.toFixed(1) + ' s   ' + g.t('tBonus') + ' +' + d.tb + (d.nb ? '   ' + g.t('tNoDeath') + ' +' + d.nb : ''), g.t('tTotal') + ' +' + (d.tb + d.nb + 1000)];
        showBanner(g.t('clear'), lvName(d.level), 3.1, lines); break;
      case 'gameover': sync(); g.state.lives = 0; break;
      case 'win': sync(); break;
    }
    sync();
  }
  // пар в головоломке — частицы в экранных координатах
  function pzPuff() { var s = S().pz.s, P = R.PZ, D = CH.puzzle.D[s.f], x = P.X + s.x * P.CELL + 16, y = P.Y + s.y * P.CELL + 12; FX.add(x + D[0] * 14, y + D[1] * 14, { n: 10, sp: 160, a: Math.atan2(D[1], D[0]), spread: 0.5, c: '#ffffff', r: 4, puff: true, g: 0, life: 0.5 }); }
  function pzBlow(k) { var B = L.PB, P = R.PZ, x = P.X + (k % B.w) * P.CELL + 16, y = P.Y + Math.floor(k / B.w) * P.CELL + 16; FX.add(x, y, { n: 10, sp: 140, c: '#c98a4a', r: 2, g: 0, life: 0.5 }); }

  function newGame() { game = CH.Game({ seed: (Date.now() & 0xffff) + 1, onEvent: onEvent }); FX.clear(); banner = null; game.start(); CH.current = game; sync(); }
  function inPlay() { return g._sceneName === 'play' && game && g.time - playSince > 0.15; }

  // ---------- стандартные экраны ----------
  g.useStandardScreens({ lives: L.K.LIVES });
  g.menu.addItem({ key: 'restart', scene: 'pause', before: 'menu', label: function () { return g.t('restart'); },
    onSelect: function () { if (game) { game.restartLevel(); sync(); } if (game && game.state().phase === 'over') toOver(); else g.goto('play', { resume: true }); } });
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };
  ['win', 'gameover'].forEach(function (name) {
    var sc = g.scenes[name], baseDraw = sc.draw;
    sc.draw = function (ctx) {
      baseDraw.call(this, ctx);
      R.setRetro(retro());
      var t = this.time;
      if (name === 'win') { R.kettle(ctx, this.W / 2, this.H / 2 - 52, { face: 1, t: t, pose: 'jump', scale: 2.2 }); R.circ(ctx, this.W / 2 + 2, this.H / 2 - 124 - Math.abs(Math.sin(t * 4)) * 6, 0.1, '#000'); lidOnTop(ctx, this.W / 2, this.H / 2 - 120 - Math.abs(Math.sin(t * 4)) * 8); }
      else R.kettle(ctx, this.W / 2, this.H / 2 - 56, { face: 1, t: t, pose: 'stand', scale: 2, idle: 3, death: { kind: 'cold', t: 1 } });
      if (game) this.text(this.t('level') + ': ' + S().level + '/6', this.W / 2, this.H / 2 + 50, { size: 13, align: 'center', color: this.th().muted, weight: 700 });
    };
  });
  function lidOnTop(ctx, x, y) { R.circ(ctx, x, y, 0.1, '#000'); ctx.save(); ctx.fillStyle = retro() ? R.E.y : '#d9a43c'; ctx.beginPath(); ctx.ellipse(x, y, 22, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = retro() ? R.E.w : '#ffe7a3'; ctx.beginPath(); ctx.arc(x, y - 7, 6, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }

  // ---------- «Продолжить?» ----------
  var contMenu = new Arcade.Menu([
    { key: 'yes', label: function () { return g.t('contYes').replace('{n}', game ? S().cont : 0); }, onSelect: function () { g.saveBest(); if (game && game.continueGame()) { sync(); g.goto('play', { resume: true }); } } },
    { key: 'no', label: function () { return g.t('contNo'); }, onSelect: function () { g.gameover(); } }
  ]);
  g.scene('cont', { realtime: true, _menu: contMenu,
    enter: function () { this._t = 9.99; contMenu.sel = 0; this.saveBest(); },
    update: function (dt) { this._t -= dt; if (this._t <= 0) this.gameover(); },
    draw: function (ctx) {
      if (game) drawPlay(ctx);
      ctx.fillStyle = retro() ? 'rgba(0,0,0,.8)' : 'rgba(12,8,10,.78)'; ctx.fillRect(0, 0, VW, VH);
      this.text(this.t('contTitle'), VW / 2, 110, { size: 34, align: 'center', color: this.th().accent });
      this.text(String(Math.max(0, Math.ceil(this._t - 0.99))), VW / 2, 170, { size: 46, align: 'center', color: this.th().ink });
      contMenu.draw(this, VW / 2, 222, 30);
      this.text(this.t('contHint'), VW / 2, VH - 30, { size: 12, align: 'center', color: this.th().muted, weight: 600 });
    } });
  function toOver() { if (game && S().cont > 0) g.goto('cont'); else g.gameover(); }

  // ---------- титул ----------
  var title = g.scenes.title, menu = g.menu.get('title');
  title.draw = function (ctx) {
    var rt = retro(), t = this.time, th = this.th(); R.setRetro(rt);
    // кухня: кафель, стол, окно
    ctx.fillStyle = rt ? '#000' : '#2b1d2e'; ctx.fillRect(0, 0, VW, VH);
    for (var y = 0; y < VH - 70; y += 32) for (var x = 0; x < VW; x += 32) { ctx.fillStyle = ((x + y) / 32 & 1) ? (rt ? R.E.b : '#4a3441') : (rt ? R.E.k : '#43303b'); ctx.fillRect(x + 1, y + 1, 30, 30); }
    if (!rt) { var gr = ctx.createLinearGradient(0, 0, 0, VH); gr.addColorStop(0, 'rgba(10,5,10,.65)'); gr.addColorStop(0.6, 'rgba(10,5,10,.25)'); gr.addColorStop(1, 'rgba(10,5,10,.7)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, VW, VH); }
    ctx.fillStyle = rt ? R.E.y : '#e8b46a'; ctx.fillRect(0, VH - 70, VW, 5); ctx.fillStyle = rt ? R.E.n : '#7a4a2b'; ctx.fillRect(0, VH - 65, VW, 65);
    // логотип
    var tt = this.t('title');
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = rt ? 'bold 54px "Courier New", monospace' : '900 62px Inter, system-ui, sans-serif';
    if (!rt) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(tt, VW / 2 + 3, 77); var lgd = ctx.createLinearGradient(0, 28, 0, 76); lgd.addColorStop(0, '#fff0b8'); lgd.addColorStop(0.5, '#e8b04a'); lgd.addColorStop(1, '#9a5a1a'); ctx.fillStyle = lgd; ctx.fillText(tt, VW / 2, 74); }
    else { ctx.fillStyle = R.E.r; ctx.fillText(tt, VW / 2 + 3, 75); ctx.fillStyle = R.E.y; ctx.fillText(tt, VW / 2, 72); }
    ctx.restore();
    this.text(this.t('subtitle'), VW / 2, 100, { size: rt ? 12 : 13, align: 'center', color: th.ink, weight: 700 });
    this.text(this.t('sub2'), VW / 2, 118, { size: rt ? 10 : 11, align: 'center', color: th.muted, weight: 600 });
    // чайник на столе показывает сценки по кругу
    var cyc = t % 12, idle = cyc < 3 ? 0 : cyc < 6 ? 1 : cyc < 9 ? 2 : 3, kx = 110, ky = VH - 70;
    R.kettle(ctx, kx, ky, { face: 1, t: t, pose: 'stand', scale: 2.2, idle: idle });
    if (idle === 1) { ctx.fillStyle = rt ? R.E.y : '#ffe08a'; ctx.font = 'bold 20px serif'; ctx.textAlign = 'center'; ctx.fillText('♪', kx + 52 + Math.sin(t * 4) * 4, ky - 70 - (t * 24 % 20)); }
    if (idle === 2) for (var r = 0; r < 3; r++) { var q = (t * 0.8 + r / 3) % 1; ctx.strokeStyle = rt ? R.E.w : 'rgba(255,255,255,' + (1 - q) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(kx + 4, ky - 74 - q * 70, 8 + q * 10, 3 + q * 3, 0, 0, Math.PI * 2); ctx.stroke(); }
    if (idle === 3) { ctx.fillStyle = rt ? R.E.Cc : '#cfe6ff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('z z z', kx + 30, ky - 74 - (t * 10 % 10)); }
    // Заварник с Крышкой удирает справа
    R.porcelain(ctx, 'teapot', VW - 110 + Math.sin(t * 1.5) * 10, ky, { cracks: 0, temp: 0, inv: 0, dead: false, cd: 1 }, t, { stage: 2 });
    menu.draw(this, VW / 2, 158, 28);
    if (this.state.best) this.text(this.t('best') + ': ' + this.state.best, VW / 2, VH - 80, { size: 12, align: 'center', color: th.muted, weight: 700 });
    this.text(this.t('hint'), VW / 2, VH - 14, { size: rt ? 10 : 11, align: 'center', color: rt ? R.E.w : '#f7efe2', weight: 600 });
  };

  // ---------- игровая сцена ----------
  var STEP = 1 / 60;
  function updCam(dt) {
    var s = S(), LV = game.level(), snap = cam.snap;
    if (s.kind === 'plat' || s.kind === 'boss') {
      var h = s.hero, tx = h.x - VW / 2 + h.face * 50 + h.vx * 0.25, ty = h.y - VH * 0.58;
      tx = Math.max(0, Math.min(LV.w * 16 - VW, tx)); ty = Math.max(0, Math.min(LV.h * 16 - VH, ty));
      if (snap) { cam.x = tx; cam.y = ty; } else { cam.x += (tx - cam.x) * Math.min(1, dt * 5); cam.y += (ty - cam.y) * Math.min(1, dt * 4); }
    } else if (s.kind === 'race') {
      var Rr = s.race, rx = Rr.x - 180, ry = Rr.y - VH * 0.6;
      if (snap) { cam.x = rx; cam.y = ry; } else { cam.x += (rx - cam.x) * Math.min(1, dt * 8); cam.y += (ry - cam.y) * Math.min(1, dt * 4); }
    } else { cam.x = 0; cam.y = 0; }
    cam.snap = false;
  }
  function drawPlay(ctx) {
    var c2 = cam;
    if (shake > 0) c2 = { x: cam.x + (Math.random() - 0.5) * 7, y: cam.y + (Math.random() - 0.5) * 7 };
    R.scene(g, ctx, S(), { LV: game.level(), cam: c2, banner: banner });
  }
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game) newGame(); else if (game) g.setMusic(track(S().level)); playSince = g.time; },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (!game) return;
      if (banner) { banner.a -= dt; if (banner.a <= 0) banner = null; }
      if (shake > 0) shake -= dt;
      var dir = this.input.dir, live = g.time - playSince > 0.15, cd = this.input.codes;
      var jump = live && (this.input.pressed('action') || !!cd.KeyZ);
      var fire = live && (!!(cd.KeyX || cd.KeyJ || cd.KeyF || cd.ControlLeft || cd.ControlRight) || padFire);
      var boil = live && (!!(cd.KeyC || cd.KeyK || cd.ShiftLeft || cd.ShiftRight) || padBoil);
      game.setInput({ x: dir.x, y: dir.y, jump: jump, fire: fire, boil: boil });
      var n = Math.max(1, Math.min(4, Math.round(Math.min(dt, 0.066) / STEP)));
      for (var k = 0; k < n; k++) game.update(STEP);
      padBoil = false;
      FX.step(dt);
      var s = S();
      updCam(dt);
      sync();
      if (s.phase === 'over' && s.phaseT >= 0) { toOver(); return; }
      if (s.phase === 'won' && g._sceneName === 'play') { if (!this._wonT) this._wonT = g.time; if (g.time - this._wonT > 0.4) { this._wonT = 0; g.win(); } }
    },
    draw: function (ctx) { if (!game) { this.clear(); return; } drawPlay(ctx); }
  });

  // ---------- клавиши и тач-кнопки ----------
  addEventListener('keydown', function (e) {
    var ip = g._sceneName === 'play';
    if (ip && { KeyZ: 1, KeyX: 1, KeyJ: 1, KeyF: 1, KeyC: 1, KeyK: 1, ControlLeft: 1, ShiftLeft: 1 }[e.code]) e.preventDefault();
    if (e.code === 'KeyR' && ip && game) game.puzzleReset();
  });
  addEventListener('blur', function () { padFire = false; });
  (function () {
    var b = document.getElementById('bFire');
    if (b) {
      var on = function (e) { e.preventDefault(); padFire = true; }, off = function (e) { e.preventDefault(); padFire = false; };
      b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
      b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
    }
    var bb = document.getElementById('bBoil');
    if (bb) { var hb = function (e) { e.preventDefault(); padBoil = true; }; bb.addEventListener('touchstart', hb, { passive: false }); bb.addEventListener('mousedown', hb); }
    var bp = document.getElementById('bPause');
    if (bp) { var h = function (e) { e.preventDefault(); if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); }; bp.addEventListener('touchstart', h, { passive: false }); bp.addEventListener('mousedown', h); }
    var br = document.getElementById('bReset');
    if (br) { var hr = function (e) { e.preventDefault(); if (inPlay()) game.puzzleReset(); }; br.addEventListener('touchstart', hr, { passive: false }); br.addEventListener('mousedown', hr); }
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
  CH.app = { g: g, game: function () { return game; }, cam: function () { return cam; } };   // для отладки/автотестов в браузере
})(typeof window !== 'undefined' ? window : globalThis);
