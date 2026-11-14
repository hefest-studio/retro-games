/* ПОДГОРЬЕ · enemies.js — механизмы и твари Подгорья: паттерны движения и атак (без DOM, детерминированно).
   Враг: { type, x, y (низ), vx, vy, hp, w, h, t, st, face, home{x,y}, dead, flash }.
   EN.make(def, rng) → враг; EN.update(e, G, dt) — шаг; EN.box(e) → {x0,y0,x1,y1}.
   G — контекст игры: { hero, R (комната), rng, shot(x,y,vx,vy,o), solid(c,r), water(c,r), lit(x,y), ev(type,d) }. */
(function (global) {
  'use strict';
  var P = global.PODGORYE = global.PODGORYE || {};

  var DEF = {
    crawler: { hp: 2, w: 0.9, h: 1.0, dmg: 1, sp: 2.2 },        // Шестерня-ползун
    flyer:   { hp: 2, w: 0.9, h: 0.7, dmg: 1, sp: 3.0, fly: 1 }, // Мехокрыл
    turret:  { hp: 3, w: 1.0, h: 1.1, dmg: 1 },                  // Чадник
    hopper:  { hp: 3, w: 0.9, h: 1.0, dmg: 1 },                  // Пружинник
    sentry:  { hp: 5, w: 1.0, h: 1.6, dmg: 1, sp: 1.3, shield: 1 }, // Щитоносец
    fish:    { hp: 2, w: 1.0, h: 0.6, dmg: 1, sp: 3.2, fly: 1 }, // Щучий механизм
    icicle:  { hp: 1, w: 0.6, h: 1.0, dmg: 1 },                  // Сосулька
    slag:    { hp: 3, w: 1.0, h: 0.9, dmg: 1 },                  // Окалинник
    vine:    { hp: 3, w: 0.9, h: 1.2, dmg: 1 },                  // Лозняк
    wisp:    { hp: 2, w: 0.8, h: 0.8, dmg: 1, sp: 1.6, fly: 1 }, // Тьмарь
    // приспешники боссов
    spark:   { hp: 1, w: 0.7, h: 0.7, dmg: 1, sp: 3.5, fly: 1 }
  };
  function make(d, rng) {
    var D = DEF[d.type] || DEF.crawler;
    return { type: d.type, x: d.x, y: d.y, vx: 0, vy: 0, hp: D.hp, max: D.hp, w: D.w, h: D.h, dmg: D.dmg, t: (rng ? rng() : 0.5) * 2, st: 'idle',
      face: (rng && rng() < 0.5) ? -1 : 1, home: { x: d.x, y: d.y }, dead: false, flash: 0, ext: 0, cd: 1 + (rng ? rng() : 0) };
  }
  function box(e) {
    if (e.type === 'vine' && e.ext > 0) { var ex = e.ext * e.face; return { x0: Math.min(e.x - e.w / 2, e.x + ex - 0.4), x1: Math.max(e.x + e.w / 2, e.x + ex + 0.4), y0: e.y - e.h - 0.3, y1: e.y }; }
    return { x0: e.x - e.w / 2, x1: e.x + e.w / 2, y0: e.y - e.h, y1: e.y };
  }
  function walkable(G, x, y, dir) {    // впереди нет стены и есть пол
    var c = Math.floor(x + dir * 0.6), r = Math.floor(y - 0.5);
    return !G.solid(c, r) && G.solid(c, Math.floor(y + 0.1));
  }
  function update(e, G, dt) {
    if (e.dead) return;
    var h = G.hero, dx = h.x - e.x, dy = (h.y - 0.85) - (e.y - e.h / 2), dist = Math.sqrt(dx * dx + dy * dy), D = DEF[e.type];
    e.t += dt; if (e.flash > 0) e.flash -= dt; if (e.cd > 0) e.cd -= dt;
    switch (e.type) {
      case 'crawler': case 'sentry': {
        var sp = D.sp * (e.type === 'sentry' && Math.abs(dx) < 9 && Math.abs(dy) < 2.5 ? 1.3 : 1);
        if (e.type === 'sentry' && Math.abs(dx) < 9 && Math.abs(dy) < 3 && e.cd <= 0) { e.face = dx > 0 ? 1 : -1; e.cd = 1.2; }
        if (!walkable(G, e.x, e.y, e.face)) e.face = -e.face;
        if (walkable(G, e.x, e.y, e.face)) e.x += e.face * sp * dt;
        break;
      }
      case 'flyer': {
        if (e.st === 'idle') {
          e.x = e.home.x + Math.sin(e.t * 1.3) * 2.5; e.y = e.home.y + Math.sin(e.t * 2.1) * 0.8;
          if (dist < 7 && e.cd <= 0 && G.los(e.x, e.y - 0.4, h.x, h.y - 0.9)) { e.st = 'swoop'; e.t = 0; var n = Math.max(0.1, dist); e.vx = dx / n * 6.5; e.vy = dy / n * 6.5; }
        } else if (e.st === 'swoop') {
          e.x += e.vx * dt; e.y += e.vy * dt;
          if (e.t > 0.9 || G.solid(Math.floor(e.x), Math.floor(e.y - 0.35))) { e.st = 'back'; e.t = 0; e.cd = 1.6; }
        } else {
          var bx = e.home.x - e.x, by = e.home.y - e.y, bn = Math.sqrt(bx * bx + by * by);
          if (bn < 0.3) { e.st = 'idle'; e.t = 0; } else { e.x += bx / bn * 3.2 * dt; e.y += by / bn * 3.2 * dt; }
        }
        if (dx) e.face = dx > 0 ? 1 : -1;
        break;
      }
      case 'turret': {
        e.face = dx > 0 ? 1 : -1;
        if (e.cd <= 0 && dist < 12 && G.los(e.x, e.y - 0.8, h.x, h.y - 0.9)) {
          e.cd = 2.2; var n2 = Math.max(0.1, dist); G.shot(e.x + e.face * 0.4, e.y - 0.8, dx / n2 * 7, dy / n2 * 7, { kind: 'soot' }); G.ev('eshot', { x: e.x, y: e.y });
        }
        break;
      }
      case 'hopper': case 'slag': {
        var onG = G.solid(Math.floor(e.x), Math.floor(e.y + 0.05)) && e.vy >= 0;
        if (onG) {
          e.vx = 0; e.vy = 0;
          if (e.cd <= 0 && dist < 10) { e.face = dx > 0 ? 1 : -1; e.vx = e.face * (e.type === 'slag' ? 3 : 4.2); e.vy = e.type === 'slag' ? -9 : -12.5; e.cd = e.type === 'slag' ? 1.8 : 1.5; G.ev('hop', { x: e.x, y: e.y });
            if (e.type === 'slag') { G.shot(e.x, e.y - 0.6, -2.5, -8, { kind: 'glob', g: 1 }); G.shot(e.x, e.y - 0.6, 2.5, -8, { kind: 'glob', g: 1 }); } }
        } else {
          e.vy = Math.min(18, e.vy + 40 * dt);
          var nx = e.x + e.vx * dt; if (G.solid(Math.floor(nx + Math.sign(e.vx) * e.w / 2), Math.floor(e.y - 0.4))) { e.vx = -e.vx * 0.3; nx = e.x; }
          e.x = nx;
          var ny = e.y + e.vy * dt;
          if (e.vy > 0 && G.solid(Math.floor(e.x), Math.floor(ny))) { e.y = Math.floor(ny); e.vy = 0; }
          else if (e.vy < 0 && G.solid(Math.floor(e.x), Math.floor(ny - e.h))) { e.vy = 0; }
          else e.y = ny;
          if (e.y > G.R.H + 2) e.dead = true;
        }
        break;
      }
      case 'fish': {
        var inW = G.water(Math.floor(e.x), Math.floor(e.y - 0.3));
        if (dist < 8 && G.water(Math.floor(h.x), Math.floor(h.y - 0.9))) { var n3 = Math.max(0.1, dist); e.vx += (dx / n3 * D.sp - e.vx) * 2 * dt; e.vy += (dy / n3 * D.sp - e.vy) * 2 * dt; }
        else { e.vx += (Math.sin(e.t * 0.7) * 2 - e.vx) * dt; e.vy += (Math.cos(e.t * 0.9) * 0.8 - e.vy) * dt; }
        var fx = e.x + e.vx * dt, fy = e.y + e.vy * dt;
        if (G.water(Math.floor(fx), Math.floor(fy - 0.3)) && !G.solid(Math.floor(fx), Math.floor(fy - 0.3))) { e.x = fx; e.y = fy; } else { e.vx = -e.vx; e.vy = -e.vy; }
        if (!inW) e.y += 3 * dt;
        if (e.vx) e.face = e.vx > 0 ? 1 : -1;
        break;
      }
      case 'icicle': {
        if (e.st === 'idle') { e.y = e.home.y + e.h; if (Math.abs(dx) < 1.4 && h.y > e.y && h.y - e.y < 14 && G.los(e.x, e.y, h.x, h.y - 1)) { e.st = 'shake'; e.t = 0; G.ev('crack', { x: e.x, y: e.y }); } }
        else if (e.st === 'shake') { if (e.t > 0.35) { e.st = 'fall'; e.vy = 0; } }
        else if (e.st === 'fall') { e.vy = Math.min(22, e.vy + 50 * dt); e.y += e.vy * dt; if (G.solid(Math.floor(e.x), Math.floor(e.y))) { e.st = 'gone'; e.t = 0; G.ev('shatter', { x: e.x, y: e.y }); } }
        else if (e.st === 'gone') { if (e.t > 4) { e.st = 'idle'; e.hp = e.max; e.y = e.home.y + e.h; } }
        break;
      }
      case 'vine': {
        e.face = dx > 0 ? 1 : -1;
        if (e.st === 'idle') { e.ext = Math.max(0, e.ext - dt * 4); if (Math.abs(dx) < 3.6 && Math.abs(dy) < 2 && e.cd <= 0) { e.st = 'wind'; e.t = 0; } }
        else if (e.st === 'wind') { if (e.t > 0.35) { e.st = 'lunge'; e.t = 0; G.ev('snap', { x: e.x, y: e.y }); } }
        else if (e.st === 'lunge') { e.ext = Math.min(2.6, e.ext + dt * 14); if (e.t > 0.45) { e.st = 'idle'; e.cd = 1.1; } }
        break;
      }
      case 'wisp': {
        if (dist < 11) { var n4 = Math.max(0.1, dist); e.x += dx / n4 * D.sp * dt; e.y += dy / n4 * D.sp * dt; }
        else { e.x = e.home.x + Math.sin(e.t * 0.8) * 1.5; e.y = e.home.y + Math.cos(e.t * 1.1) * 1; }
        e.face = dx > 0 ? 1 : -1;
        break;
      }
      case 'spark': {
        var n5 = Math.max(0.1, dist); e.vx += (dx / n5 * D.sp - e.vx) * 1.5 * dt; e.vy += (dy / n5 * D.sp - e.vy) * 1.5 * dt;
        e.x += e.vx * dt; e.y += e.vy * dt; if (e.t > 9) e.dead = true;
        break;
      }
    }
  }
  // щит щитоносца: удар спереди не проходит (кроме пробивающих и заряженных)
  function blocks(e, shot) { return DEF[e.type].shield && !shot.pierce && !shot.big && (shot.vx > 0 ? -1 : 1) === e.face && Math.abs(shot.vy) < Math.abs(shot.vx); }

  P.EN = { DEF: DEF, make: make, update: update, box: box, blocks: blocks };
})(typeof window !== 'undefined' ? window : globalThis);
