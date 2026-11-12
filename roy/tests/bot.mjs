/* РОЙ · tests/bot.mjs — «человеческий» бот для проверки баланса.
   Без читов: видит только то, что на экране (позиции врагов/пуль из state()),
   и управляет только через setDir/setFire — как игрок с клавиатуры.
   Человеческие ограничения:
   - реакция: решения принимаются по «картинке» 150–250 мс давности (буфер кадров);
     собственный корабль бот знает точно (проприоцепция);
   - решения пересматриваются ~12 раз в секунду, а не каждый кадр;
   - прицел с разбросом ±6 px, траектории пике предсказываются линейно по двум кадрам
     (бот не знает, куда враг довернёт);
   - запас безопасности по уклонению небольшой, как у умелого игрока. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const P_SPEED = 250, P_BULLET_V = 580, HULL_HX = 13, HULL_HY = 12;

// Снимок того, что видно на экране.
function snap(S, t){
  return {
    t,
    en: S.enemies.filter(e=>e.state!=='dead' && e.state!=='wait').map(e=>({ id:e.id, x:e.x, y:e.y, state:e.state, sub:e.sub, kind:e.kind, r:e.r })),
    eb: S.eb.map(q=>({ x:q.x, y:q.y, vx:q.vx, vy:q.vy }))
  };
}

/* Сыграть одну партию. R — модуль ROY (из vm), seed — сид игры и бота.
   opts: { waves=5, maxT=900, react:[0.15,0.25], aimNoise=6, decide=1/12, margin=6 } */
