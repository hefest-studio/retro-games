/* ТАРАН · tests/bot.mjs — «человеческий» бот-игрок для проверки баланса и проходимости.
   Без читов: управляет только как игрок — game.setInput(pi, {left,right,up,down,fire,rocket,drop,nitro}) (клавиши вкл/выкл).
   Модель человека:
   - «видит» мир с запаздыванием: положение вагонеток, фазы прессов, сброшенные масло и гайки — снимок 150–250 мс назад
     (реакция пересэмплируется на каждом взгляде);
   - клавиши обновляет 20 раз в секунду (руль — «на глаз», с мёртвой зоной), в «аркадном» управлении жмёт стрелки 8 сторон;
   - замечает сброшенное соперником не всегда (opts.miss, по умолчанию 25 %), иногда «зевает» — на 0.4 с отпускает газ;
   - решение «куда ехать» — тот же водитель, что у ИИ (game.drive), но с запаздывающей картиной мира.
   opts: { track=0, players=1, control='tank', react:[0.15,0.25], miss=0.25, lapse=0.04, league=0, cfg, rivals, maxT=400, laps } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

const OCT = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export function playRace(T, seed, opts = {}){
  const L = T.logic, brng = mulberry32(seed * 7919 + 13);
  const [r0, r1] = opts.react || [0.15, 0.25], miss = opts.miss != null ? opts.miss : 0.25, lapseP = opts.lapse != null ? opts.lapse : 0.04;
  const players = opts.players || 1, control = opts.control || 'tank', league = opts.league || 0;
  const ev = { wrecks: 0, kills: 0, cuts: 0, unstuck: 0, events: {} };
  const humans = opts.humans || [opts.cfg || L.defCfg(), opts.cfg || L.defCfg()];
  const rivals = opts.rivals !== undefined ? opts.rivals : L.RIVALS.map((r, i) => ({ ch: i, cfg: L.rivalCfg(league, i) }));
  const game = T.Game({ track: opts.track || 0, players, humans, rivals, pace: L.PACE[league], control, laps: opts.laps, mode: opts.mode, team: opts.team,
    rng: mulberry32(seed), onEvent: (t, d) => {
      ev.events[t] = (ev.events[t] || 0) + 1;
      if (t === 'cut') ev.cuts++;
      if (t === 'unstuck') ev.unstuck++;
    } }).start();
  const S = game.state(), dt = 1 / 60;
  // история «картин мира» для запаздывающего восприятия
  const hist = [];
  const snap = () => ({ t: S.t, carts: S.carts.map(c => ({ ...c })), drops: S.drops.map(d => ({ ...d })) });
  const bots = [];
  for (let pi = 0; pi < players; pi++) bots.push({ pi, next: 0, react: r0, keys: {}, lapseT: 0, seen: new WeakSet(), ignored: new WeakSet(), side: brng() < 0.5 ? -1 : 1 });
  let t = 0;
  const maxT = opts.maxT || 400;
  while (S.phase !== 'done' && t < maxT){
    hist.push(snap()); if (hist.length > 40) hist.shift();
    for (const b of bots){
      const car = game.humanCar(b.pi);
      if (!car || car.out || car.finished) { game.setInput(b.pi, {}); continue; }
      if (t >= b.next){
        b.next = t + 0.05;
        if (brng() < 0.25) b.react = r0 + brng() * (r1 - r0);
        const lag = Math.round(b.react / dt), V = hist[Math.max(0, hist.length - 1 - lag)];
        // сброшенное соперником замечаем не всегда
        const drops = V.drops.filter(d => {
          const real = S.drops.find(x => x.x === d.x && x.y === d.y);
          if (!real) return false;
          if (b.ignored.has(real)) return false;
          if (!b.seen.has(real)){ b.seen.add(real); if (brng() < miss) { b.ignored.add(real); return false; } }
          return true;
        });
        const ctl = game.drive(car, { t: V.t, carts: V.carts, drops }, { side: b.side, rand: brng, char: { aggr: 0.7, ramp: 0, drop: 0.5, lane: 0, side: 1, boost: 0.8 } });
        if (b.lapseT <= 0 && brng() < lapseP * 0.05) b.lapseT = 0.4;
        const k = { fire: !!ctl.fire, rocket: !!ctl.rocket, drop: !!ctl.drop, nitro: !!ctl.nitro };
        if (control === 'arcade'){
          // желаемый курс → ближайшая из 8 сторон стрелками
          const want = car.a + ctl.steer * 0.6, o = OCT[((Math.round(want / (Math.PI / 4)) % 8) + 8) % 8];
          if (ctl.gas > 0.3 || ctl.steer !== 0){ k.right = o[0] > 0; k.left = o[0] < 0; k.down = o[1] > 0; k.up = o[1] < 0; }
        } else {
          k.left = ctl.steer < -0.22; k.right = ctl.steer > 0.22; k.up = ctl.gas > 0.4; k.down = ctl.brake > 0.4;
        }
        if (b.lapseT > 0){ k.up = false; k.fire = false; }
        b.keys = k;
      }
      if (b.lapseT > 0) b.lapseT -= dt;
      game.setInput(b.pi, b.keys);
    }
    game.update(dt); t += dt;
  }
  const res = S.results || [];
  const me = res.filter(r => r.human >= 0);
  const aiStuck = S.cars.filter(c => c.human < 0).reduce((a, c) => a + c.unstuck, 0);
  return { seed, done: S.phase === 'done', time: t, results: res, places: me.map(r => r.place), place: me.length ? Math.min(...me.map(r => r.place)) : 0,
    finished: me.map(r => r.finished), kills: me.reduce((a, r) => a + r.kills, 0), wrecks: me.reduce((a, r) => a + r.wrecks, 0),
    cuts: ev.cuts, unstuck: ev.unstuck, aiStuck, events: ev.events, game };
}

// Чемпионат целиком: между гонками бот покупает как разумный игрок (новый корпус — если хватит с запасом,
// иначе ступени по приоритету двигатель → броня → оружие → шины). → { won, lost, races, leagues, money, total, log }
export function playChamp(T, seed, opts = {}){
  const L = T.logic, C = T.champ, ch = C.newChamp({ players: opts.players || 1, team: opts.team || 'coop' });
  const log = []; let races = 0, minMoney = Infinity, stuck = 0, cuts = 0;
  while (!ch.done && races < 80){
    for (let pi = 0; pi < ch.players; pi++){
      const car = ch.cars[pi], k = C.purse(ch, pi);
      const nb = car.body + 1;
      if (nb < L.BODIES.length && ch.money[k] >= L.BODIES[nb].price * (nb === 2 ? 1.1 : 1.35)) C.buy(ch, pi, 'body' + nb);
      // с Медной лиги копит на тяжёлый корпус, а потом докупает ступени
      const saving = ch.league >= 1 && car.body === 1 && opts.save !== false;
      let bought = !saving;
      while (bought){ bought = false; for (const u of ['engine', 'armor', 'weapon', 'tires']){ const p = C.price(ch, pi, u); if (p != null && ch.money[k] - p >= (nb < L.BODIES.length ? 0 : 0) && C.buy(ch, pi, u)){ bought = true; break; } } }
      minMoney = Math.min(minMoney, ...ch.money);
    }
    const ro = C.raceOpts(ch);
    const r = playRace(T, seed * 100 + races, { track: ro.track, players: ro.players, humans: ro.humans, rivals: ro.rivals, league: ch.league, control: opts.control, team: ro.team });
    races++; stuck += r.aiStuck; cuts += r.cuts;
    const sum = C.applyRace(ch, r.results);
    log.push(ro.track + ':' + r.places.join('/'));
    if (sum.leagueEnd) log.push(sum.qualified ? 'Q' : 'F');
    minMoney = Math.min(minMoney, ...ch.money);
  }
  return { won: ch.done === 'win', lost: ch.done === 'lose', races, league: ch.league, money: ch.money, total: ch.total, minMoney, log, stuck, cuts, champ: ch };
}
