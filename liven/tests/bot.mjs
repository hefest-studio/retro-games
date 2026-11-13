/* ЛИВЕНЬ · tests/bot.mjs — «человеческий» бот и проверка проходимости узоров.
   playLiven(LV, seed, opts) — бот управляет только как игрок (setInput dx/dy/фокус, bomb) с человеческими ограничениями:
   - реакция: решение раз в 150–250 мс (opts.react), между решениями держит прежние клавиши;
   - не видит пули моложе текущей задержки реакции (только что вылетевшие ещё «не замечены»);
   - будущее пуль предсказывает по прямой (не знает о доворотах, ускорениях и разрывах), с ошибкой оценки ±opts.noise px;
   - иногда отвлекается: с вероятностью opts.lapse (5%) пропускает решение и держит прежние клавиши;
   - разряд жмёт, только когда видит неизбежное попадание, и не всегда (opts.bombP); «последний шанс» (0,13 с) не успевает.
   opts: { diff='easy', form='fan', react:[0.15,0.25], noise=4, lapse=0.05, bombP=0.6, stages=1 (сколько этапов), maxT (с) }.
   reachCheck(LV, setup, sec) — пространственно-временной поиск: существует ли в каждый момент хоть одна позиция, куда
   челнок (хитбокс K.HB) мог добраться, не задев ни одной пули. Сетка 4 px, ход ≤ 4 px за кадр (не быстрее челнока). */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function playLiven(LV, seed, opts = {}){
  const L = LV.logic, K = L.K, brng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const noise = opts.noise == null ? 4 : opts.noise, bombP = opts.bombP == null ? 0.6 : opts.bombP, lapse = opts.lapse == null ? 0.05 : opts.lapse;
  const stages = opts.stages || 1, maxT = opts.maxT || 400 * stages;
  const res = { seed, diff: opts.diff || 'easy', cleared: 0, won: false, over: false, deaths: 0, bombs: 0, score: 0, graze: 0, time: 0, deathsAt: [] };
  const game = LV.Game({ diff: opts.diff || 'easy', form: opts.form || 'fan', rng: mulberry32(seed), maxStage: stages, onEvent: (t) => {
    if (t === 'clear') res.cleared++;
    if (t === 'die') { res.deaths++; res.deathsAt.push(S.boss.on ? (S.boss.mid ? 'mid' : 'boss') + S.boss.ci : 'wave'); }
  } }).start();
  const S = game.state(), dt = K.STEP, P = S.P, Bl = S.B;
  let wait = 0, lag = r0, held = { dx: 0, dy: 0, f: false };
  const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const near = new Float32Array(4 * 1200); // x, y, vx, vy, r — замеченные пули рядом
  const nr = new Float32Array(1200);
  function target(){ // куда хочется: под целью, в нижней трети
    let tx = K.FW / 2, ty = 500;
    if (S.boss.on && !S.boss.dead) tx = S.boss.x;
    else { let best = 1e9; for (const e of S.E) if (e.on && e.y > 0 && e.y < 400) { const d = Math.abs(e.x - P.x) + e.y * 0.2; if (d < best) { best = d; tx = e.x; } } }
    return [tx, ty];
  }
  function decide(){
    // замеченные пули в радиусе 170 px
    let m = 0;
    for (let i = 0; i < Bl.n && m < 1200; i++) {
      if (Bl.t[i] < lag) continue;
      const dx = Bl.x[i] - P.x, dy = Bl.y[i] - P.y;
      if (dx * dx + dy * dy > 170 * 170) continue;
      near[m * 4] = Bl.x[i] + (brng() - 0.5) * 2 * noise; near[m * 4 + 1] = Bl.y[i] + (brng() - 0.5) * 2 * noise;
      near[m * 4 + 2] = Bl.vx[i]; near[m * 4 + 3] = Bl.vy[i]; nr[m] = Bl.r[i]; m++;
    }
    const enemies = S.E.filter(e => e.on), [tx, ty] = target();
    const hold = lag, H = hold + 0.3;
    let best = null, bestScore = Infinity, bestHit = true;
    for (let fi = 0; fi < 2; fi++) for (const [ddx, ddy] of DIRS) {
      if (fi === 1 && !ddx && !ddy) continue;
      const focus = fi === 0 ? true : false, sp = focus ? K.SPD_F : K.SPD;
      const l = Math.hypot(ddx, ddy) || 1, vx = ddx / l * sp, vy = ddy / l * sp;
      let danger = 0, hit = false, x = P.x, y = P.y;
      for (let st = 1; st * 0.04 <= H; st++) {
        const tt = st * 0.04, mt = Math.min(tt, hold);
        x = Math.max(8, Math.min(K.FW - 8, P.x + vx * mt)); y = Math.max(14, Math.min(K.FH - 10, P.y + vy * mt));
        const wgt = tt < 0.25 ? 3 : 1;
        for (let j = 0; j < m; j++) {
          const bx = near[j * 4] + near[j * 4 + 2] * tt - x, by = near[j * 4 + 1] + near[j * 4 + 3] * tt - y, rr = nr[j] + K.HB;
          const d2 = bx * bx + by * by;
          if (d2 < (rr + 2) * (rr + 2)) { danger += 100 * wgt; if (tt < 0.35) hit = true; }
          else if (d2 < (rr + 9) * (rr + 9)) danger += 6 * wgt;
        }
        for (const e of enemies) { const ex = e.x + e.vx * tt - x, ey = e.y + e.vy * tt - y; if (ex * ex + ey * ey < (e.r + 10) * (e.r + 10)) { danger += 60; if (tt < 0.35) hit = true; } }
        if (S.boss.on) { const ex = S.boss.x - x, ey = S.boss.y - y; if (ex * ex + ey * ey < 40 * 40) danger += 60; }
      }
      const pos = Math.abs(x - tx) * 0.05 + Math.abs(y - ty) * 0.04 + (x < 30 || x > K.FW - 30 ? 3 : 0) + (focus ? 0 : 0.5);
      const sc = danger + pos + brng() * 0.5;
      if (sc < bestScore) { bestScore = sc; best = { dx: ddx, dy: ddy, f: focus }; bestHit = hit; }
    }
    if (bestHit && S.bombs > 0 && P.inv <= 0 && brng() < bombP) { if (game.bomb()) res.bombs++; }
    return best;
  }
  while (S.time < maxT && S.phase !== 'won' && S.phase !== 'over') {
    if (S.phase === 'cont') { game.giveUp(); break; }
    wait -= dt;
    if (wait <= 0) { lag = r0 + brng() * (r1 - r0); wait = lag; held = P.dead > 0 ? { dx: 0, dy: 0, f: false } : (brng() < lapse ? held : decide()); }
    game.setInput(held.dx, held.dy, held.f);
    game.tick(dt);
  }
  res.won = S.phase === 'won'; res.over = S.phase === 'over' || S.phase === 'cont'; res.score = S.score; res.graze = S.graze; res.time = +S.time.toFixed(1); res.stuck = !res.won && !res.over;
  return res;
}

