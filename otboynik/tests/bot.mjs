/* ОТБОЙНИК · tests/bot.mjs — «человеческий» бот для проверки баланса и проходимости (по образцу otsek/tests/bot.mjs).
   Без читов: управляет только как игрок — setFlip(side, on), launch(), tilt(), а между волнами — moveSel/confirm
   (выбор карты и места стрелками). Видит то же, что игрок на экране: шар, механизмы, здания.
   - решения раз в 150–250 мс (реакция); между решениями держит прежние клавиши;
   - траекторию шара «прикидывает на глаз»: только полёт с уклоном стола на одно решение вперёд, без отскоков;
   - иногда зевает: с вероятностью opts.miss (0.12) не реагирует на шар у флиппера;
   - флиппер держит, пока шар в зоне удара, и отпускает, если шар улёгся на поднятый флиппер (чтобы ударить снова);
   - механизм у ворот добивает взмахом флиппера; шар без движения — встряска (не чаще раза в 2 с, тилт не ловит);
   - карты: сначала здания (горн, колокольня, делитель…), при слабых воротах — ремонт.
   opts: { startWave=1, waves=Infinity (сколько волн сыграть), miss=0.12, react:[0.15,0.25], maxT=1500 } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const PREF = { forge: 6, bell: 7, splitter: 5, spring: 4, magnet: 3, flip: 2, repair: 1 };
const SLOT_ORDER = [4, 1, 3, 5, 0, 2];

export function playOtboynik(G, seed, opts = {}){
  const L = G.logic, brng = mulberry32(seed * 7919 + 17);
  const [r0, r1] = opts.react || [0.15, 0.25];
  const miss = opts.miss != null ? opts.miss : 0.12;
  const ev = { kills: 0, gate: 0, drains: 0, tilts: 0, locks: 0, cleared: [], cards: [] };
  const game = G.Game({ rng: mulberry32(seed), seed, startWave: opts.startWave || 1, pool: opts.pool, starter: opts.starter,
    onEvent: (t, d) => {
      if (t === 'kill') ev.kills++; else if (t === 'gate') ev.gate += d.dmg; else if (t === 'drain') ev.drains++;
      else if (t === 'tilt') ev.tilts++; else if (t === 'tiltLock') ev.locks++;
      else if (t === 'waveClear') ev.cleared.push(d.wave); else if (t === 'card') ev.cards.push(d.id + d.lvl);
    } }).start();
  const S = game.state(), dt = 1 / 60, maxT = opts.maxT || 1500, lastWave = (opts.startWave || 1) + (opts.waves || 1e9) - 1;
  let tm = 0, next = 0, lastTilt = -9, hold = { L: false, R: false };

  function zone(side, x, y){   // зона удара: рядом с флиппером в покое и выше его оси
    const f = L.FLIP[side], tipx = f.x + Math.cos(f.rest) * L.FL_LEN, tipy = f.y + Math.sin(f.rest) * L.FL_LEN;
    const q = L.closest(f.x, f.y, tipx, tipy, x, y), d = Math.hypot(x - q[0], y - q[1]);
    return d < 34 && y < q[1] + 6 && y > f.y - 70;
  }
  function willHit(side, b, horizon){
    let x = b.x, y = b.y, vx = b.vx, vy = b.vy;
    for (let t = 0; t <= horizon; t += 1 / 120){ if (zone(side, x, y)) return true; vy += L.GRAV / 120; x += vx / 120; y += vy / 120; if (y > L.DRAIN_Y) break; }
    return false;
  }
  function decide(horizon){
    if (S.phase === 'cards'){
      let best = 0, bv = -1;
      S.offer.forEach((c, i) => { let v = PREF[c.id] + (c.kind === 'build' ? 3 : 0) + (c.id === 'repair' && S.hp < 10 ? 20 : 0); if (v > bv){ bv = v; best = i; } });
      if (S.sel !== best) game.moveSel(best > S.sel ? 1 : -1); else game.confirm();
      return;
    }
    if (S.phase === 'slot'){
      const want = SLOT_ORDER.find(i => game.freeSlots().includes(i));
      if (S.slotSel !== want) game.moveSel(1); else game.confirm();
      return;
    }
    if (S.phase !== 'wave') return;
    if (game.waiting()) game.launch();
    for (const side of ['L', 'R']){
      const f = S.flip[side];
      let want = false;
      for (const b of S.balls){
        if (b.x > L.LANE_X) continue;
        if (brng() < miss) continue;
        const resting = zone(side, b.x, b.y) && Math.hypot(b.vx, b.vy) < 90 && f.on;
        if (resting){ want = false; break; }     // улёгся на поднятый флиппер — отпустить, следующим решением — удар
        if (willHit(side, b, horizon)) want = true;
      }
      // механизм в проходе к воротам — взмах
      if (!want && S.enemies.some(e => e.y > 600 && Math.hypot(e.x - (side === 'L' ? 205 : 275), e.y - 680) < 40) && brng() > miss) want = true;
      hold[side] = want;
    }
    const still = S.balls.find(b => b.x < L.LANE_X && Math.hypot(b.vx, b.vy) < 25 && b.y < 600);
    if (still && tm - lastTilt > 2 && S.tiltMeter < 1.5){ game.tilt(); lastTilt = tm; }
  }
  for (;;){
    tm += dt;
    if (S.phase === 'over' || S.phase === 'won') break;
    if (S.wave > lastWave && S.phase !== 'wave') break;
    if (tm > maxT) break;
    next -= dt;
    if (next <= 0){ const iv = r0 + brng() * (r1 - r0); next = iv; decide(iv + 0.05); }
    game.setFlip('L', hold.L); game.setFlip('R', hold.R);
    game.update(dt);
  }
  return { seed, won: S.phase === 'won', over: S.phase === 'over', passed: ev.cleared.length, wave: S.wave, hp: S.hp, score: S.score,
    kills: ev.kills, gate: ev.gate, drains: ev.drains, tilts: ev.tilts, locks: ev.locks, cards: ev.cards, time: tm, stuck: tm > maxT };
}
