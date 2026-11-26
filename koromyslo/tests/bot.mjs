/* КОРОМЫСЛО · «человеческий» бот для баланса (Node). Видит поле как игрок (state()), жмёт только setCursor/drop.
   Человечность: думает 0,6–1,6 с на ход (+0,07 с на каждую гирьку на коромысле); при фитиле торопится (успевает к 50–110 % фитиля — иногда не успевает, и гирька падает
   туда, где палец); оценивает ходы с разбросом (noise) и в 4 % ходов промахивается на соседнюю чашу; смотрит только на текущую гирьку. */
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function playKoromyslo(K, seed, o = {}) {
  const L = K.logic, br = mulberry32(seed * 7919 + 13), dt = 1 / 30;
  const res = { seed, time: 0, score: 0, level: 1, clears: 0, tips: 0, drops: 0, fuseDrops: 0, lostAt: [], levelAt: {}, maxCombo: 0 };
  const game = K.Game({ rng: mulberry32(seed), tutorial: !!o.tutorial, onEvent: (t, d) => {
    if (t === 'tip') res.lostAt.push(game.state().level);
    if (t === 'fuse') res.fuseDrops++;
    if (t === 'level') res.levelAt[d.level] = +game.state().time.toFixed(1);
  } }).start();
  const S = game.state(); let wait = -1, plan = -1;
  const noise = o.noise != null ? o.noise : 24, slip = o.slip != null ? o.slip : 0.04, cap = o.cap || 900;
  while (!S.over && S.time < cap) {
    if (S.phase === 'aim' && S.cur) {
      if (wait < 0) {
        let think = 0.6 + br() * 1.0 + 0.07 * S.pans.reduce((n, p) => n + p.length, 0);   // полное поле — думает дольше
        if (S.fuseMax > 0) think = Math.min(think, S.fuse * (0.5 + br() * 0.6));
        wait = think; plan = S.tut >= 0 && S.hint >= 0 ? S.hint : L.bestMove(S.pans, S.cur.v, { noise, rng: br, limit: game.params().limit });
        if (plan >= 0 && br() < slip) plan = Math.max(0, Math.min(7, plan + (br() < 0.5 ? -1 : 1)));
      }
      wait -= dt;
      if (wait <= 0) { game.setCursor(plan); if (!game.drop(plan)) { const alt = L.bestMove(S.pans, S.cur.v, { limit: game.params().limit }); if (alt >= 0) game.drop(alt); } wait = -1; }
    } else wait = -1;
    game.update(dt);
  }
  Object.assign(res, { time: +S.time.toFixed(1), score: S.score, level: S.level, clears: S.clears, tips: S.tips, drops: S.drops, maxCombo: S.maxCombo, capped: !S.over });
  return res;
}
