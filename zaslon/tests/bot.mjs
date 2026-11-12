/* ЗАСЛОН · tests/bot.mjs — «человеческий» бот для проверки баланса.
   Без читов: видит только то, что на экране (позиции врагов/пуль/босса из state()),
   и управляет только через setDir/setFire/bomb и кнопки мастерской — как игрок.
   Человеческие ограничения:
   - реакция: решения по «картинке» 150–250 мс давности (буфер кадров); свой корабль — точно;
   - решения ~12 раз в секунду; движение — только 8 направлений клавиатуры;
   - скорости врагов/пуль оцениваются по двум кадрам и экстраполируются линейно
     (бот не знает, куда стриж довернёт и когда босс выстрелит);
   - внимание: учитываются угрозы в радиусе ~190 px от корабля; моторный разброс ±8 px;
     скорость каждой пули оценивается с ошибкой ~±12% и ±6° (как «на глаз»);
   - огонь зажат всё время (как обычно играют в шутеры), бомба — «в панике»;
   - мастерская: простая разумная очередь покупок. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function snap(S, t){
  const B = S.boss;
  return {
    t,
    en: S.enemies.filter(e=>!e.dead).map(e=>({ id:e.id, x:e.x, y:e.y, r:e.r, kind:e.kind })),
    eb: S.eb.map(q=>({ x:q.x, y:q.y, vx:q.vx, vy:q.vy, r:q.r, ref:q })),
    boss: B ? { x:B.x, y:B.y, w:B.w, h:B.h, beam: B.beam ? { x:B.beam.x, live: B.beam.t > B.beam.warn - 0.15 } : null } : null,
    caps: S.caps.map(c=>({ x:c.x, y:c.y, ty:c.ty })),
    scraps: S.scraps.map(s=>({ x:s.x, y:s.y }))
  };
}

/* Сыграть одну партию. Z — модуль ZASLON (из vm), seed — сид игры и бота.
   opts: { sectors=5, maxT=1500, react:[0.15,0.25], decide=1/12, margin=5, motor=8, attention=190 } */
