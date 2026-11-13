/* СКОК · i18n (RU/EN). SKOK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре.
   n_<id> — названия уровней, r<N> — края, s_<костюм> — костюмы, b_<хозяин> — хозяева крепостей, d_<причина> — потеря жизни. */
(function (global) {
  'use strict';
  var SK = global.SKOK = global.SKOK || {};
  SK.STR = {
    ru: {
      play: 'В путь', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Уровень', best: 'Рекорд', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      win: 'МЕХАНИЗМ СОБРАН!', gameover: 'СКОК ВОЗВРАЩАЕТСЯ В МАСТЕРСКУЮ',
      title: 'СКОК', subtitle: 'Лис-лудильщик из мастерской «Гефест» собирает Большой Часовой Механизм',
      back: 'Каталог', reset: 'Сбросить карту', resetQ: 'Сбросить? ещё раз — да', resetDone: 'Карта сброшена', toMap: 'На карту',
      r1: 'Медные холмы', r2: 'Лоскутный лес', r3: 'Паровые топи', r4: 'Шестерёночные выси',
      'n_1-1': 'Заплатный луг', 'n_1-2': 'Ржавые увалы', 'n_1-3': 'Медная горка', 'n_1-4': 'Котельный овраг', 'n_1-5': 'Холм часовщика', 'n_1-F': 'Ржавая крепость',
      'n_2-1': 'Пёстрая опушка', 'n_2-2': 'Нитяная чаща', 'n_2-3': 'Пуговичный бор', 'n_2-4': 'Штопаный лог', 'n_2-5': 'Лоскутная поляна', 'n_2-F': 'Котельная крепость',
      'n_3-1': 'Туманный брод', 'n_3-2': 'Смоляные мостки', 'n_3-3': 'Свистящая гать', 'n_3-4': 'Клапанный разлив', 'n_3-5': 'Паровая гряда', 'n_3-F': 'Флюгерная крепость',
      'n_4-1': 'Зубчатый склон', 'n_4-2': 'Ветреная ось', 'n_4-3': 'Пружинный хребет', 'n_4-4': 'Маятниковый обрыв', 'n_4-5': 'Небесная ось', 'n_4-F': 'Крепость Маятника',
      'n_1-S': 'Лавка-лотерея', 'n_2-S': 'Лавка-лотерея', 'n_3-S': 'Лавка-лотерея', 'n_4-S': 'Лавка-лотерея',
      'n_1-R': 'Угадай рычаг', 'n_2-R': 'Угадай рычаг', 'n_3-R': 'Угадай рычаг', 'n_4-R': 'Угадай рычаг',
      'n_1-A': 'Стычка с бродягой', 'n_2-A': 'Стычка с бродягой', 'n_3-A': 'Стычка с бродягой', 'n_4-A': 'Стычка с бродягой',
      s_apron: 'Кузнечный фартук', s_wings: 'Крылья-зонтик', s_armor: 'Медный панцирь', s_boots: 'Пружинные башмаки',
      sd_apron: 'X — огненные заклёпки · держит лишний удар', sd_wings: 'держи прыжок в падении — планирование', sd_armor: 'шипы не страшны · ↓ в воздухе — удар о землю', sd_boots: 'прыжок выше',
      b_rust: 'Ржавый Сторож', b_boiler: 'Котельный Барон', b_vane: 'Флюгерный Граф', b_pendulum: 'Великий Маятник',
      bd: 'Прыгай ему на голову! Заклёпки — по три на удар.',
      part: 'Деталь механизма', parts: 'Детали',
      nuts: 'Гайки', lives: 'Жизни', life: '+1 жизнь', key: 'Ключ!', keyHint: 'Найди тайную дверь — ↑ у двери',
      door: 'ТАЙНЫЙ ВЫХОД', doorHint: 'На карте открылась тайная тропа', camp: 'Фонарь зажжён', lost: 'Костюм потерян',
      clear: 'УРОВЕНЬ ПРОЙДЕН', clearBoss: 'КРЕПОСТЬ ВЗЯТА', clearAmb: 'БРОДЯГА РАЗБИТ', bell: 'Звон', bellTop: 'ЗВОН НА ВСЮ ОКРУГУ!', tapMap: 'пробел — на карту',
      mapTitle: 'ЗАПЛАТНЫЕ ЗЕМЛИ', mapHint: 'стрелки — тропа · Пробел/Enter — в путь · Esc — пауза',
      locked: 'тропа закрыта', newTag: 'новое', wander: 'Бродяга!', wanderMeet: 'Бродяга преградил путь — к бою!', wanderHint: 'По тропам бродят бродяги — встреча = стычка',
      shopTitle: 'ЛАВКА-ЛОТЕРЕЯ', shopHint: '← → — выбрать короб · Пробел — открыть', shopDone: 'Лавка закрылась до следующего раза',
      leverTitle: 'УГАДАЙ РЫЧАГ', leverHint: '← → — рычаг · Пробел — дёрнуть · попыток: {n}', leverWin: 'Ворота открыты! +1 жизнь, +20 гаек', leverMiss: 'Мимо! Ещё попытка', leverLose: 'Не угадал — ворота молчат', leverDone: 'Тропа к крепости открыта',
      prize_life: '+1 жизнь', prize_nuts: '+20 гаек', got: 'Получено', anyKey: 'пробел — дальше',
      d_fall: 'Сорвался в пропасть', d_tar: 'Угодил в кипящую смолу', d_spike: 'Шипы', d_needles: 'Игольник', d_g: 'Шестерёнка', d_m: 'Заводная мышь', d_h: 'Пружинник', d_n: 'Игольник', d_v: 'Флюгерник', d_piston: 'Давильный молот', d_boss: 'Хозяин крепости', d_bolt: 'Раскалённый болт', d_test: '—',
      hint: '←→ бег · Пробел прыжок · X заклёпки · ↓ подкат/удар · ↑ дверь · P пауза',
      intro: 'Большой Часовой Механизм рассыпался по Заплатным землям. Звони в колокола часовен!',
      foot: '<b>СКОК</b> · ← → / A D — бег (держи — разгон) · Пробел / Z — прыжок (держи — выше; на врага — отскок) · X / J — огненные заклёпки (фартук) · ↓ на склоне — подкат, ↓ в воздухе — удар панцирем · ↑ — тайная дверь (с ключом) · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Set off', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Level', best: 'Best', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      win: 'THE MECHANISM IS WHOLE!', gameover: 'SKOK HEADS BACK TO THE WORKSHOP',
      title: 'SKOK', subtitle: 'A tinker fox from the Hefest workshop gathers the Great Clockwork',
      back: 'Catalog', reset: 'Reset map', resetQ: 'Reset? once more — yes', resetDone: 'Map reset', toMap: 'To the map',
      r1: 'Copper Hills', r2: 'Patchwork Woods', r3: 'Steam Marsh', r4: 'Cogwork Heights',
      'n_1-1': 'Patch Meadow', 'n_1-2': 'Rusty Rolls', 'n_1-3': 'Copper Knoll', 'n_1-4': 'Boiler Gully', 'n_1-5': 'Clockmaker Hill', 'n_1-F': 'Rust Keep',
      'n_2-1': 'Motley Edge', 'n_2-2': 'Thread Thicket', 'n_2-3': 'Button Pines', 'n_2-4': 'Darned Dell', 'n_2-5': 'Quilt Glade', 'n_2-F': 'Boiler Keep',
      'n_3-1': 'Misty Ford', 'n_3-2': 'Tar Walkways', 'n_3-3': 'Whistling Causeway', 'n_3-4': 'Valve Flood', 'n_3-5': 'Steam Ridge', 'n_3-F': 'Weathervane Keep',
      'n_4-1': 'Toothed Slope', 'n_4-2': 'Windy Axle', 'n_4-3': 'Spring Ridge', 'n_4-4': 'Pendulum Cliff', 'n_4-5': 'Sky Axle', 'n_4-F': 'Pendulum Keep',
      'n_1-S': 'Lottery Shop', 'n_2-S': 'Lottery Shop', 'n_3-S': 'Lottery Shop', 'n_4-S': 'Lottery Shop',
      'n_1-R': 'Pick a Lever', 'n_2-R': 'Pick a Lever', 'n_3-R': 'Pick a Lever', 'n_4-R': 'Pick a Lever',
      'n_1-A': 'Wanderer Brawl', 'n_2-A': 'Wanderer Brawl', 'n_3-A': 'Wanderer Brawl', 'n_4-A': 'Wanderer Brawl',
      s_apron: 'Smith Apron', s_wings: 'Umbrella Wings', s_armor: 'Copper Shell', s_boots: 'Spring Boots',
      sd_apron: 'X — fire rivets · takes an extra hit', sd_wings: 'hold jump while falling — glide', sd_armor: 'spikes can’t hurt · ↓ in the air — ground pound', sd_boots: 'jump higher',
      b_rust: 'Rust Warden', b_boiler: 'Boiler Baron', b_vane: 'Weathervane Count', b_pendulum: 'Great Pendulum',
      bd: 'Jump on its head! Rivets — three per hit.',
      part: 'Clockwork part', parts: 'Parts',
      nuts: 'Nuts', lives: 'Lives', life: '+1 life', key: 'Key!', keyHint: 'Find the secret door — ↑ at the door',
      door: 'SECRET EXIT', doorHint: 'A secret trail opened on the map', camp: 'Lantern lit', lost: 'Suit lost',
      clear: 'LEVEL CLEAR', clearBoss: 'KEEP TAKEN', clearAmb: 'WANDERER BEATEN', bell: 'Ring', bellTop: 'HEARD ACROSS THE LAND!', tapMap: 'space — to the map',
      mapTitle: 'THE PATCHWORK LANDS', mapHint: 'arrows — trail · Space/Enter — go · Esc — pause',
      locked: 'trail closed', newTag: 'new', wander: 'Wanderer!', wanderMeet: 'A wanderer blocks the way — fight!', wanderHint: 'Wanderers roam the trails — meeting one means a brawl',
      shopTitle: 'LOTTERY SHOP', shopHint: '← → — pick a box · Space — open', shopDone: 'The shop is closed until next time',
      leverTitle: 'PICK A LEVER', leverHint: '← → — lever · Space — pull · tries: {n}', leverWin: 'The gate opens! +1 life, +20 nuts', leverMiss: 'Miss! One more try', leverLose: 'Wrong lever — the gate stays shut', leverDone: 'The trail to the keep is open',
      prize_life: '+1 life', prize_nuts: '+20 nuts', got: 'Got', anyKey: 'space — continue',
      d_fall: 'Fell into the chasm', d_tar: 'Fell into boiling tar', d_spike: 'Spikes', d_needles: 'Pincushion', d_g: 'Cogling', d_m: 'Wind-up mouse', d_h: 'Springer', d_n: 'Pincushion', d_v: 'Vane flyer', d_piston: 'Drop hammer', d_boss: 'Keep master', d_bolt: 'Hot bolt', d_test: '—',
      hint: '←→ run · Space jump · X rivets · ↓ slide/pound · ↑ door · P pause',
      intro: 'The Great Clockwork fell apart across the Patchwork Lands. Ring the chapel bells!',
      foot: '<b>SKOK</b> · ← → / A D — run (hold — speed up) · Space / Z — jump (hold — higher; on a foe — bounce) · X / J — fire rivets (apron) · ↓ on a slope — slide, ↓ in the air — shell pound · ↑ — secret door (with a key) · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
