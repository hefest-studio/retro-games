/* tools/promo/platform-features.check.mjs — общая проверка «Без рекламы» и таблиц лидеров для игр волн 2–4 (подключается из
   <игра>/tests/engine.test.mjs). Статика js/main.js (как в пилотах kaskad/otboynik/kladka) + сверка со списком для Консоли
   promo/<slug>/platform.json (arcade-full; путь — PROMO_DIR). Поведение с мок-SDK (пункты в меню и паузе, цена, покупка, отправка в
   таблицы, восстановление покупки, web — всё скрыто) — в _shared/tests/platform-builds.browser.mjs по сборкам tools/platform-build.mjs.
   checkPlatformFeatures({ ROOT, slug, boards, test, ok }) — boards: технические имена таблиц ([] — в игре нет счёта). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PROMO_DIR = path.resolve(process.env.PROMO_DIR || path.join(REPO, '..', 'arcade-full', 'promo'));

export function checkPlatformFeatures({ ROOT, slug, boards, test, ok }) {
  const main = fs.readFileSync(path.join(ROOT, 'js/main.js'), 'utf8');
  test('площадка: «Без рекламы» (no_ads) в меню и паузе — g.useNoAds({ scene: [title, pause] }); пункты только на площадке с покупками (движок)', () => {
    ok(/g\.useNoAds\(\{ scene: \['title', 'pause'\], after: 'end' \}\)/.test(main), 'нет g.useNoAds({ scene: [title, pause] })');
    ok(!/g\.useProducts\(|g\.purchase\(/.test(main), 'покупки — только через движок (useNoAds)');
  });
  if (boards.length) test('площадка: таблицы лидеров ' + boards.join(', ') + ' — createGame({ leaderboard }), g.useLeaderboard, досылка рекорда после слияния облака', () => {
    ok(new RegExp("gameId: '" + slug + "', leaderboard: '" + boards[0] + "'").test(main), 'createGame без leaderboard: ' + boards[0]);
    const m = main.match(/g\.useLeaderboard\(\{ boards: \[(.*)\], after: 'end' \}\)/); ok(m, 'нет g.useLeaderboard');
    for (const b of boards) ok(m[1].indexOf("id: " + (b === boards[0] ? 'LB' : 'LB_TIME')) >= 0 || m[1].indexOf("'" + b + "'") >= 0, 'таблица ' + b + ' не в useLeaderboard');
    for (const b of boards) ok(main.indexOf("'" + b + "'") >= 0, 'имя таблицы ' + b + ' не найдено в main.js');
    ok(/g\.onCloud\(function \(keys\) \{ if \(keys\.length\)/.test(main), 'нет досылки рекорда из облака (g.onCloud)');
  });
  else test('площадка: таблицы лидеров нет (в игре нет счёта) — g.useLeaderboard и leaderboard в createGame не подключены', () => {
    ok(!/useLeaderboard|leaderboard:/.test(main), 'лидерборд подключён, хотя счёта нет');
  });
  const pj = path.join(PROMO_DIR, slug, 'platform.json');
  if (fs.existsSync(pj)) test('площадка: promo/' + slug + '/platform.json (список для Консоли) совпадает с игрой: товар no_ads, таблицы ' + (boards.join(', ') || '—'), () => {
    const P = JSON.parse(fs.readFileSync(pj, 'utf8'));
    ok(P.yandex.products.some((x) => x.id === 'no_ads') && P.gamepush.products.some((x) => x.tag === 'no_ads'), 'нет товара no_ads');
    ok(JSON.stringify(P.yandex.leaderboards.map((b) => b.id)) === JSON.stringify(boards), 'таблицы Яндекса: ' + JSON.stringify(P.yandex.leaderboards.map((b) => b.id)));
    ok(JSON.stringify(P.gamepush.playerFields.map((b) => b.key)) === JSON.stringify(boards), 'поля GamePush');
    for (const b of P.yandex.leaderboards) for (const l of ['ru', 'en', 'tr', 'es', 'pt']) ok(b.title && b.title[l], b.id + ': нет названия ' + l);
  });
}
