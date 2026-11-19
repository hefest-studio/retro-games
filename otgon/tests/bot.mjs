/* ОТГОН · tests/bot.mjs — «человеческий» бот-подпасок: проходит путь, управляя только как игрок.
   Ввод — setMove(dx,dy,run) (стрелки + бег) и две кнопки: whistle() свист, staff() посох.
   Решения раз в 150–250 мс (реакция), между решениями держит прежнее направление. Видит то же, что игрок:
   стадо, птицу, метку молнии, траву, воду, брод, костёр.
   Приоритеты: испуг/молния (свист) → птица (подойти, посох) → отбившиеся (найти, свист, привести)
   → голод (привал на траве) → усталость (водопой) → костёр → гнать стадо (сзади, посохом), в буран — вести свистом.
   opts: { react:[0.15,0.25], maxT (с), branch:'up'|'down' (ветка развилок), from: снимок, legs: сколько участков пройти, stop(S): условие остановки } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playOtgon(O, seed, opts = {}){
  const Lg = O.logic, K = Lg.K;
  const brng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const maxT = opts.maxT || 3600, dt = 1 / 60, branch = opts.branch || 'down';
  const ev = { events: {}, lost: {}, cps: 0, won: false, final: null, legT: [], stuck: false };
  let tm = 0;
  const game = O.Game({ rng: mulberry32(seed), snapshot: opts.from, onEvent: (t, d) => {
    ev.events[t] = (ev.events[t] || 0) + 1;
    if (t === 'lost') ev.lost[d.why] = (ev.lost[d.why] || 0) + 1;
    else if (t === 'checkpoint') ev.cps++;
    else if (t === 'camp') ev.legT.push(Math.round(tm));
    else if (t === 'win') { ev.won = true; ev.final = d; ev.legT.push(Math.round(tm)); }
  } }).start();
  const S = game.state;
  const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const used = new Set();
  let leadUntil = 0;
  let next = 0, mv = { x: 0, y: 0, run: false }, lastStaff = -9, lastWh = -9, halt = null, haltT = 0, campWait = 0, bestX = 0, bestAt = 0, startLv = S().lv, legsDone = 0;

  // обход провала развилки: если цель по другую сторону — сначала к ближнему концу провала
  function go(h, x, y, run){
    const l = Lg.LEGS[S().lv], I = l.isl;
    if (I) { const m = (I.yt + I.yb) / 2, hin = h.x > I.x0 - 10 && h.x < I.x1 + 10, tin = x > I.x0 - 10 && x < I.x1 + 10;
      if ((hin || tin) && (h.x > I.x0 - 60 || x > I.x0 - 60) && (h.x < I.x1 + 60 || x < I.x1 + 60) && (h.y - m) * (y - m) < 0 && (hin && tin || (hin ? Math.abs(y - m) > 30 : Math.abs(h.y - m) > 30))) {
        const viaL = Math.abs(h.x - I.x0) + Math.abs(x - I.x0) < Math.abs(h.x - I.x1) + Math.abs(x - I.x1);
        const vx = viaL ? I.x0 - 50 : I.x1 + 50;
        if (Math.abs(h.x - vx) > 14 || Math.abs(h.y - m) > 40) return go0(h, vx, m + (Math.abs(h.x - vx) > 60 ? (h.y < m ? -80 : 80) * 0 + (h.y - m) : 0), run);
      } }
    go0(h, x, y, run);
  }
  function go0(h, x, y, run){ const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy); if (d < 5) { mv = { x: 0, y: 0, run: false }; return; } mv = { x: dx / d, y: dy / d, run: !!run }; }
  function stop(){ mv = { x: 0, y: 0, run: false }; }

  function decide(){
    const s = S(), l = Lg.LEGS[s.lv], h = s.hero, list = game.alive();
    if (s.phase === 'camp') { campWait += 1; if (campWait > 8) { campWait = 0; legsDone++; game.nextLeg(); } stop(); return; }
    if (s.phase !== 'play' || !list.length) { stop(); return; }
    const core = list.filter(c => !c.stray), base = core.length ? core : list;
    const cen = { x: base.reduce((a, c) => a + c.x, 0) / base.length, y: base.reduce((a, c) => a + c.y, 0) / base.length };
    const bl = Lg.zoneK(l.bliz, cen.x);
    const canWh = h.wT <= 0, canSt = h.sT <= 0;
    // 1. испуг и молния — свистом успокоить
    const scared = list.some(c => (c.bolt > 0 || c.fear > 0.5) && D(c, h) < K.WHISTLE_R * 0.9);
    const charge = s.strikes.some(k => k.t < 1.2) && list.some(c => c.calmT < 1 && D(c, h) < K.WHISTLE_R);
    if (canWh && (scared || charge)) { game.whistle(); lastWh = tm; }
    // 2. птица — к жертве, посохом отогнать
    const b = s.bird;
    if (b && b.ph !== 'away') {
      const tg = list.find(c => c.id === b.id);
      if (canSt && D(b, h) < 190) { game.staff(); lastStaff = tm; }
      if (tg) { go(h, tg.x, tg.y, D(tg, h) > 170); return; }
    }
    // 3. отбившиеся — найти и привести свистом
    // 4. привал: трава и вода
    const minFood = Math.min(...list.map(c => c.food)), minPep = Math.min(...list.map(c => c.pep));
    const avgFood = list.reduce((a, c) => a + c.food, 0) / list.length, avgPep = list.reduce((a, c) => a + c.pep, 0) / list.length;
    if (halt) {
      haltT += 0.2;
      const done = halt.kind === 'grass' ? minFood > 0.93 : minPep > 0.9;
      if (done || haltT > 50) { used.add(s.lv + ':' + halt.p[0]); halt = null; }
      else {
        const d = Math.hypot(halt.p[0] - cen.x, halt.p[1] - cen.y);
        if (d < halt.p[2] * 0.6 + (halt.kind === 'water' ? 40 : 0) || list.every(c => c.graze || c.drink || (halt.kind === 'grass' ? c.food > 0.93 : c.pep > 0.9))) { stop(); return; }
        if (d < 240) {   // рядом: встать на место привала и позвать
          const hx = halt.p[0], hy = halt.p[1] + (halt.kind === 'water' ? halt.p[2] + 24 : 0);
          if (Math.hypot(hx - h.x, hy - h.y) > 20) go(h, hx, hy, false); else stop();
          if (canWh && tm - lastWh > 4 && Math.hypot(hx - h.x, hy - h.y) < 60 && !list.some(c => c.graze || c.drink) && list.filter(c => Math.hypot(c.x - hx, c.y - hy) > 110).length > list.length * 0.2) { game.whistle(); lastWh = tm; }
          return;
        }
        drive(s, l, h, list, cen, { x: halt.p[0], y: halt.p[1] }, bl); return;
      }
    }
    if (!halt) {
      const pick = (arr, lim) => arr.filter(p => !used.has(s.lv + ':' + p[0]) && p[0] > cen.x - 330 && p[0] < cen.x + lim && !(Lg.islAt(l, p[0]) && branch === 'up')).sort((p, q) => p[0] - q[0])[0];
      // привал нужен, если до следующей травы/воды запаса не хватит (чем дальше следующая — тем раньше остановка)
      const need = (arr, p, rate) => { const nx = arr.filter(q => q[0] > p[0] + 200).sort((a, b) => a[0] - b[0])[0]; return Math.min(0.86, ((nx ? nx[0] : l.len + 1500) - p[0]) / 40 * rate + 0.45); };
      const pg = pick(l.grass, 520), pw = pick(l.water, 520);
      if (pg && (minFood < need(l.grass, pg, 1 / 250) - 0.08 || avgFood < need(l.grass, pg, 1 / 250))) { halt = { kind: 'grass', p: pg }; haltT = 0; }
      if (!halt && pw && (minPep < need(l.water, pw, 1 / 280) - 0.2 || avgPep < need(l.water, pw, 1 / 280) - 0.12)) { halt = { kind: 'water', p: pw }; haltT = 0; }
    }
    // оказавшийся по другую сторону провала развилки — обойти, позвать и привести вокруг
    const I = l.isl, ia = I ? Lg.islAt(l, cen.x) : null;
    if (I && cen.x > I.x0 - 460 && cen.x < I.x0 + 320) {   // перед развилкой — собрать всё стадо на линии выбранной ветки
      const m0 = (I.yt + I.yb) / 2, sgn = branch === 'up' ? -1 : 1;
      const wrong = list.filter(c => c.x > I.x0 - 520 && c.x < I.x0 + 340 && (c.y - m0) * sgn < -5);
      if (wrong.length) {
        const ex = Math.max(I.x0 - 400, Math.min(I.x0 - 120, cen.x - 10)), ey = Lg.laneY(l, I.x0 - 60, branch);
        if (Math.hypot(ex - h.x, ey - h.y) > 18) go(h, ex, ey, true); else stop();
        if (canWh && tm - lastWh > 2.2 && Math.hypot(ex - h.x, ey - h.y) < 90) { game.whistle(); lastWh = tm; }
        return;
      }
    }
    if (ia && ia.b - ia.t > 20) {
      const m = ia.m, side = cen.y < m ? -1 : 1;
      const far = list.filter(c => c.x > I.x0 && c.x < I.x1 && (c.y - m) * side < 0).sort((p, q) => D(p, h) - D(q, h))[0];
      if (far && far.x < I.x0 + 300 && cen.x < I.x0 + 300) {   // стадо разделилось о начало провала — собрать перед развилкой
        const ex = I.x0 - 90, ey = Lg.laneY(l, ex, branch);
        if (Math.hypot(ex - h.x, ey - h.y) > 18) go(h, ex, ey, true); else stop();
        if (canWh && tm - lastWh > 2.2 && Math.hypot(ex - h.x, ey - h.y) < 80) { game.whistle(); lastWh = tm; }
        return;
      }
      if (far) {
        const sameSide = (h.y - m) * (far.y - m) > 0 && h.x > I.x0 - 70 && h.x < I.x1 + 70;
        if (!sameSide || D(far, h) > 150) { go(h, far.x - 30, far.y, true); return; }
        if (canWh && (far.callT < 1 || D(far, h) > 110)) { game.whistle(); lastWh = tm; }
        if (D(far, h) > 100) { stop(); return; }
        go(h, cen.x, cen.y, false); return;
      }
    }
    const stray = list.filter(c => c.stray).sort((p, q) => D(p, h) - D(q, h))[0];
    if (stray) {
      if (D(stray, h) > 230) { go(h, stray.x, stray.y, true); return; }
      if (canWh) { game.whistle(); lastWh = tm; }
      go(h, cen.x, cen.y, false); return;
    }
    const called = list.find(c => c.callT > 0 && D(c, cen) > 170);
    if (called && bl < 0.3) { if (canWh && tm - lastWh > 2.4) { game.whistle(); lastWh = tm; } if (D(h, cen) > 60) go(h, cen.x, cen.y, false); else stop(); return; }
    // 5. костёр
    const camp = { x: l.camp[0], y: l.camp[1] };
    if (cen.x > camp.x - 260) {
      if (D(cen, camp) < 150 || h.x > camp.x - 30) { if (D(h, camp) > 30) go(h, camp.x, camp.y, false); else stop(); if (canWh && tm - lastWh > 2.5) { game.whistle(); lastWh = tm; } return; }
      drive(s, l, h, list, cen, camp, bl); return;
    }
    // 6. гнать (в буран — вести)
    if (tm - bestAt > 45) leadUntil = tm + 25;
    const ax = cen.x + 110;
    drive(s, l, h, list, cen, { x: ax, y: Lg.laneY(l, ax, branch) }, bl);
  }

  function drive(s, l, h, list, cen, wp, bl){
    const canWh = h.wT <= 0, canSt = h.sT <= 0;
    let dx = wp.x - cen.x, dy = (wp.y - cen.y) * 1.25, d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    if (bl > 0.3 || tm < leadUntil) {            // буран (или застряли): встать впереди и звать
      const gx = cen.x + dx * 80, gy = Lg.laneY(l, gx, branch);
      if (Math.hypot(gx - h.x, gy - h.y) > 26) go(h, gx, gy, D(h, cen) > 200); else stop();
      if (canWh && tm - lastWh > 1.7 && D(h, cen) > 50) { game.whistle(); lastWh = tm; }
      return;
    }
    const spread = Math.max(...list.map(c => D(c, cen)));
    if (spread > 120 && canWh && tm - lastWh > 4 && D(h, cen) < 140) { game.whistle(); lastWh = tm; }
    const gx = cen.x - dx * 74, gy0 = cen.y - dy * 74, tt = Lg.topY(l, gx) + 13, tb = Lg.botY(l, gx) - 13, ia = Lg.islAt(l, gx);
    let gy = Math.max(tt, Math.min(tb, gy0));
    if (ia && ia.b - ia.t > 4 && gy > ia.t - 10 && gy < ia.b + 10) gy = cen.y < ia.m ? ia.t - 10 : ia.b + 10;
    const gd = Math.hypot(gx - h.x, gy - h.y);
    if (gd > 36) {
      // обойти стадо сбоку, если подпасок оказался впереди
      const ahead = (h.x - cen.x) * dx + (h.y - cen.y) * dy > -20;
      if (ahead && gd > 60) { const side = (h.y - cen.y) * dx - (h.x - cen.x) * dy > 0 ? 1 : -1; const t = Lg.topY(l, h.x) + 14, bb = Lg.botY(l, h.x) - 14; go(h, gx - dy * -side * 0, Math.max(t, Math.min(bb, gy + side * 70 * Math.abs(dx))), gd > 150); }
      else go(h, gx, gy, gd > 150);
      return;
    }
    mv = { x: dx, y: dy, run: false };
    const vAlong = list.reduce((a, c) => a + c.vx * dx + c.vy * dy, 0) / list.length;
    const onEdge = Lg.dropAt(l, cen.x) || Lg.riverAt(l, cen.x, 120) || (Lg.islAt(l, cen.x) && cen.y < Lg.islAt(l, cen.x).m);
    if (canSt && tm - lastStaff > (onEdge ? 2.2 : 3.6) && (vAlong < 40 || onEdge) && h.fx * dx + h.fy * dy > 0.8 && (Math.abs(dy) < 0.5 || !(Lg.dropAt(l, cen.x) || Lg.riverAt(l, cen.x, 320)))) { game.staff(); lastStaff = tm; }
  }

  while (tm < maxT){
    const s = S();
    if (s.phase === 'won') break;
    if (s.phase === 'alone') break;
    if (opts.legs && legsDone >= opts.legs) break;
    if (opts.stop && opts.stop(s)) break;
    if (tm >= next) { decide(); next = tm + r0 + brng() * (r1 - r0); }
    game.setMove(mv.x, mv.y, mv.run);
    game.update(dt); tm += dt;
    const prog = s.lv * 10000 + s.hero.x;
    if (prog > bestX + 40) { bestX = prog; bestAt = tm; }
    if (tm - bestAt > 300) { ev.stuck = true; break; }
  }
  const s = S();
  return { ...ev, time: tm, lv: s.lv, x: s.hero.x, home: game.alive().length, phase: s.phase, game, legs: s.lv - startLv };
}
