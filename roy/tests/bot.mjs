/* РОЙ · tests/bot.mjs — «человеческий» бот для проверки баланса (переделка 2026-11: искра и манок).
   Без читов: видит только то, что на экране (позиции роя, Матки, плевков, манка из state()), управляет только
   setDir / fire / lure — как игрок со стиком и двумя кнопками. Человеческие ограничения:
   - реакция: решения по «картинке» react[0]…react[1] с давности (буфер кадров); свой корабль знает точно;
   - решения ~12 раз в секунду; прицел с разбросом ±aimNoise px;
   - движение роя предсказывает линейно по двум кадрам (не знает, куда стая повернёт).
   Тактика: держаться внизу, уходить от ближних мошек и плевков; если рой разрежен — бросить манок и поджечь клубок;
   иначе — бить по ближайшей мошке над собой или по Матке. */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

function snap(S, t){
  return {
    t,
    dr: S.drones.filter(d => d.state === 'live').map(d => ({ id: d.id, x: d.x, y: d.y, shell: d.shell })),
    sp: S.spores.map(b => ({ x: b.x, y: b.y, vx: b.vx, vy: b.vy })),
    q: S.queen && S.queen.alive ? { x: S.queen.x, y: S.queen.y, warn: S.queen.warn > 0 } : null,
    lure: S.lure ? { x: S.lure.x, y: S.lure.y, state: S.lure.state, t: S.lure.t } : null,
    surge: !!S.surge
  };
}

/* opts: { waves=5, startWave=1, maxT=1200, maxWaveT=240, react:[0.15,0.25], aimNoise=6, decide=1/12, perfect } */
export function playRoy(R, seed, opts = {}){
  const C = R.consts, W = C.W;
  const waves = opts.waves || 5, maxT = opts.maxT || 1200, maxWaveT = opts.maxWaveT || 240;
  const brng = mulberry32(seed * 7919 + 13);
  const react = opts.perfect ? [0.05, 0.08] : (opts.react || [0.15, 0.25]);
  const aimNoise = opts.perfect ? 2 : (opts.aimNoise == null ? 6 : opts.aimNoise);
  const decide = opts.decide || 1 / 12;
  const res = { passed: 0, won: false, lost: {}, waveTime: {}, score: 0, chains: 0, bestChain: 0, stuck: 0 };
  const g = R.Game({ rng: mulberry32(seed), startWave: opts.startWave || 1, onEvent: (t, d) => {
    if (t === 'die') res.lost[S.wave] = (res.lost[S.wave] || 0) + 1;
    if (t === 'clear') { res.passed++; res.waveTime[d.wave] = S.t - waveT0; }
    if (t === 'chain') { res.chains++; res.bestChain = Math.max(res.bestChain, d.n); }
    if (t === 'wave') waveT0 = S.t;
  } });
  let waveT0 = 0;
  const S = g._S; g.start(); waveT0 = 0;
  const buf = []; let nextDecide = 0, dx = 0, dy = 0, aimX = W / 2, lag = react[0];
  const h = 1 / 60;
  let firstWave = S.wave;
  while (!S.over && S.t < maxT){
    buf.push(snap(S, S.t)); if (buf.length > 40) buf.shift();
    if (S.t >= nextDecide){
      nextDecide = S.t + decide; lag = react[0] + brng() * (react[1] - react[0]);
      let v = buf[0]; for (let i = buf.length - 1; i >= 0; i--) if (S.t - buf[i].t >= lag){ v = buf[i]; break; }
      let v0 = buf[0]; for (let i = buf.length - 1; i >= 0; i--) if (v.t - buf[i].t >= 0.1){ v0 = buf[i]; break; }
      const p = S.player, dtv = Math.max(0.05, v.t - v0.t), ahead = S.t - v.t + 0.15;
      // предсказанные позиции мошек
      const pred = v.dr.map(d => { const o = v0.dr.find(e => e.id === d.id); const vx = o ? (d.x - o.x) / dtv : 0, vy = o ? (d.y - o.y) / dtv : 0;
        return { x: d.x + vx * ahead, y: d.y + vy * ahead, vx, vy, shell: d.shell }; });
      // угрозы: мошки и плевки рядом с кораблём
      let fx = 0, fy = 0, danger = false;
      for (const d of pred){ const ex = p.x - d.x, ey = p.y - d.y, l = Math.hypot(ex, ey) || 1; if (l < 95){ const f = (95 - l) / 95; fx += ex / l * f * 2.2; fy += ey / l * f * 2.2; danger = danger || l < 70; } }
      for (const b of v.sp){ const bx = b.x + b.vx * ahead, by = b.y + b.vy * ahead, ex = p.x - bx, ey = p.y - by, l = Math.hypot(ex, ey) || 1;
        if (l < 60 && by < p.y + 10){ fx += (Math.abs(ex) < 2 ? (p.x < W / 2 ? 1 : -1) : Math.sign(ex)) * (60 - l) / 60 * 2.5; danger = true; } }
      if (v.surge || (v.q && v.q.warn)) fy += 0.6;
      // цель по x
      let tx = null, wantLure = false;
      const L = v.lure;
      if (L){
        const near = pred.filter(d => Math.hypot(d.x - L.x, d.y - L.y) < 46).length, att = pred.filter(d => Math.hypot(d.x - L.x, d.y - L.y) < C.LURE_BURST * 3).length;
        if (L.state === 'hover' && (near >= Math.min(7, Math.max(2, att * 0.6)) || L.t > 2.2)) tx = L.x;
      }
      if (tx == null){
        const free = pred.filter(d => d.y < p.y - 40);
        if (!L && p.lureCd <= 0 && free.length >= 5) wantLure = true;
        if (L && L.state !== 'hover'){ tx = p.x; }
        else if (free.length){ free.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x)); tx = free[0].x; }
        else if (v.q) tx = v.q.x;
      }
      if (tx != null && tx !== aimX) aimX = tx + (brng() * 2 - 1) * aimNoise;
      dx = tx == null ? 0 : clamp((aimX - p.x) / 22, -1, 1);
      const ty = 585; dy = clamp((ty - p.y) / 30, -1, 1);
      if (danger || Math.hypot(fx, fy) > 0.3){ dx = clamp(dx * 0.3 + fx, -1, 1); dy = clamp(dy * 0.3 + fy, -1, 1); if (p.y > 596 && dy > 0) dy = 0; if (Math.abs(dx) < 0.2 && danger) dx = p.x < W / 2 ? 1 : -1; }
      g.setDir(dx, dy);
      if (wantLure) g.lure();
      if (tx != null && Math.abs(aimX - p.x) < 9) g.fire();
    }
    g.update(h);
    if (S.wave !== firstWave){ firstWave = S.wave; }
    if (S.t - waveT0 > maxWaveT && !S.over){ res.stuck = S.wave; break; }
    if (S.wave - (opts.startWave || 1) + 1 > waves) break;
    if (res.passed >= waves) break;
  }
  res.won = res.passed >= waves; res.score = S.score;
  return res;
}
function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
