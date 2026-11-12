(async () => {
  const res = [];
  for (let l = 0; l < PR.levelCount(); l++) {
    for (let sc = 0; sc < PR.screenCount(l); sc++) {
      PR.prepareShot('play', { level: l, screen: sc });
      const S = PR.state;
      S.mode = 'play';
      S.player.invuln = 1e6;
      S.player.laser = 100;
      S.player.rockets = 6;
      const startLevel = S.level, startScreen = S.screen;
      PR.input.right = true; PR.input.left = false; PR.input.fire = false;
      let best = S.player.x, stuck = 0, passed = false, frames = 0, mode = 'play';
      for (let i = 0; i < 2400; i++) {
        PR.input.up = (i % 30) < 5;
        PR.input.fire = (i % 16) < 2;
        PR.stepFixed(1 / 60);
        frames++;
        mode = S.mode;
        if (S.level !== startLevel || S.screen !== startScreen) { passed = true; break; }
        if (mode !== 'play') { passed = (mode !== 'dead'); break; }
        if (S.player.x > best + 1) { best = S.player.x; stuck = 0; } else stuck++;
        if (stuck > 210) break;
      }
      PR.input.right = false; PR.input.up = false; PR.input.fire = false;
      res.push({ lvl: l + 1, scr: sc + 1, passed: passed, mode: mode, finalX: Math.round(S.player.x), finalY: Math.round(S.player.y), best: Math.round(best), f: frames });
    }
  }
  PR.prepareShot('title');
  const fails = res.filter((r) => !r.passed);
  return JSON.stringify({ total: res.length, failed: fails.length, fails: fails, all: res });
})()
