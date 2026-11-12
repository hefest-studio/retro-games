#!/usr/bin/env node
/* Автотест движка без браузера: vm + фейковый window. */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sandbox = { window: {}, console, Math, Date, setTimeout, clearTimeout, performance };
const context = vm.createContext(sandbox);

vm.runInContext(readFileSync(join(ROOT, 'tools/dev-level.js'), 'utf8'), context);
vm.runInContext(readFileSync(join(ROOT, 'js/game.js'), 'utf8'), context);

const SAGA2 = sandbox.window.SAGA2;
let pass = 0;
let fail = 0;
const results = [];

function check(name, condition, extra) {
  if (condition) { pass++; results.push('PASS ' + name); }
  else { fail++; results.push('FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

function makeGame() {
  const events = [];
  const game = new SAGA2.Game({
    levels: SAGA2.LEVELS,
    onEvent: (ev) => events.push(ev),
    onLevelComplete: (stats) => { game.__stats = stats; }
  });
  const input = {
    left: false, right: false, up: false, down: false,
    jump: false, action: false, special: false, hook: false
  };
  game.setInput(input);
  game.loadLevel(0);
  return { game, input, events };
}

function step(game, n) {
  for (let i = 0; i < n; i++) game.update(1 / 60);
}
function press(game, input, name) {
  input[name] = false;
  game.update(1 / 60);
  input[name] = true;
  game.update(1 / 60);
  input[name] = false;
  game.update(1 / 60);
}
function actor(game, id) {
  return game.actors.find((a) => a.id === id);
}

/* 1. базовое приземление */
{
  const { game } = makeGame();
  step(game, 60);
  const ok = game.actors.every((a) => Math.abs(a.y - 512) < 1 && Number.isFinite(a.x)) && game.actors.some((a) => a.onGround);
  check('спавн на полу, физика конечна', ok, game.actors.map((a) => a.id + ':y=' + a.y).join(' '));
}
/* 2. прыжок Снорри */
{
  const { game, input } = makeGame();
  step(game, 20);
  const snorri = actor(game, 'snorri');
  input.jump = true;
  let minY = snorri.y;
  for (let i = 0; i < 60; i++) {
    game.update(1 / 60);
    minY = Math.min(minY, snorri.y);
    if (i === 8) input.jump = false;
  }
  check('прыжок Снорри поднимает минимум на 70px', minY < 512 - 70, 'minY=' + minY);
  check('после прыжка снова на земле', snorri.onGround && Math.abs(snorri.y - 512) < 1, 'y=' + snorri.y);
}
/* 3. таран ломает лёд */
{
  const { game, input } = makeGame();
  step(game, 10);
  game.debugTeleport('snorri', 6, 15);
  step(game, 5);
  const snorri = actor(game, 'snorri');
  snorri.dir = 1;
  press(game, input, 'action');
  step(game, 4);
  const broken = game.getTile(8, 14) === '.' || game.getTile(8, 15) === '.';
  check('таран ломает лёд', broken, 'tile14=' + game.getTile(8, 14) + ' tile15=' + game.getTile(8, 15));
}
/* 4. плита открывает дверь */
{
  const { game } = makeGame();
  step(game, 5);
  game.debugTeleport('snorri', 18, 15);
  step(game, 90);
  const door = game.doors.find((d) => d.group === 'a');
  check('плита открывает дверь группы a', door.open > 0.7, 'open=' + door.open.toFixed(2) + ' plate=' + game.plates[0].pressed);
}
/* 5. стрела Гуннара переключает рычаг */
{
  const { game, input } = makeGame();
  step(game, 5);
  game.switchTo('gunnar');
  game.debugTeleport('gunnar', 20, 15);
  step(game, 10);
  press(game, input, 'special');
  step(game, 40);
  const lever = game.levers.find((l) => l.group === 'b');
  check('стрела переключает рычаг', lever && lever.on === true, 'on=' + (lever ? lever.on : 'no lever'));
}
/* 6. крюк подтягивает Гуннара вверх */
{
  const { game, input } = makeGame();
  step(game, 5);
  game.switchTo('gunnar');
  game.debugTeleport('gunnar', 24, 15);
  step(game, 5);
  const gunnar = actor(game, 'gunnar');
  input.up = true;
  press(game, input, 'hook');
  input.up = false;
  let minY = gunnar.y;
  for (let i = 0; i < 120; i++) {
    game.update(1 / 60);
    minY = Math.min(minY, gunnar.y);
  }
  check('крюк поднимает Гуннара', minY < 500 && Number.isFinite(gunnar.y), 'minY=' + minY.toFixed(1));
}
/* 7. щит Бьорна — платформа для Снорри */
{
  const { game, input } = makeGame();
  step(game, 5);
  game.switchTo('bjorn');
  game.debugTeleport('bjorn', 10, 15);
  step(game, 5);
  input.action = true;
  step(game, 4);
  game.switchTo('snorri');
  game.debugTeleport('snorri', 10, 12);
  step(game, 60);
  const snorri = actor(game, 'snorri');
  const bjorn = actor(game, 'bjorn');
  const top = bjorn.y - bjorn.h - 6;
  check('Снорри встаёт на щит Бьорна', snorri.onBjorn && Math.abs(snorri.y - top) < 3, 'snorriY=' + snorri.y + ' top=' + top + ' onBjorn=' + snorri.onBjorn);
}
/* 8. чекпоинт */
{
  const { game } = makeGame();
  step(game, 5);
  game.debugTeleport('snorri', 10, 15);
  step(game, 15);
  check('чекпоинт активируется', game.checkpoints[0].active === true);
}
/* 9. лава убивает и респавн */
{
  const { game } = makeGame();
  step(game, 5);
  game.debugTeleport('snorri', 13, 16);
  step(game, 10);
  const snorri = actor(game, 'snorri');
  check('лава убивает', game.deaths >= 1 && snorri.dead === true, 'deaths=' + game.deaths + ' dead=' + snorri.dead);
  step(game, 100);
  check('респавн после смерти', snorri.dead === false && snorri.hp === snorri.maxHp, 'hp=' + snorri.hp + ' dead=' + snorri.dead);
}
/* 10. руна и финиш */
{
  const { game } = makeGame();
  step(game, 5);
  game.debugTeleport('snorri', 3, 13);
  step(game, 20);
  check('руна подбирается', game.levelRunes >= 1, 'runes=' + game.levelRunes);
  game.debugWinLevel();
  check('уровень завершается', game.completed === true && game.__stats && game.__stats.runes >= 1,
    'completed=' + game.completed + ' stats=' + JSON.stringify(game.__stats || null));
}
/* 11. все акторы конечны */
{
  const { game } = makeGame();
  step(game, 240);
  const finite = game.actors.every((a) => Number.isFinite(a.x) && Number.isFinite(a.y));
  check('координаты не NaN после 4 секунд', finite, game.actors.map((a) => a.x + ',' + a.y).join(' | '));
}

console.log(results.join('\n'));
console.log('\n' + (fail === 0 ? 'OK' : 'FAILED') + ': ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
