/* ПОДРЯД · tests/bot.mjs — «человеческий» бот: летает как игрок и покупает в ангаре по простой стратегии.
   Полёт (playMission) — только через api игрока (setInput dx/dy, bomb, cell) с человеческими ограничениями:
   - реакция: решение раз в 150–250 мс (opts.react), между решениями держит прежние клавиши;
   - будущее пуль и врагов предсказывает по прямой с ошибкой оценки ±opts.noise (8) px и ±15% скорости;
   - иногда отвлекается: с вероятностью opts.lapse (10%) пропускает решение;
   - внимание ограничено: следит лишь за opts.attn (7) ближайшими угрозами, пули моложе задержки реакции «не замечает»;
   - мега-бомбу жмёт, когда броня низкая и вокруг тесно (и не всегда), ячейку щита — когда щит пуст.
   Ангар (shop) — простая стратегия: сперва ремонт, потом список желаний по порядку, пока хватает денег
   (держит запас ◈300 на ремонт).
   playCampaign(PD, seed, opts) — кампания: ангар → задание → итог; при гибели повторяет задание (до opts.tries раз). */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const WISH = ['g:rivet', 'x:mega', 'm:turret', 'g:rivet', 'x:gen', 'x:mega', 'g:rivet', 'm:homer', 'x:cell', 'g:fan', 'g:fan', 'x:gen', 'g:rivet', 'g:fan', 'g:hammer', 'x:gen', 'g:fan', 'g:rivet'];

export function shop(PD, c){
  const E = PD.Eco, D = PD.DATA, log = [];
  if (c.armor < D.ARMOR_MAX && E.canBuy(c, 'repair')) log.push(['repair', E.buy(c, 'repair')]);
  // список желаний: каждый пункт — «ещё одна покупка этого», считаем, сколько уже есть
  const have = {};
  for (const id of WISH){
    have[id] = (have[id] || 0) + 1;
    const r = E.row(id); let cnt;
    if (r.kind === 'gun') cnt = c.guns[r.key] || 0; else if (r.kind === 'mod') cnt = c.mods.filter(m => m === r.key).length;
    else if (r.kind === 'gen') cnt = c.gen; else if (r.kind === 'mega') cnt = c.mega; else if (r.kind === 'cell') cnt = c.cells; else cnt = 0;
    if (r.kind === 'gun' && r.key === 'rivet') cnt -= 1;  // клепальник выдан даром, «желание» — ступени
    if (cnt >= have[id]) continue;
    const p = E.price(c, id); if (p == null) continue;
    if (c.money - p < 300) break;                         // запас на ремонт
    log.push([id, E.buy(c, id)]);
  }
  // взял новое орудие — летит с лучшим из имеющихся по «весу»
  const pref = ['arc', 'hammer', 'fan', 'rivet'].filter(k => c.guns[k]);
  const lvl = k => (c.guns[k] || 0) + (k === 'fan' ? 0.5 : k === 'hammer' ? 1 : k === 'arc' ? 2 : 0);
  c.gun = pref.sort((a, b) => lvl(b) - lvl(a))[0];
  return log;
}

