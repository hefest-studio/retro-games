/* РИКОШЕТ · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Управляет только как игрок мышью/пальцем: setPointer(x) (рука с ограниченной скоростью), action() — запуск/лазер.
   Человеческие ограничения:
   - реакция 150–250 мс: бот видит шары такими, какими они были react секунд назад (пересэмплируется каждые ~0,6 с);
   - рука двигается не быстрее handV px/с, прицел с ошибкой ±aimErr px (своя на каждый подлёт шара);
   - смещение точки удара по ракетке выбирает случайно (как игрок, который «подрезает» шар), мимо призов не охотится.
   perfect: реакция 0, рука мгновенная, ошибок нет — для проверки проходимости всех стен.
   opts: { level=1, mode='campaign', react=[0.15,0.25], handV=1500, aimErr=7, perfect=false, maxT=300, lives, levels=1 } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playRik(RIK, seed, opts = {}){
  const K = RIK.logic.K, perfect = !!opts.perfect, brng = mulberry32(seed * 7919 + 13);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += brng(); return (u - 2) / 0.577; };
  const [r0, r1] = opts.react || [0.15, 0.25];
  const handV = perfect ? 1e9 : (opts.handV || 1500), aimErr = perfect ? 0 : (opts.aimErr == null ? 7 : opts.aimErr);
  const maxT = opts.maxT || 300, need = opts.levels || 1;
  const res = { seed, cleared: 0, over: false, won: false, time: 0, lost: 0, broken: 0, zaps: 0, levelTimes: [], nudges: 0 };
  let clears = 0, tLevel = 0;
  const game = RIK.Game({ rng: mulberry32(seed), level: opts.level || 1, mode: opts.mode || 'campaign', lives: opts.lives, prizeMul: opts.prizeMul,
    onEvent: (t) => { if (t === 'clear'){ clears++; res.levelTimes.push(+(S.time - tLevel).toFixed(1)); tLevel = S.time; } } }).start();
  const S = game.state(), dt = 1 / 60, hist = [];
  let react = r0 + brng() * (r1 - r0), reactT = 0, hand = S.paddle.x, approach = null, off = 0, err = 0, stuckFor = 0, launchAt = 0.3 + brng() * 0.4;

  for (let f = 0; f < maxT * 60; f++){
    if (S.over || S.won || clears >= need) break;
    hist.push(S.balls.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy, stuck: b.stuck != null, id: b })));
    if (hist.length > 40) hist.shift();
    reactT += dt; if (reactT > 0.6){ reactT = 0; react = r0 + brng() * (r1 - r0); }
    const lag = perfect ? 0 : Math.round(react / dt), seen = hist[Math.max(0, hist.length - 1 - lag)];
    const P = S.paddle;
    // какой шар отбивать: ближайший по времени падающий; иначе — самый низкий
    let tgt = null, tBest = Infinity;
    for (const b of seen){ if (b.stuck || b.vy <= 0) continue; const t = (K.PY - K.BR - b.y) / b.vy; if (t >= -0.05 && t < tBest){ tBest = t; tgt = b; } }
    let aimX = hand;
    if (tgt){
      const t = Math.max(0, tBest); let x = tgt.x + tgt.vx * t;
      const lo = K.FX0 + K.BR, hi = K.FX1 - K.BR, w = hi - lo;   // «раскладка» отражений от стен
      x = ((x - lo) % (2 * w) + 2 * w) % (2 * w); x = x > w ? 2 * w - x : x; x += lo;
      if (approach !== tgt.id){ approach = tgt.id; off = (brng() * 2 - 1) * (perfect ? 0.75 : 0.55); err = gauss() * aimErr; }
      aimX = x - off * P.w / 2 + err;
    } else {
      approach = null;
      const up = seen.filter(b => !b.stuck).sort((a, b) => b.y - a.y)[0];
      if (up) aimX = hand + (up.x - hand) * 0.5;
    }
    const step = handV * dt; hand += Math.max(-step, Math.min(step, aimX - hand));
    game.setPointer(hand);
    game.setFire(S.fx.L > 0);
    if (S.balls.some(b => b.stuck != null)){ stuckFor += dt; if (stuckFor > launchAt){ game.action(); stuckFor = 0; launchAt = 0.3 + brng() * 0.4; } } else stuckFor = 0;
    game.update(dt);
  }
  res.cleared = clears; res.over = S.over; res.won = S.won; res.time = +S.time.toFixed(1); res.lost = S.stats.lost; res.broken = S.stats.broken;
  res.zaps = S.stats.zaps; res.nudges = S.stats.nudges; res.score = S.score; res.level = S.level; res.lives = S.lives;
  return res;
}
