/* МЕДНАЯ СЛОБОДА · прототип драки «чиби HD-пиксель». Движок v2 (меню/пауза/язык/звук/рекорд) + своя логика.
   Холст 480×270, масштаб страницы только целый (×1…×4), сглаживание выключено. Логика — фикс-шаг 60 Гц.
   Game feel: хит-стоп 4 кадра, тряска (целые пиксели), белая вспышка силуэта, пиксельные искры и цифры урона.
   Тестовые крючки: window.__hb (manual/step/stage) — для скриншотов и замера fps. */
(function (global) {
  'use strict';
  var HB = global.HB, S = HB.sprites, Wd = HB.world, PAL = S.PAL;
  var VW = Wd.VW, VH = Wd.VH;
  var STR = {
    ru: { title: 'МЕДНАЯ СЛОБОДА', subtitle: 'Прототип драки · чиби HD-пиксель', wave: 'Волна', go: 'ВПЕРЁД', clear: 'Улица чиста!',
      hint: '←→↑↓ ход · Пробел/J удар (×3 серия) · K/Z прыжок · P пауза', hintTouch: 'Стик — ход · ● удар · ⤒ прыжок', mash: 'ЖМИ УДАР!' },
    en: { title: 'COPPER QUARTER', subtitle: 'Brawler prototype · chibi HD pixel', wave: 'Wave', go: 'GO', clear: 'Street clear!',
      hint: '←→↑↓ move · Space/J hit (×3 combo) · K/Z jump · P pause', hintTouch: 'Stick — move · ● hit · ⤒ jump', mash: 'MASH HIT!' }
  };
  var pixelTheme = function (base, o) { return Object.assign({}, base, o, { pixel: true }); };
  var TH = Arcade.themes || {};
  var themes = {
    modern: pixelTheme(TH.modern, { bg: PAL[11], panel: PAL[2], ink: PAL[8], muted: PAL[14], accent: PAL[6], good: PAL[16], bad: PAL[5], grid: PAL[12] }),
    retro: pixelTheme(TH.retro, { bg: PAL[1], panel: PAL[1], ink: PAL[8], muted: PAL[13], accent: PAL[7], good: PAL[16], bad: PAL[5] })
  };
  var g = Arcade.createGame({ canvas: '#c', width: VW, height: VH, gameId: 'hd-brawl', strings: STR, theme: 'modern', lives: 3, themes: themes });
  var ctx = g.ctx; ctx.imageSmoothingEnabled = false;
  // ---------- Пиксельный шрифт вместо системного: все тексты движка (меню, оверлеи, подсказки) идут через g.text ----------
  var F = HB.font;
  g.text = function (s, x, y, o) { o = o || {}; F.draw(this.ctx, s, x, y, { size: o.size, color: o.color || this.th().ink, align: o.align, baseline: o.baseline, maxWidth: o.maxWidth, ink: PAL[1] }); };
  // Затемнение без полупрозрачности (иначе цвета вне палитры): шахматка чернилами 50 %.
  var dith = (function () { var c = document.createElement('canvas'); c.width = 2; c.height = 2; var x = c.getContext('2d'); x.fillStyle = PAL[1]; x.fillRect(0, 0, 1, 1); x.fillRect(1, 1, 1, 1); return ctx.createPattern(c, 'repeat'); })();
  function dim() { ctx.fillStyle = dith; ctx.fillRect(0, 0, VW, VH); }
  g.overlay = function (title, sub, color) {
    var th = this.th(); dim();
    this.text(title, VW / 2, VH / 2 - 20, { size: 40, align: 'center', color: color || th.accent, maxWidth: VW - 24 });
    if (sub) this.text(sub, VW / 2, VH / 2 + 14, { size: 15, align: 'center', color: th.muted, maxWidth: VW - 24 });
  };

  // ---------- Целый масштаб холста ----------
  var cv = g.canvas;
  function fit() {
    var padH = window.matchMedia('(hover: none)').matches ? 150 : 70;
    var s = Math.floor(Math.min((innerWidth - 16) / VW, (innerHeight - padH) / VH));
    s = Math.max(1, Math.min(4, s));
    cv.style.width = VW * s + 'px'; cv.style.height = VH * s + 'px'; cv.dataset.scale = s;
  }
  addEventListener('resize', fit); fit();

  // ---------- Кэш спрайтов: набор × кадр × (зеркало) × (вспышка) → холст ----------
  var cache = {};
  function sprite(set, name, flip, flash) {
    var key = set + '.' + name + (flip ? 'L' : 'R') + (flash ? 'F' : '');
    if (cache[key]) return cache[key];
    var f = S.SETS[set][name], c = document.createElement('canvas'); c.width = f.w; c.height = f.h;
    var cx = c.getContext('2d'), im = cx.createImageData(f.w, f.h), d = im.data;
    for (var y = 0; y < f.h; y++) for (var x = 0; x < f.w; x++) {
      var v = f.a[y * f.w + (flip ? f.w - 1 - x : x)]; if (!v) continue;
      var hex = PAL[flash ? (v === 1 ? 1 : 8) : v], i = (y * f.w + x) * 4;
      d[i] = parseInt(hex.slice(1, 3), 16); d[i + 1] = parseInt(hex.slice(3, 5), 16); d[i + 2] = parseInt(hex.slice(5, 7), 16); d[i + 3] = 255;
    }
    cx.putImageData(im, 0, 0);
    return (cache[key] = c);
  }
  function warm() { Object.keys(S.SETS).forEach(function (s) { Object.keys(S.SETS[s]).forEach(function (n) { sprite(s, n, 0, 0); sprite(s, n, 1, 0); sprite(s, n, 0, 1); sprite(s, n, 1, 1); }); }); }
  // Тень под ногами — пиксельный эллипс чернилами
  var shadows = {};
  function shadow(w) {
    if (shadows[w]) return shadows[w];
    var h = Math.max(3, Math.round(w / 4)), c = document.createElement('canvas'); c.width = w; c.height = h; var x2 = c.getContext('2d'); x2.fillStyle = PAL[1];
    for (var y = 0; y < h; y++) { var t = (y + 0.5) / h * 2 - 1, half = Math.round(w / 2 * Math.sqrt(1 - t * t)); x2.fillRect(w / 2 - half, y, half * 2, 1); }
    return (shadows[w] = c);
  }

  // ---------- Пиксельный шрифт цифр 3×5 ----------
  var DIG = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001010010010', '111101111101111', '111101111001111'];
  function digits(str, x, y, col, sc) {
    sc = sc || 1; str = String(str);
    for (var pass = 0; pass < 2; pass++) for (var n = 0; n < str.length; n++) {
      var m = DIG[+str[n]]; if (!m) continue;
      for (var i = 0; i < 15; i++) if (m[i] === '1') {
        var px = x + (n * 4 + i % 3) * sc, py = y + (i / 3 | 0) * sc;
        if (pass === 0) { ctx.fillStyle = PAL[1]; ctx.fillRect(px - 1, py - 1, sc + 2, sc + 2); }
        else { ctx.fillStyle = PAL[col]; ctx.fillRect(px, py, sc, sc); }
      }
    }
  }

  // ---------- Мир боя ----------
  // Удар = предвосхищение (a) → удар (активные кадры on..off) → возврат (r). ph — до какого тика кадр «a», до какого — сам удар.
  var ATK = { hit1: { len: 15, on: 4, off: 7, dmg: 6, reach: 42, next: 'hit2', fr: 'jab', ph: [4, 9] },
    hit2: { len: 17, on: 5, off: 8, dmg: 7, reach: 46, next: 'hit3', fr: 'cross', ph: [5, 11] },
    hit3: { len: 26, on: 7, off: 11, dmg: 11, reach: 50, heavy: true, fr: 'kick', ph: [7, 15] },
    air: { len: 30, on: 2, off: 22, dmg: 9, reach: 46, heavy: true } };
  var game = null;
  function fighter(set, x, z, hp, face) { return { set: set, x: x, z: z, y: 0, vx: 0, vz: 0, vy: 0, face: face || 1, st: 'idle', t: 0, hp: hp, max: hp, flash: 0, atk: null, hitSet: [], cd: 60, inv: 0, combo: 0, buf: false }; }
  // 3-я волна: литейщик (крупный, медленный, захват) + двое кочегаров
  var WAVES = [{ at: 120, list: ['stokerA', 'stokerA'] }, { at: 560, list: ['stokerA', 'stokerB', 'stokerA'] }, { at: 960, list: ['stokerB', 'founder', 'stokerA'] }];
  var HP = { stokerA: 30, stokerB: 40, founder: 90 };
  // Литейщик: телеграф (замах) → бросок-захват (выпад) → держит; вырваться — MASH нажатий, иначе бросок.
  var BIG = { wind: 30, lunge: 14, reach: [8, 34], hold: 110, mash: 8, throwLen: 26, throwDmg: 14 };
  function newGame() {
    g.resetRun(); g.state.score = 0; g.state.lives = 3; g.state.level = 1;
    game = { hero: fighter('hero', 80, 40, 100, 1), foes: [], fx: [], nums: [], cam: 0, lock: VW, wave: 0, active: false, stop: 0, shake: 0, shakeA: 0, clear: 0, banner: 90, over: 0, frame: 0 };
  }

  function setSt(f, st) { f.st = st; f.t = 0; }
  function startAtk(f, name) { setSt(f, 'atk'); f.atk = name; f.hitSet = []; f.buf = false; }

  // ---------- Ввод ----------
  var held = {};
  addEventListener('keydown', function (e) { held[e.code] = true; });
  addEventListener('keyup', function (e) { held[e.code] = false; });
  addEventListener('blur', function () { held = {}; });
  var pad = document.querySelector('.pad'), stick = global.ArcadeStick ? global.ArcadeStick.create(pad && pad.querySelector('[data-stick]'), { radius: 44 }) : { x: 0, y: 0 };
  var tb = { hit: false, jump: false };
  function bindBtn(sel, key) {
    var b = document.querySelector(sel); if (!b) return;
    var on = function (e) { if (!Arcade.touchOk(e)) return; tb[key] = true; }, off = function (e) { if (!Arcade.touchOk(e)) return; tb[key] = false; };
    b.addEventListener('touchstart', on, { passive: false }); b.addEventListener('touchend', off, { passive: false }); b.addEventListener('touchcancel', off, { passive: false });
    b.addEventListener('mousedown', on); b.addEventListener('mouseup', off); b.addEventListener('mouseleave', off);
  }
  bindBtn('[data-hit]', 'hit'); bindBtn('[data-jump]', 'jump');
  var pb = document.querySelector('[data-pause]');
  if (pb) pb.addEventListener('click', function (e) { if (!Arcade.touchOk(e)) return; if (g._sceneName === 'play') g.pause(); else if (g._sceneName === 'pause') g.goto('play', { resume: true }); });
  var prev = { hit: false, jump: false };
  function readInput() {
    var d = g.input.dir || { x: 0, y: 0 }, sx = Math.abs(stick.x) > 0.3 ? stick.x : 0, sy = Math.abs(stick.y) > 0.3 ? stick.y : 0;
    var hit = !!(held.KeyJ || held.KeyX || held.Space || tb.hit), jump = !!(held.KeyK || held.KeyZ || held.KeyC || tb.jump);
    var o = { x: Math.max(-1, Math.min(1, d.x + sx)), z: Math.max(-1, Math.min(1, d.y + sy)), hit: hit && !prev.hit, jump: jump && !prev.jump };
    prev.hit = hit; prev.jump = jump; return o;
  }

  // ---------- Звук (движок: короткие тоны) ----------
  function sfx(type) {
    var a = g.audio; if (!a || !a.beep) return;
    if (type === 'hit') { a.beep(180, 0.05, 'square', 0.18); a.beep(90, 0.08, 'sawtooth', 0.12); }
    else if (type === 'heavy') { a.beep(120, 0.09, 'square', 0.22); a.beep(60, 0.14, 'sawtooth', 0.16); }
    else if (type === 'swing') a.beep(520, 0.03, 'triangle', 0.06);
    else if (type === 'jump') a.beep(330, 0.06, 'triangle', 0.08);
    else if (type === 'ko') { a.beep(200, 0.1, 'square', 0.15); a.beep(100, 0.2, 'triangle', 0.15); }
    else if (type === 'hurt') a.beep(140, 0.08, 'sawtooth', 0.16);
  }

  // ---------- Попадания и эффекты ----------
  function spark(x, y, heavy) {
    var n = heavy ? 14 : 9;
    for (var i = 0; i < n; i++) { var a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * (heavy ? 2.6 : 1.8);
      game.fx.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.6, life: 14 + (Math.random() * 10 | 0), c: [8, 7, 7, 6, 5][i % 5], s: i % 4 === 0 ? 2 : 1 }); }
    game.fx.push({ ring: true, x: x, y: y, life: 6, c: 8 });
  }
  function dust(x, y) { for (var i = 0; i < 6; i++) game.fx.push({ x: x + (Math.random() * 16 - 8), y: y, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.6, life: 16, c: i & 1 ? 14 : 13, s: 2, grav: 0 }); }
  function hit(att, tgt, A) {
    tgt.hp -= A.dmg; tgt.flash = 2; att.hitSet.push(tgt);
    var heavy = !!A.heavy || tgt.hp <= 0;
    game.stop = heavy ? 4 : 3; game.shake = heavy ? 8 : 5; game.shakeA = heavy ? 3 : 2;
    var hx = tgt.x - att.face * 8, hy = Wd.FLOOR_TOP + tgt.z - tgt.y - 40;
    spark(hx, hy, heavy);
    game.nums.push({ x: tgt.x, y: hy - 6, v: A.dmg, life: 40, c: tgt === game.hero ? 5 : 7 });
    if (tgt.set !== 'hero') g.state.score += A.dmg * 10;
    if (heavy) { setSt(tgt, 'fall'); tgt.vx = att.face * 2.1; tgt.vy = 2.6; tgt.y = Math.max(tgt.y, 1); tgt.face = -att.face; sfx('heavy'); }
    else { setSt(tgt, 'hurt'); tgt.vx = att.face * 0.9; tgt.face = -att.face; sfx('hit'); }
    tgt.atk = null;
  }
  function tryHits(f, targets) {
    if (f.st !== 'atk') return; var A = ATK[f.atk]; if (f.t < A.on || f.t > A.off) return;
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i]; if (t.hp <= 0 && t.st === 'down') continue; if (t.inv > 0 || t.st === 'fall' || t.st === 'down' || t.st === 'getup' || t.st === 'held') continue;
      if (f.hitSet.indexOf(t) >= 0) continue;
      var dx = (t.x - f.x) * f.face; if (dx < 4 || dx > A.reach) continue; if (Math.abs(t.z - f.z) > 9) continue; if (Math.abs(t.y - f.y) > 34) continue;
      hit(f, t, A);
    }
  }

  // ---------- Физика бойца ----------
  function physics(f) {
    if (f.y > 0 || f.vy !== 0) { f.y += f.vy; f.vy -= 0.22; if (f.y <= 0) { f.y = 0; f.vy = 0; landed(f); } }
    f.x += f.vx; f.z += f.vz;
    if (f.y === 0 && f.st !== 'fall') f.vx *= 0.8;
    f.z = Math.max(0, Math.min(Wd.FLOOR_D, f.z));
    f.x = Math.max(game.cam + 10, Math.min(Math.min(game.lock, Wd.LEN) - 10 + (f.set === 'hero' ? 0 : 60), f.x));
    if (f.inv > 0) f.inv--;
  }
  function landed(f) {
    if (f.st === 'fall') { setSt(f, 'down'); f.vx = 0; dust(f.x, Wd.FLOOR_TOP + f.z); game.shake = Math.max(game.shake, 4); game.shakeA = 1; }
    else if (f.st === 'jump' || (f.st === 'atk' && f.atk === 'air')) { setSt(f, 'idle'); dust(f.x, Wd.FLOOR_TOP + f.z); }
  }
  function stepCommon(f) {
    f.t++;
    if (f.st === 'atk') { var A = ATK[f.atk]; if (f.atk !== 'air' && f.t >= A.len) { if (f.buf && A.next) startAtk(f, A.next); else setSt(f, 'idle'); } }
    else if (f.st === 'hurt' && f.t >= 18) setSt(f, 'idle');
    else if (f.st === 'down' && f.t >= (f.hp <= 0 ? 70 : 44)) { if (f.hp > 0) { setSt(f, 'getup'); } }
    else if (f.st === 'getup' && f.t >= 24) { setSt(f, 'idle'); f.inv = 30; }
  }

  // ---------- Герой ----------
  function stepHero(h, inp) {
    if (h.hp <= 0) { stepCommon(h); physics(h); if (h.st === 'down' && h.t >= 70) heroDied(); return; }
    if (h.st === 'held') {   // в захвате: вырываться быстрыми нажатиями (удар/прыжок/смена направления)
      if (inp.hit || inp.jump || (inp.x && inp.x !== h.lastX)) { h.mash++; h.shk = 3; sfx('swing'); }
      h.lastX = inp.x; h.t++; if (h.shk > 0) h.shk--; return;
    }
    var free = h.st === 'idle' || h.st === 'walk';
    if (inp.hit) {
      if (h.st === 'jump') { startAtk(h, 'air'); sfx('swing'); }
      else if (free) { startAtk(h, 'hit1'); sfx('swing'); }
      else if (h.st === 'atk' && ATK[h.atk].next && h.t >= ATK[h.atk].on) h.buf = true;
    }
    if (inp.jump && free) { setSt(h, 'jump'); h.vy = 4.2; h.y = 0.1; h.vx = inp.x * 1.6; sfx('jump'); }
    free = h.st === 'idle' || h.st === 'walk';
    if (free) {
      if (inp.x || inp.z) { if (h.st !== 'walk') setSt(h, 'walk'); h.vx = inp.x * 1.5; h.vz = inp.z * 0.9; if (inp.x) h.face = inp.x > 0 ? 1 : -1; }
      else { if (h.st !== 'idle') setSt(h, 'idle'); h.vz = 0; }
    } else if (h.st !== 'jump' && !(h.st === 'atk' && h.atk === 'air')) { h.vz = 0; if (h.st === 'atk') h.vx = h.t < 4 ? h.face * 0.6 : 0; }
    stepCommon(h); physics(h);
    tryHits(h, game.foes);
  }
  function heroDied() {
    g.state.lives--; sfx('ko');
    if (g.state.lives <= 0) { game.over = 1; g.gameover(); return; }
    var h = game.hero; h.hp = h.max; h.inv = 120; setSt(h, 'getup');
  }

  // ---------- Враг: подойти, выровняться по глубине, замах (телеграф) → удар ----------
  function stepFoe(e, idx) {
    var h = game.hero;
    if (e.set === 'founder') return stepFounder(e);
    if (e.hp <= 0) { stepCommon(e); physics(e); return; }
    var free = e.st === 'idle' || e.st === 'walk';
    if (free) {
      e.cd--;
      var side = e.x < h.x ? -1 : 1, tx = h.x + side * 36, tz = h.z + (idx % 2 ? 6 : -6) * (game.foes.length > 2 ? 1 : 0);
      var dx = tx - e.x, dz = tz - e.z;
      var attacking = h.st === 'held' || game.foes.some(function (o) { return o !== e && (o.st === 'wind' || o.st === 'atk' || o.st === 'lunge'); });
      if (Math.abs(h.x - e.x) < 44 && Math.abs(h.z - e.z) < 7 && e.cd <= 0 && !attacking && h.hp > 0) { e.face = h.x > e.x ? 1 : -1; setSt(e, 'wind'); e.vx = 0; e.vz = 0; }
      else if (Math.abs(dx) > 3 || Math.abs(dz) > 2) { if (e.st !== 'walk') setSt(e, 'walk'); e.vx = Math.sign(dx) * Math.min(0.75, Math.abs(dx) * 0.1); e.vz = Math.sign(dz) * Math.min(0.5, Math.abs(dz) * 0.1); e.face = h.x > e.x ? 1 : -1; }
      else { if (e.st !== 'idle') setSt(e, 'idle'); e.vz = 0; e.face = h.x > e.x ? 1 : -1; }
    } else if (e.st === 'wind') { e.vz = 0; if (e.t >= 22) { startAtk(e, 'hit1'); e.cd = 70 + (Math.random() * 60 | 0); } }
    else e.vz = 0;
    // раздвигаемся, чтобы не стоять друг в друге
    game.foes.forEach(function (o) { if (o === e || o.hp <= 0) return; var d = e.x - o.x; if (Math.abs(d) < 20 && Math.abs(e.z - o.z) < 8) e.x += (d >= 0 ? 1 : -1) * 0.4; });
    if (e.st === 'wind') e.t++; else stepCommon(e);
    physics(e);
    tryHits(e, [h]);
  }

  // ---------- Литейщик: медленно подходит, замах-телеграф, выпад с захватом; держит → бросок ----------
  function release(e, h, escaped) {
    if (escaped) { setSt(h, 'idle'); h.inv = 30; h.x += -e.face * 10; h.y = 0; setSt(e, 'hurt'); e.vx = -e.face * 1.2; e.cd = 120; sfx('hit'); spark(e.x + e.face * 14, Wd.FLOOR_TOP + e.z - 40, false); }
    h.grab = null; h.mash = 0;
  }
  function stepFounder(e) {
    var h = game.hero;
    if (e.hp <= 0) { if (h.grab === e) release(e, h, false); stepCommon(e); physics(e); return; }
    if (h.grab === e && e.st !== 'grab' && e.st !== 'throw') { setSt(h, 'idle'); h.y = 0; release(e, h, false); }   // захват прерван ударом
    var free = e.st === 'idle' || e.st === 'walk', heroOk = h.hp > 0 && h.st !== 'held' && h.st !== 'fall' && h.st !== 'down' && h.st !== 'getup';
    if (free) {
      e.cd--; e.face = h.x > e.x ? 1 : -1;
      var tx = h.x - e.face * 26, dx = tx - e.x, dz = h.z - e.z;
      if (Math.abs(h.x - e.x) < 40 && Math.abs(dz) < 7 && e.cd <= 0 && heroOk) { setSt(e, 'wind'); e.vx = 0; e.vz = 0; }
      else if (Math.abs(dx) > 3 || Math.abs(dz) > 2) { if (e.st !== 'walk') setSt(e, 'walk'); e.vx = Math.sign(dx) * Math.min(0.45, Math.abs(dx) * 0.08); e.vz = Math.sign(dz) * Math.min(0.32, Math.abs(dz) * 0.08); }
      else { if (e.st !== 'idle') setSt(e, 'idle'); e.vz = 0; }
      stepCommon(e);
    } else if (e.st === 'wind') { e.vz = 0; e.vx = 0; e.t++; if (e.t >= BIG.wind) { setSt(e, 'lunge'); sfx('swing'); } }
    else if (e.st === 'lunge') {
      e.t++; e.vx = e.t < 7 ? e.face * 1.5 : 0;
      var ddx = (h.x - e.x) * e.face;
      if (heroOk && h.inv <= 0 && h.y < 12 && ddx >= BIG.reach[0] && ddx <= BIG.reach[1] && Math.abs(h.z - e.z) < 9) {
        setSt(e, 'grab'); e.vx = 0; h.grab = e; h.mash = 0; h.lastX = 0; h.atk = null; setSt(h, 'held'); h.vx = 0; h.vz = 0; h.vy = 0; h.face = -e.face;
        game.stop = 3; game.shake = 4; game.shakeA = 1; sfx('heavy');
      } else if (e.t >= BIG.lunge) { setSt(e, 'idle'); e.cd = 80; }
    } else if (e.st === 'grab') {
      e.t++; h.x = e.x + e.face * 27; h.z = e.z; h.y = 5;
      if (h.mash >= BIG.mash) release(e, h, true);
      else if (e.t >= BIG.hold) {   // бросок: герой летит вперёд и падает
        setSt(e, 'throw'); release(e, h, false); h.hp -= BIG.throwDmg; h.flash = 2; setSt(h, 'fall'); h.vx = e.face * 2.6; h.vy = 3.4; h.y = 6;
        game.nums.push({ x: h.x, y: Wd.FLOOR_TOP + h.z - 50, v: BIG.throwDmg, life: 40, c: 5 }); game.stop = 4; game.shake = 8; game.shakeA = 3; sfx('heavy'); e.cd = 110;
      }
    } else if (e.st === 'throw') { e.t++; if (e.t >= BIG.throwLen) setSt(e, 'idle'); }
    else { e.vz = 0; stepCommon(e); }
    physics(e);
  }

  // ---------- Волны и камера ----------
  function stepWaves() {
    var h = game.hero, W = WAVES[game.wave];
    if (!game.active && W && h.x >= W.at) {
      game.active = true; game.lock = game.cam + VW; game.banner = 70; g.state.level = game.wave + 1;
      W.list.forEach(function (set, i) { var left = i % 2 === 1; game.foes.push(fighter(set, left ? game.cam - 20 - i * 14 : game.cam + VW + 20 + i * 14, 10 + (i * 23) % 70, HP[set], left ? 1 : -1)); });
    }
    game.foes = game.foes.filter(function (e) { if (e.hp <= 0 && e.st === 'down' && e.t >= 70) { g.state.score += e.set === 'founder' ? 300 : 100; return false; } return true; });
    if (game.active && !game.foes.length) {
      game.active = false; game.wave++; game.lock = Wd.LEN;
      if (game.wave >= WAVES.length) game.clear = 1; else game.go = 120;
    }
    if (game.clear) { game.clear++; if (game.clear > 120) { game.clear = 0; game.over = 1; g.win(); } }
    var want = Math.max(0, Math.min(Wd.LEN - VW, h.x - VW * 0.42));
    if (game.active) want = Math.min(want, game.lock - VW);
    game.cam += Math.max(-3, Math.min(3, want - game.cam));
  }

  function tick(inp) {
    game.frame++; Wd.update();
    if (game.banner > 0) game.banner--; if (game.go > 0) game.go--;
    game.fx = game.fx.filter(function (p) { if (!p.ring) { p.x += p.vx; p.y += p.vy; if (p.grav !== 0) p.vy += 0.12; } return --p.life > 0; });
    game.nums = game.nums.filter(function (n) { n.y -= n.life > 28 ? 0.8 : 0.15; return --n.life > 0; });
    if (game.shake > 0) game.shake--;
    [game.hero].concat(game.foes).forEach(function (f) { if (f.flash > 0) f.flash--; });   // вспышка 2 тика, потом поза урона
    if (game.stop > 0) { game.stop--; return; }   // хит-стоп: бойцы замерли, искры и пар живут
    stepHero(game.hero, inp);
    game.foes.forEach(stepFoe);
    stepWaves();
  }

  // ---------- Отрисовка ----------
  function frameOf(f) {
    var T = f.t, big = f.set === 'founder';
    switch (f.st) {
      case 'walk': return 'walk' + ((T / (big ? 8 : 5) | 0) % 6);
      case 'lunge': case 'grab': return 'grab';
      case 'throw': return T < 8 ? 'grab' : 'throw';
      case 'held': return 'held';
      case 'atk': { if (f.atk === 'air') return 'airkick'; var A = ATK[f.atk]; return A.fr + (T < A.ph[0] ? '_a' : T < A.ph[1] ? '' : '_r'); }
      case 'wind': return big ? 'wind' : 'cross_a';
      case 'jump': return 'jump';
      case 'hurt': return 'hurt';
      case 'fall': return T < 10 ? 'fall0' : 'fall1';
      case 'down': return 'down';
      case 'getup': return T < 8 ? 'getup0' : (T < 16 || big) ? 'getup1' : 'getup2';
      default: return 'idle' + ((T / 30 | 0) % 2);
    }
  }
  function drawFighter(f, cam) {
    var sx = Math.round(f.x - cam), gy = Math.round(Wd.FLOOR_TOP + f.z);
    var sh = shadow(f.st === 'down' || f.st === 'fall' ? 44 : Math.max(16, 30 - Math.round(f.y / 4)));
    ctx.drawImage(sh, sx - (sh.width >> 1), gy - (sh.height >> 1));
    if (f.inv > 0 && (f.inv >> 2) % 2 && f.hp > 0) return;
    if (f.hp <= 0 && f.st === 'down' && f.t > 40 && (f.t >> 2) % 2) return;
    var img = sprite(f.set, frameOf(f), f.face < 0, f.flash > 0), jx = f.st === 'held' && f.shk > 0 ? (f.shk & 1 ? 1 : -1) : 0;
    // канонический кадр 80×72: опора — (40, 71)
    ctx.drawImage(img, sx - S.FOOT_X + jx, gy - Math.round(f.y) - S.FH + 1);
    if (f.st === 'wind' && (f.t >> 2) % 2 === 0) { var my = f.set === 'founder' ? gy - 82 : gy - 76; ctx.fillStyle = PAL[1]; ctx.fillRect(sx - 2, my, 5, 10); ctx.fillStyle = PAL[7]; ctx.fillRect(sx - 1, my + 1, 3, 5); ctx.fillRect(sx - 1, my + 7, 3, 2); }
    if (f.st === 'held' && (game.frame >> 3) % 2 === 0) {   // подсказка «жми» и шкала рывков
      g.text(g.t('mash'), sx, gy - 84, { size: 10, align: 'center', color: PAL[7] });
      for (var m = 0; m < BIG.mash; m++) { ctx.fillStyle = PAL[1]; ctx.fillRect(sx - 20 + m * 5, gy - 74, 4, 4); ctx.fillStyle = PAL[m < f.mash ? 7 : 3]; ctx.fillRect(sx - 19 + m * 5, gy - 73, 2, 2); }
    }
  }
  function bar(x, y, w, v, max, col) {
    ctx.fillStyle = PAL[1]; ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = PAL[2]; ctx.fillRect(x, y, w, 5);
    var fw = Math.max(0, Math.round(w * v / max)); ctx.fillStyle = PAL[col]; ctx.fillRect(x, y, fw, 5);
    ctx.fillStyle = PAL[col === 6 ? 7 : 16]; ctx.fillRect(x, y, fw, 1); ctx.fillStyle = PAL[col === 6 ? 4 : 15]; ctx.fillRect(x, y + 4, fw, 1);
  }
  function drawHud() {
    var h = game.hero;
    // мини-портрет: голова героя из того же спрайта (кадр idle0, верх)
    var img = sprite('hero', 'idle0', 0, 0); ctx.fillStyle = PAL[1]; ctx.fillRect(6, 5, 26, 22); ctx.fillStyle = PAL[12]; ctx.fillRect(7, 6, 24, 20);
    ctx.drawImage(img, 30, 15, 24, 20, 7, 6, 24, 20);
    bar(36, 8, 90, h.hp, h.max, 6);
    for (var i = 0; i < g.state.lives; i++) { ctx.fillStyle = PAL[1]; ctx.fillRect(36 + i * 8, 17, 7, 7); ctx.fillStyle = PAL[5]; ctx.fillRect(37 + i * 8, 18, 5, 5); ctx.fillStyle = PAL[7]; ctx.fillRect(37 + i * 8, 18, 2, 2); }
    digits(String(g.state.score).padStart(6, '0'), VW - 60, 8, 7, 2);
    // полоски врагов
    game.foes.forEach(function (e, k) { if (e.hp > 0) bar(VW - 70, 24 + k * 8, 50, e.hp, e.max, e.set === 'stokerB' ? 5 : e.set === 'founder' ? 4 : 13); });
    if (game.banner > 0 && (game.banner >> 3) % 2 === 0 && game.wave < WAVES.length) g.text(g.t('wave') + ' ' + (game.wave + 1) + '/' + WAVES.length, VW / 2, 56, { size: 20, align: 'center', color: PAL[7] });
    if (game.go > 0 && (game.go >> 4) % 2 === 0) {   // стрелка «вперёд» пикселями
      var ax = VW - 44, ay = 96; ctx.fillStyle = PAL[1]; ctx.fillRect(ax - 1, ay - 1, 22, 11); for (var k2 = 0; k2 < 8; k2++) ctx.fillRect(ax + 20 + k2 - 1, ay - 5 + k2 - 1, 3, 21 - k2 * 2 + 1);
      ctx.fillStyle = PAL[7]; ctx.fillRect(ax, ay, 20, 9); for (var k3 = 0; k3 < 7; k3++) ctx.fillRect(ax + 20 + k3, ay - 4 + k3, 1, 17 - k3 * 2);
      g.text(g.t('go'), ax + 10, ay + 30, { size: 16, align: 'center', color: PAL[7] });
    }
    if (game.clear) g.text(g.t('clear'), VW / 2, 74, { size: 24, align: 'center', color: PAL[7] });
  }
  function render() {
    var cam = Math.round(game.cam), ox = 0, oy = 0;
    if (game.shake > 0) { var a = game.shakeA * (game.shake > 2 ? 1 : 0.5); ox = Math.round((Math.random() * 2 - 1) * a); oy = Math.round((Math.random() * 2 - 1) * a); }
    ctx.save(); ctx.translate(ox, oy);
    Wd.draw(ctx, cam);
    // в захвате герой рисуется ПОД литейщиком: рукавицы лежат поверх героя
    var held = game.hero.st === 'held';
    var list = [game.hero].concat(game.foes).sort(function (a, b) { return a.z - b.z || (a === game.hero ? (held ? -1 : 1) : (b === game.hero ? (held ? 1 : -1) : 0)); });
    list.forEach(function (f) { drawFighter(f, cam); });
    Wd.drawFront(ctx, cam);
    game.fx.forEach(function (p) {
      var x = Math.round(p.x - cam), y = Math.round(p.y);
      if (p.ring) { var r = 12 - p.life * 1.5 | 0; ctx.fillStyle = PAL[p.c]; ctx.fillRect(x - r, y, r * 2 + 1, 1); ctx.fillRect(x, y - r, 1, r * 2 + 1); ctx.fillRect(x - 2, y - 2, 5, 5); return; }
      ctx.fillStyle = PAL[p.life < 5 ? 4 : p.c]; ctx.fillRect(x, y, p.s, p.s);
    });
    game.nums.forEach(function (n) { if (n.life < 8 && n.life % 2) return; digits(n.v, Math.round(n.x - cam) - 4, Math.round(n.y), n.c, 2); });
    ctx.restore();
    drawHud();
  }

  // ---------- Сцены движка ----------
  g.useStandardScreens({ lives: 3, subtitle: STR.ru.subtitle });
  var titleHero = fighter('hero', 150, 50, 100, 1), titleFoe = fighter('stokerB', 330, 46, 40, -1), titleT = 0;
  var baseClear = Object.getPrototypeOf(g).clear;
  g.clear = function (c) {   // фон меню/паузы/финала — та же улица, герои в стойке
    if (g._sceneName === 'play' || !Wd) return baseClear.call(this, c);
    if (g._sceneName === 'title') { titleT++; Wd.update(); titleHero.t = titleT; titleFoe.t = titleT + 13; }
    if (game && g._sceneName !== 'title') { render(); }
    else { Wd.draw(ctx, 380, true); drawFighter(titleHero, 0); drawFighter(titleFoe, 0); return; }
    dim();
  };
  var titleScene = g.scenes.title, baseTitleDraw = titleScene.draw;
  titleScene.draw = function (c2) {
    baseTitleDraw.call(this, c2);
    var touch = this.input.touchOnly || this.input.device === 'touch';
    this.text(this.t(touch ? 'hintTouch' : 'hint'), VW / 2, VH - 6, { size: 9, align: 'center', color: PAL[14], maxWidth: VW - 16 });
  };
  g.scenes.pause.press = function (a) { if (a === 'pause') this.goto('play', { resume: true }); };

  var acc = 0, manual = false;
  g.scene('play', {
    realtime: true,
    enter: function (d) { if (!(d && d.resume) || !game || game.over) newGame(); },
    press: function (a) { if (a === 'pause') this.pause(); },
    update: function (dt) {
      if (manual) return;
      acc = Math.min(acc + dt, 0.1);
      while (acc >= 1 / 60) { acc -= 1 / 60; tick(readInput()); }
    },
    draw: function () { ctx.imageSmoothingEnabled = false; render(); }
  });

  // ---------- Крючки для проверки (скриншоты, fps) ----------
  var fpsN = 0, fpsT = performance.now(), fps = 0;
  (function loop(t) { fpsN++; if (t - fpsT >= 1000) { fps = fpsN * 1000 / (t - fpsT); fpsN = 0; fpsT = t; } requestAnimationFrame(loop); })(performance.now());
  global.__hb = {
    fps: function () { return fps; }, game: function () { return game; }, g: g, sprite: sprite,
    manual: function (on) { manual = on; },
    step: function (n, inp) { for (var i = 0; i < (n || 1); i++) tick(Object.assign({ x: 0, z: 0, hit: false, jump: false }, inp || {})); render(); },
    // готовая сцена боя: герой и трое у второй волны
    stage: function () {
      newGame(); g.goto('play'); manual = true;
      var h = game.hero; h.x = 600; h.z = 46; game.cam = 600 - VW * 0.42; game.wave = 1; game.active = true; game.lock = game.cam + VW; game.banner = 0;
      game.foes = [fighter('stokerA', 640, 47, 30, -1), fighter('stokerB', 548, 20, 40, 1), fighter('stokerA', 700, 76, 30, -1)];
      game.foes[2].st = 'walk'; game.foes[1].st = 'wind';
      render();
    },
    // сцена с литейщиком (3-я волна): герой, литейщик рядом и кочегар
    stageBig: function () {
      newGame(); g.goto('play'); manual = true;
      var h = game.hero; h.x = 1020; h.z = 40; game.cam = 1020 - VW * 0.42; game.wave = 2; game.active = true; game.lock = game.cam + VW; game.banner = 0;
      game.foes = [fighter('founder', 1072, 40, 90, -1), fighter('stokerB', 960, 18, 40, 1)];
      render();
    }
  };
  warm(); Wd.build();
  g.start('title');
})(window);
