/* ОТГОН · tests/bot.mjs — «человеческий» бот-пастух: проходит перевалы, управляя только как игрок.
   Ввод — setMove(dx,dy) (стрелки) и три кнопки: whistle() свист, shout() окрик, staff() посох.
   Решения раз в 150–250 мс (реакция), между решениями держит прежнее направление. Видит то же, что игрок:
   стадо, хищников, тени камнепада, гул лавины, пастбища, водопои, укрытие, брод.
   Приоритеты: хищник → лавина/камнепад рядом → паника (колокол) → раненый (лечить) → уставший телёнок (нести)
   → ночь (в укрытие) → голод (на пастбище) → усталость (отдых у воды) → отбившиеся → вести стадо свистом.
   opts: { react:[0.15,0.25], maxT (с), levels (сколько перевалов пройти), from: снимок } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playOtgon(O, seed, opts = {}){
  const Lg = O.logic;
  const brng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const maxT = opts.maxT || 3600, dt = 1 / 60, levels = opts.levels || Lg.LEVELS.length;
  const ev = { events: {}, lost: 0, passes: [], won: false, regroups: 0, cps: 0 };
  const game = O.Game({ rng: mulberry32(seed), snapshot: opts.from, level: opts.level, onEvent: (t, d) => {
    ev.events[t] = (ev.events[t] || 0) + 1;
    if (t === 'lost') ev.lost++; else if (t === 'pass') ev.passes.push({ ...d, t: tm }); else if (t === 'win') { ev.won = true; ev.final = d; }
    else if (t === 'regroup') ev.regroups++; else if (t === 'checkpoint') ev.cps++;
  } }).start();
  const S = game.state;
  let grazedAt = 0, grazeP = null, curLv = -1, tm = 0, next = 0, mv = { x: 0, y: 0 }, task = null, taskT = 0, lastWh = -9, stuckX = 0, stuckT = 0, startLv = S().lv;

  const D = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function safeY(L, x, bias = 0){
    const t = Lg.topY(L, x), b = Lg.botY(L, x); let y = (t + b) / 2;
    if (Lg.isCliff(L, x) || Lg.isCliff(L, x + 150) || Lg.isCliff(L, x - 150)) y = t + (b - t) * 0.36;
    if (Lg.snowAt(L, x) > 0.2) y = t + (b - t) * 0.33;
    y += bias;
    for (const r of L.rocks) if (Math.abs(r[0] - x) < r[2] + 40 && Math.abs(r[1] - y) < r[2] + 40) y = r[1] > (t + b) / 2 ? r[1] - r[2] - 44 : r[1] + r[2] + 44;
    return Math.max(t + 26, Math.min(b - 30, y));
  }
  function goTo(p, tol = 8){ const h = S().hero, dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy); if (d < tol) { mv = { x: 0, y: 0 }; return true; } mv = { x: dx / d, y: dy / d }; return false; }
  function wh(every = 1.6){ if (tm - lastWh > every) { if (game.whistle()) lastWh = tm; } }
  // вести к точке: если стадо отстало — вернуться к нему, иначе идти и посвистывать
  function lead(C, p, every = 1.4){ const h = S().hero; if (Math.hypot(h.x - C.x, h.y - C.y) > 170) { goTo({ x: C.x + 40, y: C.y }, 30); wh(1); return false; } const r = goTo(p, 10); wh(every); return r; }
  function inRiverBand(L, x, pad = 0){ const r = L.river; return r && x > r.x - pad && x < r.x + r.w + pad; }

  function decide(){
    const s = S(), L = game.level(), h = s.hero;
    const act = s.herd.filter(a => a.st === 'ok' || a.st === 'seized');
    const herd = act.filter(a => a.st === 'ok');
    if (!herd.length) { mv = { x: 0, y: 0 }; return; }
    const C = { x: herd.reduce((q, a) => q + a.x, 0) / herd.length, y: herd.reduce((q, a) => q + a.y, 0) / herd.length };
    const avg = k => herd.reduce((q, a) => q + a[k], 0) / herd.length;
    const hunger = avg('hunger'), tired = avg('tired'), fear = avg('fear');
    if (h.tend) { mv = { x: 0, y: 0 }; return; }
    // 1) хищник
    const seized = s.preds.find(p => p.st === 'hold');
    const near = s.preds.filter(p => p.st !== 'flee').sort((a, b) => D(a, h) - D(b, h))[0];
    const pr = seized || (near && (D(near, C) < 260 || D(near, h) < 260) ? near : null);
    if (pr) { goTo(pr, 4); if (D(pr, h) < Lg.WAVE_R - 30) game.staff(); return; }
    // 2) лавина / камнепад: увести стадо из зоны
    if (s.aval && (s.aval.st === 'warn' || s.aval.st === 'run')) {
      const z = L.aval, mid = (z[0] + z[1]) / 2;
      const inZ = herd.filter(a => a.x > z[0] - 30 && a.x < z[1] + 30).length;
      if (inZ) { const out = C.x < mid ? z[0] - 140 : z[1] + 140; goTo({ x: out, y: safeY(L, out) }); wh(0.7); return; }
    }
    if (s.aval && s.aval.st === 'idle' && s.aval.cool <= 0 && L.aval && C.x > L.aval[0] - 260 && C.x < L.aval[0] - 120) {
      // переждать лавину перед склоном
      goTo({ x: L.aval[0] - 200, y: safeY(L, L.aval[0] - 200) }); wh(2); return;
    }
    for (let i = 0; i < L.falls.length; i++) {
      const f = s.fallZ[i]; if (f.st !== 'warn') continue;
      const hit = herd.filter(a => f.spots.some(sp => Math.hypot(a.x - sp[0], a.y - sp[1]) < sp[2] + 14));
      if (hit.length) { const z = L.falls[i], out = Math.min(z[1] + 90, Math.max(h.x, C.x) + 160); goTo({ x: out, y: safeY(L, out) }); wh(0.4); return; }
    }
    // 3) паника — колокол
    if (fear > 0.4 && D(h, C) < 140) { goTo(C, 30); game.staff(); return; }
    if (fear > 0.4) { goTo(C, 30); return; }
    // 4) раненый
    const inFall = (x) => L.falls.some(z => x > z[0] - 40 && x < z[1] + 40);
    const inj = herd.filter(a => a.inj && !inFall(a.x)).sort((a, b) => D(a, h) - D(b, h))[0];
    if (inj && !(s.nightOn && s.night > 0.5 && D(inj, C) > 200)) { if (goTo(inj, 24)) { mv = { x: 0, y: 0 }; game.staff(); } return; }
    // 5) телёнок
    const calf = herd.find(a => a.calf && (a.lie || a.tired > 0.7));
    if (!h.carry && calf) { if (goTo(calf, 20)) game.staff(); return; }
    if (h.carry) { const c = s.herd.find(a => a.id === h.carry); if (c && c.tired < 0.05 && !s.nightOn) { game.staff(); return; } }
    // 6) ночь — в укрытие
    if (s.nightOn && !s.nightDone) {
      const sh = L.shelters[0], sp = { x: sh[0], y: sh[1] };
      if (inRiverBand(L, C.x, 60) || inRiverBand(L, sh[0], 400) && C.x < L.river.x + L.river.w + 40) { /* сначала перейти реку */ }
      else {
        const out = herd.filter(a => Math.hypot(a.x - sh[0], a.y - sh[1]) > sh[2] + 6);
        if (D(h, sp) > 30) { lead(C, sp, 1.2); return; }
        mv = { x: 0, y: 0 };
        const far = out.sort((a, b) => D(b, h) - D(a, h))[0];
        if (far && D(far, h) > 300) { goTo(far, 60); wh(1); return; }
        wh(1.5); return;
      }
    }
    // 7) отбившиеся (дальше слышимости свиста)
    const strag = herd.filter(a => D(a, C) > 220).sort((a, b) => D(b, h) - D(a, h))[0];
    if (strag) { if (D(strag, h) > Lg.WHISTLE_R - 90) goTo(strag, 40); else { wh(1); goTo(C, 50); } return; }
    // дикий шерстень рядом — свистнуть
    const wild = s.wild.find(w => Math.abs(w.x - C.x) < 500);
    if (wild && D(wild, h) > 200) { goTo(wild, 150); wh(1.5); return; }
    if (wild) { wh(0.6); }
    // 8) голод — пастбище
    const past = L.pastures.filter(p => p[0] > C.x - 450 && p[0] < C.x + 650 && !inRiverBand(L, (p[0] + C.x) / 2, 0) && !(L.river && (p[0] - L.river.x) * (C.x - L.river.x) < 0)).sort((a, b) => Math.abs(a[0] - C.x) - Math.abs(b[0] - C.x))[0];
    if ((task === 'graze' || task === 'grazeW') && (hunger > 0.93 || tm - taskT > 45)) { task = 'grazed'; grazedAt = C.x; }
    if (task === 'grazed' && (hunger < 0.35 || C.x > grazedAt + 600)) task = null;
    if (!task && hunger < 0.72 && past) { task = 'graze'; taskT = tm; grazeP = past; }
    if ((task === 'graze' || task === 'grazeW') && grazeP) {
      const pc = { x: grazeP[0], y: grazeP[1] };
      if (task === 'graze') { if (lead(C, pc, 1.4) || D(h, pc) < 22) task = 'grazeW'; return; }
      const sx = grazeP[0] + grazeP[2] + 30; goTo({ x: sx, y: safeY(L, sx) });
      const inside = herd.filter(a => Lg.inCircle(grazeP, a.x, a.y)).length;
      if (inside < herd.length * 0.5 && tm - taskT > 20) { task = 'graze'; }
      return;
    }
    // 9) усталость — отдых (у воды, если рядом)
    if (task === 'rest' && tired < 0.2) task = null;
    if (tired > 0.62 && task !== 'rest') { task = 'rest'; taskT = tm; }
    if (task === 'rest') {
      const wat = L.waters.filter(w => Math.abs(w[0] - C.x) < 400 && !(L.river && (w[0] - L.river.x) * (C.x - L.river.x) < 0)).sort((a, b) => Math.abs(a[0] - C.x) - Math.abs(b[0] - C.x))[0];
      if (wat) { const wc = { x: wat[0], y: wat[1] }, ins = herd.filter(a => Lg.inCircle(wat, a.x, a.y, 14)).length; if (ins < herd.length * 0.6 && tm - taskT < 25) { lead(C, wc, 1.5); return; } }
      mv = { x: 0, y: 0 }; if (tm - taskT > 60) task = null; return;
    }
    // 10) вести: брод через реку
    if (L.river) {
      const r = L.river, fy = (r.f0 + r.f1) / 2, behind = herd.filter(a => a.x < r.x + r.w + 10).length;
      if (behind && C.x > r.x - 500) {
        if (h.x < r.x - 10) {
          const entry = { x: r.x - 40, y: fy };
          if (D(h, entry) > 12) { lead(C, entry, 1.6); return; }
          const close = herd.filter(a => D(a, entry) < 110).length;
          if (close < herd.length * 0.85) { mv = { x: 0, y: 0 }; wh(1.4); return; }
          goTo({ x: r.x + r.w + 60, y: fy }, 6); return;
        }
        const exit = { x: r.x + r.w + 70, y: fy };
        if (D(h, exit) > 12 && h.x < exit.x) { const slow = herd.filter(a => a.x < r.x - 60).length > herd.length * 0.4; if (slow && h.x > r.x + r.w / 2) { mv = { x: 0, y: 0 }; wh(1.2); return; } goTo(exit, 8); wh(1.4); return; }
        mv = { x: 0, y: 0 }; wh(1.3); if (behind <= Math.max(0, herd.length * 0.0)) {} return;
      }
    }
    // 11) вести стадо вперёд свистом
    const dC = D(h, C);
    if (dC > 150) { goTo({ x: C.x + 60, y: C.y }, 20); wh(1.2); return; }
    const end = L.end;
    let wx = Math.min(end + 40, Math.max(h.x, C.x) + 150);
    if (L.night && !s.nightDone && L.shelters.length) wx = Math.min(wx, L.shelters[0][0]);   // ночь близко — к укрытию, не дальше
    if (L.river && C.x < L.river.x && wx > L.river.x - 60) wx = L.river.x - 60;
    const wy = safeY(L, wx);
    if (dC > 95) { mv = { x: 0, y: 0 }; wh(1.0); return; }
    goTo({ x: wx, y: wy }, 10); wh(1.7);
  }

  const startT = 0;
  while (tm < maxT) {
    const s = S();
    if (s.phase === 'won' || (s.lv - startLv >= levels)) break;
    if (tm >= next) { decide(); if (opts.trace) opts.trace({ tm, task, mv, s }); next = tm + r0 + brng() * (r1 - r0); }
    game.setMove(mv.x, mv.y);
    game.update(dt); tm += dt;
    // зависание: стадо не продвигается 120 с
    if (s.lv !== curLv) { curLv = s.lv; stuckX = 0; stuckT = tm; }
    const c = s.C; if (c) { if (c.x > stuckX + 60) { stuckX = c.x; stuckT = tm; } }
    if (tm - stuckT > 180) { ev.stuck = true; if (opts.debug) console.log("STUCK", tm, stuckX, stuckT, c, s.phase); break; }
  }
  const s = S();
  return Object.assign(ev, { time: tm, lv: s.lv, x: s.C ? Math.round(s.C.x) : 0, totalEver: s.totalEver, delivered: s.delivered.slice(), stars: s.starsLv.slice(),
    alive: s.herd.filter(a => a.st !== 'lost').length });
}