export function playMission(PD, c, seed, opts = {}){
  const L = PD.logic, K = L.K, brng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const noise = opts.noise == null ? 8 : opts.noise, lapse = opts.lapse == null ? 0.1 : opts.lapse, attn = opts.attn || 7;
  const si = Math.floor(c.mi / 3), mj = c.mi % 3;
  const game = PD.Game({ load: c, diff: c.diff, si, mj, rng: mulberry32(seed) }).start();
  const S = game.state(), P = S.P, dt = K.STEP;
  let wait = 0, held = { dx: 0, dy: 0 };
  const DIRS = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function target(){
    let tx = P.x, best = 1e9;
    if (S.boss && !S.boss.dead && S.boss.y > 0) return [S.boss.x, 560];
    for (const e of S.E) if (e.on && e.t >= 0 && e.y > -20 && e.y < 420){ const d = Math.abs(e.x - P.x) + (420 - e.y) * 0.3; if (d < best){ best = d; tx = e.x; } }
    if (best > 1e8) for (const g of S.G) if (g.hp > 0 && g.y > 0 && g.y < 500){ const d = Math.abs(g.x - P.x) + (500 - g.y) * 0.2; if (d < best){ best = d; tx = g.x; } }
    if (best > 1e8) for (const it of S.items){ const d = Math.abs(it.x - P.x); if (d < best){ best = d; tx = it.x; } }
    return [tx, 560];
  }
  function decide(lag){
    const near = [];
    for (const q of S.eb){ if ((q.t || 0) >= lag && Math.hypot(q.x - P.x, q.y - P.y) < 170) near.push([q.x + (brng() - 0.5) * 2 * noise, q.y + (brng() - 0.5) * 2 * noise, q.vx * (1 + (brng() - 0.5) * 0.3), q.vy * (1 + (brng() - 0.5) * 0.3), q.r]); }
    for (const e of S.E){ if (e.on && e.t >= 0 && Math.hypot(e.x - P.x, e.y - P.y) < 220){ const vy = e.form === 'dive' && e.st === 2 ? 330 : e.vy || 100; near.push([e.x, e.y, e.vx || 0, vy, e.r]); } }
    if (S.boss && !S.boss.dead) near.push([S.boss.x, S.boss.y, 0, 0, S.boss.r * 0.8]);
    // внимание: человек следит лишь за несколькими ближайшими угрозами
    near.sort((a, b) => Math.hypot(a[0] - P.x, a[1] - P.y) - Math.hypot(b[0] - P.x, b[1] - P.y)); near.length = Math.min(near.length, attn);
    const [tx, ty] = target(), H = lag + 0.3;
    let best = DIRS[0], bs = Infinity;
    for (const [ddx, ddy] of DIRS){
      const l = Math.hypot(ddx, ddy) || 1, vx = ddx / l * K.SPD, vy = ddy / l * K.SPD;
      let danger = 0, x = P.x, y = P.y;
      for (let st = 1; st * 0.05 <= H; st++){
        const tt = st * 0.05, mt = Math.min(tt, lag);
        x = Math.max(16, Math.min(K.FW - 16, P.x + vx * mt)); y = Math.max(40, Math.min(K.FH - 24, P.y + vy * mt));
        for (const [bx, by, bvx, bvy, br] of near){
          const dx = bx + bvx * tt - x, dy = by + bvy * tt - y, rr = br + K.PR + 4;
          const d2 = dx * dx + dy * dy; if (d2 < rr * rr) danger += tt < 0.3 ? 300 : 100; else if (d2 < (rr + 14) * (rr + 14)) danger += 6;
        }
      }
      const fx = Math.max(16, Math.min(K.FW - 16, P.x + vx * lag)), fy = Math.max(40, Math.min(K.FH - 24, P.y + vy * lag));
      const sc = danger + Math.abs(fx - tx) * 0.35 + Math.abs(fy - ty) * 0.08;
      if (sc < bs){ bs = sc; best = [ddx, ddy]; }
    }
    held = { dx: best[0], dy: best[1] };
    // мега-бомба/ячейка
    const crowd = S.eb.filter(q => Math.hypot(q.x - P.x, q.y - P.y) < 110).length;
    if (P.armor < 40 && crowd >= 4 && brng() < 0.6) game.bomb();
    else if (S.boss && !S.boss.mid && S.boss.y > 0 && P.mega > 1 && brng() < 0.04) game.bomb();
    if (P.shield < 5 && P.cells > 0 && brng() < 0.5) game.cell();
  }
  const maxT = opts.maxT || 200;
  let lag = r0;
  for (let f = 0; f < maxT * 60 && S.phase !== 'done' && S.phase !== 'fail'; f++){
    wait -= dt;
    if (wait <= 0){ lag = r0 + brng() * (r1 - r0); wait = lag; if (brng() >= lapse) decide(lag); }
    game.setInput(held.dx, held.dy); game.tick(dt);
  }
  return Object.assign(game.result(), { t: S.t, phase: S.phase, si, mj, armorLeft: P.armor });
}

export function playCampaign(PD, seed, opts = {}){
  const c = PD.Eco.create(opts.diff || 'normal'), missions = opts.missions || 9, tries = opts.tries || 3;
  const res = { seed, cleared: 0, deaths: 0, firstTry: [], money: [], spent: 0, earned: [], lost: [], fails: 0, stuck: false };
  let attempt = 0;
  while (c.mi < missions){
    const log = shop(PD, c); res.spent += log.reduce((a, x) => a + x[1], 0);
    const mi = c.mi, r = playMission(PD, c, seed * 100 + mi * 7 + attempt, opts);
    const fin = PD.Eco.finishMission(c, r);
    if (c.money < 0) throw new Error('минус в казне');
    res.money.push(c.money); (res.arm=res.arm||[]).push(Math.round(r.armorLeft));
    if (fin.ok){ res.cleared++; res.earned.push(r.money); res.firstTry.push(attempt === 0); attempt = 0; }
    else { res.deaths++; res.lost.push(fin.lost && fin.lost.id); attempt++; if (attempt >= tries){ res.stuck = true; break; } }
  }
  res.camp = c;
  return res;
}