export function playRoy(R, seed, opts={}){
  const C = R.consts, PY = C.PLAYER_Y, W = C.W;
  const waves = opts.waves || 5, maxT = opts.maxT || 900;
  const brng = mulberry32(seed*7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const react = r0 + brng()*(r1-r0);              // реакция этого «игрока»
  const aimNoise = opts.aimNoise == null ? 6 : opts.aimNoise;
  const decideDt = opts.decide || 1/12;
  const margin = opts.margin == null ? 6 : opts.margin;
  const causes = { bullet:0, ram:0, capture:0 };
  let prevEv = null;
  const g = R.Game({ rng: mulberry32(seed), onEvent:(type,d)=>{
    if (type === 'captured') causes.capture++;
    if (type === 'die' || type === 'hull') { if (prevEv && prevEv[0] === 'kill' && prevEv[1].y > PY - 40) causes.ram++; else causes.bullet++; }
    prevEv = [type, d];
  } }); g.start();
  const S = g.state(), h = 1/60;
  const hist = [];
  let t = 0, nextDecide = 0, dir = 0, fireOn = false, goalX = W/2, noise = 0;
  const wavesLost = {};                      // волна → потерянные жизни
  let lastLives = S.lives, maxWave = 1;

  function stale(){ // кадр давностью react
    let s = hist[0];
    for (let i = hist.length-1; i >= 0; i--) if (hist[i].t <= t - react){ s = hist[i]; break; }
    return s;
  }
  function prevOf(s){ // кадр за ~0.1 с до s — для оценки скорости
    for (let i = hist.length-1; i >= 0; i--) if (hist[i].t <= s.t - 0.1) return hist[i];
    return null;
  }

  function decide(){
    const p = S.player;
    if (!p.alive){ dir = 0; fireOn = false; return; }
    const s = stale(), s0 = prevOf(s), age = t - s.t;
    const vel = {};
    if (s0){ const dtv = s.t - s0.t; for (const e of s0.en) vel[e.id] = e; for (const e of s.en){ const o = vel[e.id]; vel[e.id] = o ? { vx:(e.x-o.x)/dtv, vy:(e.y-o.y)/dtv } : { vx:0, vy:0 }; } }
    const dual = p.dual, hulls = x => dual ? [x, x + C.HULL_GAP] : [x];
    const maxX = W - 18 - (dual ? C.HULL_GAP : 0);

    // угрозы на горизонте 0.9 с: пули (линейно) и пикирующие (линейно по двум кадрам)
    const threats = [];
    for (const q of s.eb) threats.push({ x:q.x + q.vx*age, y:q.y + q.vy*age, vx:q.vx, vy:q.vy, rx:HULL_HX-2, ry:HULL_HY });
    for (const e of s.en){
      if (e.state !== 'dive' && e.state !== 'return') continue;
      if (e.sub === 'beam' || e.sub === 'hold'){
        threats.push({ beam:true, x:e.x });       // луч виден на экране — держимся в стороне
        continue;
      }
      const v = vel[e.id] || { vx:0, vy:0 };
      threats.push({ x:e.x + v.vx*age, y:e.y + v.vy*age, vx:v.vx, vy:v.vy, rx:e.r+HULL_HX-4, ry:e.r+HULL_HY-4 });
    }

    // цель для прицела: враг, к которому пуля успеет; пикирующие — в приоритете
    let aimX = goalX, best = 1e9;
    for (const e of s.en){
      if (e.state === 'enter') continue;
      if (e.y > PY - 40) continue;
      const v = vel[e.id] || { vx:0, vy:0 };
      const tf = (PY - 16 - e.y) / P_BULLET_V;
      const ex = e.x + v.vx*(age + tf);
      const reach = Math.abs(ex - p.x) / P_SPEED;
      const pri = reach + (e.state === 'dive' ? -0.4 : 0) + (e.kind === 'medusa' && e.state === 'form' ? 0.2 : 0);
      if (pri < best){ best = pri; aimX = ex; }
    }
    noise = noise*0.6 + (brng()*2-1)*aimNoise*0.4;
    aimX = Math.max(18, Math.min(maxX, aimX + noise));

    // выбор позиции: перебор целевых x, имитация движения к ней, штраф за попадание
    let bestX = p.x, bestCost = 1e9;
    for (let cx = 18; cx <= maxX + 0.1; cx += 8){
      let cost = Math.abs(cx - aimX) * 0.02 + Math.abs(cx - p.x) * 0.004;
      let px = p.x;
      for (let tau = 0; tau <= 0.9; tau += 1/30){
        const d = cx - px, stepx = P_SPEED/30; px += Math.abs(d) <= stepx ? d : Math.sign(d)*stepx;
        if (p.inv > tau + 0.1) continue;
        for (const th of threats){
          for (const hx of hulls(px)){
            if (th.beam){ if (Math.abs(hx - th.x) < S.BEAM_HALF + margin) cost += 3/(1+tau*4); continue; }
            const tx = th.x + th.vx*tau, ty = th.y + th.vy*tau;
            if (Math.abs(tx - hx) < th.rx + margin && Math.abs(ty - PY) < th.ry + 4) cost += 100/(1+tau*6);
          }
        }
        if (cost > bestCost) break;
      }
      if (cost < bestCost){ bestCost = cost; bestX = cx; }
    }
    goalX = bestX;
    // огонь: цель над кораблём (с учётом разброса)
    fireOn = Math.abs(aimX - p.x) < 12 || (dual && Math.abs(aimX - (p.x + C.HULL_GAP)) < 12);
  }

  while (t < maxT && !S.over){
    hist.push(snap(S, t)); if (hist.length > 40) hist.shift();
    if (t >= nextDecide){ decide(); nextDecide = t + decideDt*(0.8 + brng()*0.4); }
    const p = S.player;
    dir = Math.abs(goalX - p.x) < 3 ? 0 : Math.sign(goalX - p.x);
    g.setDir(dir); g.setFire(fireOn);
    g.update(h); t += h;
    if (S.lives < lastLives) wavesLost[S.wave] = (wavesLost[S.wave]||0) + (lastLives - S.lives);
    lastLives = S.lives; maxWave = Math.max(maxWave, S.wave);
    if (S.wave > waves || (S.wave === waves && S.phase === 'clear')) break;
  }
  const cleared = S.won || S.wave > waves || (S.wave === waves && S.phase === 'clear');
  // наибольшая полностью пройденная волна
  const passed = cleared ? waves : (S.phase === 'clear' ? S.wave : S.wave - 1);
  return { seed, won: S.won, cleared, passed, wave: S.wave, lives: S.lives, score: S.score, t, react, lost: wavesLost, causes };
}