export function playZaslon(Z, seed, opts={}){
  const C = Z.consts, W = C.W;
  const sectors = opts.sectors || 5, maxT = opts.maxT || 1500;
  const brng = mulberry32(seed*7919 + 17);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const react = r0 + brng()*(r1-r0);
  const decideDt = opts.decide || 1/12;
  const margin = opts.margin == null ? 5 : opts.margin;
  const motor = opts.motor == null ? 8 : opts.motor;
  const percErr = opts.perc == null ? 0.12 : opts.perc;
  const perc = new WeakMap();
  const causes = { bullet:0, ram:0, beam:0, boss:0, base:0 };
  const g = Z.Game({ rng: mulberry32(seed), onEvent:(type,d)=>{ if (type==='die') causes[d.src] = (causes[d.src]||0)+1; if (type==='baseDown') causes.base++; } });
  g.start();
  const S = g.state(), h = 1/60;
  const hist = [];
  let t = 0, nextDecide = 0, goal = { x: W/2, y: 560 };
  const lostBySector = {}, breachBySector = {};
  let lastLives = S.lives, lastBase = S.base, shopT = 0;

  function stale(){ let s = hist[0]; for (let i = hist.length-1; i >= 0; i--) if (hist[i].t <= t - react){ s = hist[i]; break; } return s; }
  function prevOf(s){ for (let i = hist.length-1; i >= 0; i--) if (hist[i].t <= s.t - 0.1) return hist[i]; return null; }

  function decide(){
    const p = S.player;
    if (!p.alive) return;
    const s = stale(), s0 = prevOf(s), age = t - s.t;
    const vel = {};
    if (s0){ const dtv = s.t - s0.t, o = {}; for (const e of s0.en) o[e.id] = e; for (const e of s.en){ const q = o[e.id]; vel[e.id] = q ? { vx:(e.x-q.x)/dtv, vy:(e.y-q.y)/dtv } : { vx:0, vy:60 }; } }
    // внимание: человек следит за угрозами вокруг корабля, дальние пули «замечает» поздно
    const threats = [], ATT = opts.attention || 190;
    for (const q of s.eb) if (Math.hypot(q.x - p.x, q.y - p.y) < ATT){
      // восприятие скорости неточно (у каждой пули — своя ошибка оценки, ~±12% и ±6°)
      let err = perc.get(q.ref); if (!err){ err = { k: 1 + (brng()*2-1)*percErr, a: (brng()*2-1)*0.1 }; perc.set(q.ref, err); }
      const ca = Math.cos(err.a), sa = Math.sin(err.a), vx = (q.vx*ca - q.vy*sa)*err.k, vy = (q.vx*sa + q.vy*ca)*err.k;
      threats.push({ x:q.x+vx*age, y:q.y+vy*age, vx, vy, r:q.r+C.P_HIT_R });
    }
    for (const e of s.en){ const v = vel[e.id] || { vx:0, vy:60 }; threats.push({ x:e.x+v.vx*age, y:e.y+v.vy*age, vx:v.vx, vy:v.vy, r:e.r+C.P_HIT_R }); }
    const B = s.boss;

    // паника → бомба
    let near = 0; for (const th of threats) if (Math.hypot(th.x-p.x, th.y-p.y) < 70) near++;
    let low = 0; for (const e of s.en) if (e.y > 470) low++;
    if (p.bombs > 0 && ((near >= 5 && p.shield === 0) || (S.base <= 30 && low >= 2) || (low >= 4))) g.bomb();

    // цель: враг, ближайший к прорыву (ниже всех), с учётом скорости; иначе босс
    let aimX = null, aimPri = -1e9;
    for (const e of s.en){
      if (e.y < 10 || e.y > p.y - 10) continue;
      const v = vel[e.id] || { vx:0, vy:60 };
      const pri = e.y + (e.kind === 'dart' ? 120 : 0) + (e.kind === 'hulk' ? 60 : 0) - Math.abs(e.x - p.x) * 0.35;
      if (pri > aimPri){ aimPri = pri; aimX = e.x + v.vx * (age + 0.25); }
    }
    if (aimX == null && B) aimX = B.x;
    if (aimX == null) aimX = goal.x;
    const wantY = p.weapon === 'shot' ? (B ? Math.max(C.Y_MIN + 10, B.y + B.h + 190) : 470) : 545;

    // капсула: ловим, если она сейчас нашего вида (повышение уровня)
    let capX = null;
    for (const c of s.caps) if (c.ty === p.weapon && p.lv[p.weapon] < 3 && c.y > 200) capX = c;

    let best = null, bestCost = 1e9;
    for (let cx = 20; cx <= W-20; cx += 22){
      for (const cy of [320, 390, 460, 520, 560, 595]){
        let cost = Math.abs(cx - aimX) * 0.03 + Math.abs(cy - wantY) * 0.006 + Math.hypot(cx-p.x, cy-p.y) * 0.002;
        if (capX) cost += Math.hypot(cx - capX.x, cy - capX.y) * 0.02;
        for (const c of s.caps) if (c.ty !== p.weapon && Math.hypot(cx - c.x, cy - c.y) < 40) cost += 2;
        if (B && Math.abs(cx - B.x) < B.w + 20 && cy < B.y + B.h + 40) cost += 50;
        if (B && B.beam && Math.abs(cx - B.beam.x) < 14 + C.P_HIT_R + margin + 6) cost += 60;
        // имитация движения к точке (8 направлений) и проверка столкновений
        let px = p.x, py = p.y;
        for (let tau = 0; tau <= 0.8; tau += 1/24){
          const dx = cx - px, dy = cy - py, d = Math.hypot(dx, dy), st = C.P_SPEED/24;
          if (d > st){ const sx = Math.abs(dx) > 3 ? Math.sign(dx) : 0, sy = Math.abs(dy) > 3 ? Math.sign(dy) : 0, k = (sx && sy) ? Math.SQRT1_2 : 1; px += sx*st*k; py += sy*st*k; }
          else { px = cx; py = cy; }
          if (p.inv > tau + 0.1) continue;
          for (const th of threats){
            const tx = th.x + th.vx*tau, ty = th.y + th.vy*tau, rr = th.r + margin;
            const ddx = tx - px, ddy = ty - py;
            if (ddx*ddx + ddy*ddy < rr*rr) cost += 100/(1+tau*5);
          }
          if (B && B.beam && B.beam.live && Math.abs(px - B.beam.x) < 14 + C.P_HIT_R + 2) cost += 80/(1+tau*5);
          if (cost > bestCost) break;
        }
        if (cost < bestCost){ bestCost = cost; best = { x:cx, y:cy }; }
      }
    }
    // моторный разброс: точка, куда «доводит» рука, неточна
    if (best) goal = { x: best.x + (brng()*2-1)*motor, y: best.y + (brng()*2-1)*motor };
  }

  function shopping(){
    const p = S.player, items = () => g.shopItems();
    const want = [];
    if (S.base < 60) want.push('repair');
    want.push('weapon', 'module');
    if (S.base < 85) want.push('repair');
    want.push('shield', 'module', 'weapon');
    if (p.bombs < 3) want.push('bomb');
    if (S.lives < 3) want.push('life');
    for (const k of want){
      const it = items().find(i=>i.key===k);
      if (it && it.can) g.buy(k);
    }
    g.leaveShop();
  }

  while (t < maxT && !S.over){
    if (S.phase === 'shop'){ shopT += h; if (shopT > 1.5){ shopping(); shopT = 0; } g.update(h); t += h; continue; }
    hist.push(snap(S, t)); if (hist.length > 40) hist.shift();
    if (t >= nextDecide){ decide(); nextDecide = t + decideDt*(0.8 + brng()*0.4); }
    const p = S.player;
    const dx = goal.x - p.x, dy = goal.y - p.y;
    g.setDir(Math.abs(dx) < 4 ? 0 : Math.sign(dx), Math.abs(dy) < 4 ? 0 : Math.sign(dy));
    g.setFire(true);
    g.update(h); t += h;
    if (S.lives < lastLives) lostBySector[S.sector] = (lostBySector[S.sector]||0) + (lastLives - S.lives);
    if (S.base < lastBase) breachBySector[S.sector] = (breachBySector[S.sector]||0) + (lastBase - S.base);
    lastLives = S.lives; lastBase = S.base;
  }
  const passed = S.won ? sectors : (S.phase === 'shop' || (S.phase === 'clear' && !S.over) ? S.sector : S.sector - 1);
  return { seed, won: S.won, passed, sector: S.sector, lives: S.lives, base: S.base, score: S.score, t, react, lost: lostBySector, breach: breachBySector, causes, scrap: S.scrap };
}
