/* ЮЗ · tests/bot.mjs — «человеческий» бот-игрок для проверки баланса.
   Без читов: видит то же, что на экране (трасса, покрытия, бонусы, соперники), и жмёт те же клавиши,
   что и человек, — руль влево/вправо/прямо, газ, тормоз (цифровые, без «полруля»).
   Человеческие ограничения:
   - решает не каждый кадр, а раз в `react` (0.09–0.15 с) — между решениями держит клавиши;
   - руль цифровой: мёртвая зона `dead` — мелкие поправки пропускает;
   - иногда ошибается (`blunder`): прозевал торможение / перекрутил руль на одно решение;
   - темп `pace` — насколько смело едет относительно «идеальной» скорости в повороте.
   opts: { players=1, tracks=8, react:[0.09,0.15], dead=0.3, blunder=0.06, pace=0.95, care=0.8 } */

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

export function makeHuman(Y, game, pi, rng, opts = {}){
  const L = Y.logic, S = game.state();
  const [r0, r1] = opts.react || [0.09, 0.15];
  const dead = opts.dead == null ? 0.3 : opts.dead;
  const blunder = opts.blunder == null ? 0.06 : opts.blunder;
  const prof = { pace: opts.pace == null ? 0.95 : opts.pace, care: opts.care == null ? 0.8 : opts.care, lane: 0, look: 1, own: true };
  let next = 0, hold = { steer: 0, gas: 0, brake: 0, drift: 0 }, mem = {};
  return function step(t){
    const car = S.cars.filter(c => c.human && c.pi === pi)[0];
    if (!car || car.out || car.finished) return;
    if (t >= next){
      next = t + r0 + rng() * (r1 - r0);
      if (S.phase === 'race'){
        // сам ИИ «видит» трассу; человек нажимает цифровые клавиши
        const a = L.drive(S, car, prof, mem);
        let steer = a.steer > dead ? 1 : a.steer < -dead ? -1 : 0;
        let gas = a.gas, brake = a.brake;
        if (rng() < blunder){ if (rng() < 0.5){ brake = 0; gas = 1; } else steer = steer || (rng() < 0.5 ? 1 : -1); }
        hold = { steer, gas, brake, drift: 0 };
      } else hold = { steer: 0, gas: 0, brake: 0, drift: 0 };
    }
    game.setInput(pi, hold);
  };
}

// Чемпионат целиком: возвращает места по трассам и итог. opts — см. выше + { tracks, seed }
export function playYuz(Y, seed, opts = {}){
  const rng = mulberry32(seed), players = opts.players || 1;
  const ev = [];
  const game = Y.Game({ players, rng, tracks: opts.tracks || 8, onEvent: (t, d) => ev.push([t, d]) }).start();
  const S = game.state(), dt = 1 / 60;
  const brains = []; for (let i = 0; i < players; i++) brains.push(makeHuman(Y, game, i, mulberry32(seed * 7 + i), opts));
  const places = []; let t = 0, guard = 0, stuck = false;
  while (!S.over && guard++ < 60 * 60 * 30){
    for (const b of brains) b(t);
    game.update(dt); t += dt;
    if (S.phase === 'results'){
      const best = Math.min(...S.results.filter(r => r.human).map(r => r.place));
      places.push(best);
      game.next();
    }
    if (S.raceT > 280) stuck = true;
  }
  return { places, place: S.place, won: S.won, stuck, events: ev, S };
}
