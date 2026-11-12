/* КЛАДКА · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости.
   Без читов: видит то же, что на экране (ядра, слитки, искры, кладку), управляет
   только как игрок мышью — setTarget(x) с ограниченной скоростью руки и action().
   Человеческие ограничения:
   - реакция: всё видит с задержкой 150–250 мс (буфер кадров), решает ~30 раз/с;
   - траекторию ядра оценивает «на глаз»: ошибка угла (по умолчанию ~3°) — своя на
     каждый отрезок полёта; рикошеты считает только от стен, кладку не учитывает;
   - рука: скорость до ~1000 px/с, дрожь ±4 px;
   - метит краем мастерка в сторону оставшейся кладки, ловит слитки, если ядро далеко,
     уворачивается от искр Плавильни, когда это не мешает отбить ядро.
   opts: { levels=10, react:[0.15,0.25], angErr=0.05, hand=1000, perfect=false, maxLevelT=240 }
   perfect: true — «идеальный» бот без задержки и ошибок (проверка проходимости карт). */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playKladka(K, seed, opts = {}){
  const L = K.logic, levels = opts.levels || 10, perfect = !!opts.perfect;
  const brng = mulberry32(seed * 7919 + 13);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += brng(); return (u - 2) / 0.577; };
  const [r0, r1] = opts.react || [0.15, 0.25];
  const react = perfect ? 0 : r0 + brng() * (r1 - r0);
  const angErr = perfect ? 0 : (opts.angErr == null ? 0.08 : opts.angErr);
  const aimErr = opts.aimErr == null ? 0.25 : opts.aimErr;
  const hand = perfect ? 1e5 : (opts.hand || 800);
  const maxLevelT = opts.maxLevelT || 300;
  const lost = {}, levelTime = {};
  let stuckLevel = 0;
  const game = K.Game({ rng: mulberry32(seed), maxLevel: opts.startLevel ? opts.startLevel + levels - 1 : levels, level: opts.startLevel || 1,
    onEvent: (t, d) => { if (t === 'lose') lost[S.level] = (lost[S.level] || 0) + 1; } }).start();
  const S = game.state(), h = 1 / 60;
  const hist = [];                     // снимки того, что видно на экране
  const errOf = new Map();             // ошибка оценки угла на текущий отрезок полёта ядра
  let t = 0, tLevel = 0, curLevel = S.level, tgt = S.paddle.x, desired = S.paddle.x, nextDecide = 0, holdStuck = 0;
  let jitter = 0, aimNoise = 0;

  function snap(){
    return { t, balls: S.balls.map((b, i) => ({ id: i, x: b.x, y: b.y, vx: b.vx, vy: b.vy, stuck: b.stuck })),
      caps: S.caps.map(c => ({ x: c.x, y: c.y, kind: c.kind })), sparks: S.sparks.map(s => ({ x: s.x, y: s.y, vx: s.vx, vy: s.vy })) };
  }
  // Где ядро пересечёт линию мастерка (рикошеты только от стен)
  function landing(b, err){
    let vx = b.vx, vy = b.vy;
    if (err){ const a = Math.atan2(vy, vx) + err, s = Math.hypot(vx, vy); vx = Math.cos(a) * s; vy = Math.sin(a) * s; }
    const yL = L.PADDLE_Y - L.BALL_R;
    let dy = vy > 0 ? yL - b.y : (b.y - L.FY0 - L.BALL_R) + (yL - L.FY0 - L.BALL_R);
    const tt = dy / Math.abs(vy || 1);
    let x = b.x + vx * tt;
    const lo = L.FX0 + L.BALL_R, hi = L.FX1 - L.BALL_R, span = hi - lo;
    let u = ((x - lo) % (2 * span) + 2 * span) % (2 * span);
    x = u <= span ? lo + u : lo + 2 * span - u;
    return { x, t: tt, down: vy > 0 };
  }
  // Цель — открытый снизу блок кладки (или сердце Плавильни); меняется после каждого отбивания
  let aim = null;
  function pickAim(){
    if (S.boss && S.boss.hp > 0 && brng() < 0.7){ aim = { boss: true }; return; }
    const open = S.bricks.filter(b => !b.dead && !b.iron && !S.grid[(b.r + 1) * L.COLS + b.c]);
    const pool = open.length ? open : S.bricks.filter(b => !b.dead && !b.iron);
    aim = pool.length ? pool[(brng() * pool.length) | 0] : null;
  }
  // Смещение точки удара (rel −1…1), чтобы ядро ушло к цели (с учётом зеркала стен)
  function relFor(x0){
    if (!aim) return 0;
    const bx = aim.boss ? S.boss.x : aim.x + aim.w / 2, by = aim.boss ? S.boss.y + S.boss.h : aim.y + aim.h;
    const lo = L.FX0 + L.BALL_R, hi = L.FX1 - L.BALL_R, dy = L.PADDLE_Y - by;
    let bestA = null;
    for (const cx of [bx, 2 * lo - bx, 2 * hi - bx]){
      const a = Math.atan2(cx - x0, dy);
      if (Math.abs(a) <= L.MAX_ANGLE * 0.92 && (bestA == null || Math.abs(a) < Math.abs(bestA))) bestA = a;
    }
    return bestA == null ? 0 : bestA / L.MAX_ANGLE;
  }

  function decide(view){
    const P = S.paddle;
    let best = null;
    for (const b of view.balls){
      if (b.stuck) continue;
      const key = b.id + ':' + Math.sign(b.vx) + ':' + Math.sign(b.vy);
      if (!errOf.has(key)) errOf.set(key, gauss() * angErr);
      const l = landing(b, errOf.get(key));
      if (!best || l.t < best.t) best = l;
    }
    if (errOf.size > 64) errOf.clear();
    let want = P.x;
    if (best){
      // чем раньше прилёт, тем точнее метим под ядро; запас — сдвиг под нужный угол
      const rel = Math.max(-0.9, Math.min(0.9, relFor(best.x) + aimNoise));
      want = best.x - rel * P.w / 2;
      // ядро далеко (летит вверх) — подстраховка: ближе к прогнозу, но можно ловить слитки
      if (best.t > 0.75){
        const good = view.caps.filter(c => c.kind !== 'narrow' && !(c.kind === 'life' && S.lives >= 5))
          .map(c => ({ c, tt: (L.PADDLE_Y - c.y) / 115 })).filter(o => o.tt > 0 && o.tt < best.t - 0.35 && Math.abs(o.c.x - P.x) / hand < o.tt)
          .sort((a, b) => a.tt - b.tt)[0];
        if (good) want = good.c.x;
      }
      // слиток ТЕСНОТА над мастерком — отойти, если ядро не торопит
      for (const c of view.caps) if (c.kind === 'narrow' && best.t > 0.6){
        const tt = (L.PADDLE_Y - c.y) / 115;
        if (tt > 0 && tt < 0.6 && Math.abs(c.x - want) < P.w / 2 + 16) want = c.x + (want >= c.x ? 1 : -1) * (P.w / 2 + 20);
      }
      // искра Плавильни
      for (const s of view.sparks){
        if (s.vy <= 0) continue;
        const tt = (L.PADDLE_Y - s.y) / s.vy, sx = s.x + s.vx * tt;
        if (tt > 0 && tt < 0.7 && Math.abs(sx - want) < P.w / 2 + 8 && best.t > tt + 0.35) want = sx + (want >= sx ? 1 : -1) * (P.w / 2 + 14);
      }
    } else {
      want = P.x;
    }
    desired = want;
  }

  let lastTouch = 0;
  while (!S.over){
    // восприятие с задержкой
    hist.push(snap());
    while (hist.length > 2 && hist[1].t <= t - react) hist.shift();
    const view = hist[0];
    if (t >= nextDecide){ nextDecide = t + 1 / 30; decide(view); jitter = perfect ? 0 : gauss() * 4; }
    // рука: ограниченная скорость
    const step = hand * h, d = (desired + jitter) - tgt;
    tgt += Math.max(-step, Math.min(step, d));
    game.setTarget(tgt);
    // пуск/смола/резак
    if (S.balls.some(b => b.stuck)){ holdStuck += h; if (holdStuck > (perfect ? 0.05 : 0.35 + brng() * 0.4)){ game.action(); holdStuck = 0; } }
    else holdStuck = 0;
    game.setFire(S.pow.cutter > 0);
    if (S.sinceTouch < lastTouch || !aim || aim.dead || (aim.boss && !(S.boss && S.boss.hp > 0))){ pickAim(); aimNoise = perfect ? 0 : gauss() * aimErr; }
    lastTouch = S.sinceTouch;
    game.update(h); t += h;
    if (S.level !== curLevel){ levelTime[curLevel] = tLevel; curLevel = S.level; tLevel = 0; }
    tLevel += h;
    if (tLevel > maxLevelT){ stuckLevel = S.level; break; }
  }
  if (S.over || stuckLevel) levelTime[curLevel] = tLevel;
  const start = opts.startLevel || 1;
  const passed = S.won ? levels : (S.level - start);
  return { passed, won: S.won, lost, levelTime, stuck: stuckLevel, score: S.score, react };
}