// ---------- проходимость ----------
// setup(game) — подготовить ситуацию (карта/этап); челнок бессмертен (noHit) и стоит на старте, прицельные пули летят в неё.
export function reachCheck(LV, opts, setup, sec){
  const L = LV.logic, K = L.K, CS = 4, GW = Math.floor(K.FW / CS), GH = Math.floor(K.FH / CS);
  const game = LV.Game(Object.assign({ rng: mulberry32(opts.seed || 5), noHit: true, frozen: true }, opts));
  setup(game);
  const S = game.state(), Bl = S.B;
  let R = new Uint8Array(GW * GH), N = new Uint8Array(GW * GH);
  const blk = new Uint8Array(GW * GH);
  const c0 = Math.floor(K.PX0 / CS), r0 = Math.floor(K.PY0 / CS);
  // старт: челнок в нижней трети (как в игре — успела бы занять любую точку внизу до прихода пуль)
  for (let r = Math.floor(400 / CS); r < GH - 3; r++) for (let c = 2; c < GW - 2; c++) R[r * GW + c] = 1;
  R[r0 * GW + c0] = 1;
  const xmin = 2, xmax = GW - 3, ymin = 4, ymax = GH - 3;
  let minCount = Infinity, minAt = 0, frames = Math.round(sec / K.STEP), maxB = 0;
  for (let f = 0; f < frames; f++) {
    game.tick(K.STEP);
    if (Bl.n > maxB) maxB = Bl.n;
    blk.fill(0);
    for (let i = 0; i < Bl.n; i++) {
      const bx = Bl.x[i], by = Bl.y[i], rr = Bl.r[i] + K.HB;
      const ca = Math.max(0, Math.floor((bx - rr) / CS)), cb = Math.min(GW - 1, Math.floor((bx + rr) / CS));
      const ra = Math.max(0, Math.floor((by - rr) / CS)), rb = Math.min(GH - 1, Math.floor((by + rr) / CS));
      for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) {
        const cx = c * CS + CS / 2 - bx, cy = r * CS + CS / 2 - by;
        if (cx * cx + cy * cy < rr * rr) blk[r * GW + c] = 1;
      }
    }
    let cnt = 0;
    for (let r = ymin; r <= ymax; r++) for (let c = xmin; c <= xmax; c++) {
      const i = r * GW + c;
      const v = !blk[i] && (R[i] || R[i - 1] || R[i + 1] || R[i - GW] || R[i + GW]) ? 1 : 0;
      N[i] = v; cnt += v;
    }
    const tmp = R; R = N; N = tmp;
    if (f * K.STEP > 2 && cnt < minCount) { minCount = cnt; minAt = +(f * K.STEP).toFixed(2); }
    if (!cnt) return { ok: false, at: +(f * K.STEP).toFixed(2), minCount: 0, maxB };
  }
  return { ok: true, minCount, minAt, maxB };
}
