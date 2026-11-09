(async () => {
  const res = [];
  for (let l = 0; l < EX.levelCount(); l++) {
    for (let sc = 0; sc < EX.screenCount(l); sc++) {
      EX.prepareShot('play', { level: l, screen: sc });
      const S = EX.state;
      S.mode = 'play';
      S.player.invuln = 1e6;
      S.player.laser = 100;
      S.player.rockets = 6;
      const startLevel = S.level, startScreen = S.screen;
      EX.input.right = true; EX.input.left = false; EX.input.fire = false;
      let best = S.player.x, stuck = 0, passed = false, frames = 0, mode = 'play';
      for (let i = 0; i < 2400; i++) {
        EX.input.up = (i % 30) < 5;
        EX.input.fire = (i % 16) < 2;
        EX.stepFixed(1 / 60);
        frames++;
        mode = S.mode;
        if (S.level !== startLevel || S.screen !== startScreen) { passed = true; break; }
        if (mode !== 'play') { passed = (mode !== 'dead'); break; }
        if (S.player.x > best + 1) { best = S.player.x; stuck = 0; } else stuck++;
        if (stuck > 210) break;
      }
      EX.input.right = false; EX.input.up = false; EX.input.fire = false;
      res.push({ lvl: l + 1, scr: sc + 1, passed: passed, mode: mode, finalX: Math.round(S.player.x), finalY: Math.round(S.player.y), best: Math.round(best), f: frames });
    }
  }
  EX.prepareShot('title');
  const fails = res.filter((r) => !r.passed);
  return JSON.stringify({ total: res.length, failed: fails.length, fails: fails, all: res });
})()
