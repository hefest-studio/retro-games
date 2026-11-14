# СОСЕДИ — контракт модулей

Игра аркады «Гефест» на фреймворке Гефест Arcade v2.2 (`engine.js`). Общий стандарт: офлайн, `file://`,
без внешних URL/шрифтов/ассетов, RU/EN, темы modern/retro (меняют только отрисовку), WebAudio-звук,
рекорд в `localStorage` (`arcade.best.sosedi`), число игроков — `arcade.players.sosedi` (движок).
Права: название, герои, соседи, игрушки, боссы, районы, арт, палитры, звуки и музыка — оригинальные;
чужих имён нет (тест «правило имён» в `tests/engine.test.mjs`, стоп-лист в base64).

## js/levels.js — `SOSEDI.levels`
Карта 48×32 клетки по 16 px (`MW, MH, TS`). Коды `T`: `G` трава/пол, `W` стена/забор, `H` препятствие (поленница,
киоск, прилавок, тюк сена, ящик), `P` пруд/лужа, `D` запертая дверь, `C` стена с трещиной, `F` пол в доме,
`O` открытая дверь, `R` дорожка. `WALK[code]` — проходимость.
`build(n)` (n = 1..20) → `{ n, d (район 1..5), i (1..4), kind 'normal'|'boss', style, w, h, t: Uint8Array, start, exit,
houses[{x,y,w,h,door,locked}], doors[], keys[], neighbors[{x,y,type,inside,locked,secret?,bonus?}], spawners[], toys[{x,y,type}],
pickups[{x,y,kind}], secret{x,y,crack,in}|null, boss }`. `buildBonus(d)` — бонус-уровень (`kind 'bonus'`, 8 гостей, без выхода).
Генерация детерминирована (сид от номера); каждое препятствие ставится, только если все открытые клетки остаются связаны
со стартом (двери и трещины считаются проходимыми). Ключи — снаружи, без дверей (по ключу на запертую дверь).
Также `bfs(t,sx,sy,through)`, `connected`, `MIXES` (состав цирка по районам), `mixPick`, `mulberry32`.

## js/game.js — `SOSEDI.Game(opts)` (без DOM, детерминирована при заданном `rng`/`seed`)
`opts`: `{ rng, seed, players=1|2, level=1, pool=10, onEvent(type,data) }`.
API: `start()` → api · `update(dt)` (подшаги ≤ 1/60) · `setInput(pi, {x,y,fire})` · `swap(pi, ±1)` (пропускает пустое) ·
`select(pi, w)` · `state()` → S · `level()` → карта · `fields()` → `{n,p}` (поля расстояний к соседям/героям).
Отладка/тесты: `_load(n, bonus)`, `_spawnToy(type,x,y)`, `_killToy`, `_damageBoss`, `_hurtHero`, `_computeFields`, `_clear`, `_next`, `_portal`, `_landArc`.

`S`: `level, players, score, pool, savedTotal, lostTotal, phase('intro'|'play'|'clear'|'over'|'won'), phaseT, keys, ticket,
inBonus, bonusT, heroes[{id,x,y,fx,fy,alive,out,lives,hp,inv,w,ammo{water:-1,paint,pie,bubble,fire},cd,shoesT,shieldT,saved}],
neighbors[{id,type,x,y,state('wait'|'saved'|'lost'),grab,panic,bonus,secret,inside}], toys[{id,type,x,y,hp,max,r,sp,stun,rise,eat,tele,…}],
spawners[{x,y,hp,dead,open}], shots[{k,x,y,…}], eshots, pies, pickups[{x,y,kind}], booms, rings, lines, boss|null, exitOpen, why, levelSaved, levelLost`.

Правила:
- Герой: скорость 92 (кроссовки 140), радиус 6; 3 сердечка, 3 жизни, неуязвимость 1,6 с после удара, 2,5 с после возрождения.
  Огонь — по направлению взгляда (последнее движение). В коопе герои не расходятся дальше `VIEW_W−60 × VIEW_H−60`.
- Оружие `WEAP`: water (∞, 300 px/с, 0,45 с), paint (дуга 104 px, брызги r 26, урон 3), pie (дуга 56 px, приманка 6 с, тянет игрушки
  в радиусе 140), bubble (125 px/с; мелких ловит, крупных оглушает 2,5 с), fire (дуга 72 px, взрыв r 56, урон 3, отброс, ломает `C`).
- Игрушки `TY`: clown, goose, mouse, bear (замах и волна-барабан r 54), top (по прямой с отскоком), puppet (над `H`/`P`).
  Погоня — по BFS-полям: к соседу, если он ближе `SMELL` клеток по пути; к герою — вблизи; иначе бродят.
  Касание соседа — хват; через `GRAB` с непрерывного хвата сосед утащен (`pool−1`, кроме бонусных).
- Выход открыт, когда нет ждущих соседей (кроме тайного) и босс повержен; герой на выходе — `clear`. Без потерь — `pool+1`.
  Золотой билет → после уровня бонус (`inBonus`, 25 с, гость = `pool+1`). После 20-го уровня — `won`.
- Конец игры: `pool = 0` (`why 'pool'`) или все герои выбыли (`why 'lives'`).

События `onEvent`: `level{n,kind,d,style,bonus,boss}`, `bossIntro{kind}`, `shot{pi,w}`, `swap`, `noAmmo`, `hit`, `kill{type,x,y,how,pts}`,
`stun`, `pop`, `wall`, `splash`, `bait`, `boom`, `crack`, `spawn`, `spawnerDie`, `grab`, `saved{type,pts,bonus,pool}`, `lost{type,pool}`,
`pickup{kind,pi}`, `door`, `nokey`, `portal`, `hurt{pi}`, `block`, `die{pi,lives}`, `out{pi}`, `respawn`, `life`, `drumWarn`, `drum`,
`throw`, `organ`, `chargeWarn`, `charge`, `thud`, `stringsWarn`, `strings`, `teleport`, `bossHit`, `bossDie`, `exitOpen`,
`clear{n,saved,lost,bonus,perfect,ticket,moved,pool}`, `bonusStart`, `bonusEnd{saved}`, `gameover{why}`, `win`.

## js/render.js — `SOSEDI.R`
Экран 640×404: HUD 32 px + вид 640×372, мир в масштабе `Z = 1.4`. `setRetro(bool)`, `world(ctx,S,M,cam,t)`, `hud(g,ctx,S,M)`,
`hero/neighbor/toy/boss/spawner/pickup/exit`, `invalidate()` (кэш карты пересобирается при смене темы, двери, трещины).

## js/main.js
Сборка на движке: `useStandardScreens` + `usePlayers` (раскладки И1/И2, тач — И1), камера по середине героев,
всплывашки и баннеры, смена трека по типу уровня (`sosedi`, `sosedi:boss`, `sosedi:bonus`). Отладка: `SOSEDI.app`.
