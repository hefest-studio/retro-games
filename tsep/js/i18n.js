/* ЦЕПЬ · i18n (RU/EN). TSEP.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре.
   f_<этаж> — название этажа, b_<страж>, s_<орудие>, e_<враг>, d_<причина гибели>. */
(function (global) {
  'use strict';
  var T = global.TSEP = global.TSEP || {};
  T.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Этаж', best: 'Рекорд', pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      win: 'ВРЕМЯ ПОШЛО!', gameover: 'ЧАСЫ СТОЯТ',
      title: 'ЦЕПЬ', subtitle: 'Звонарь «Гефеста» в башне Остановленных Часов',
      sub2: 'Цепь-кистень, искры и маятники — поднимись к Часовому Сердцу',
      back: 'Каталог', lives: 'Жизни', floor: 'Этаж', sparks: 'Искры', none: 'нет',
      cont: 'Продолжить', contQ: 'ПРОДОЛЖИТЬ?', contHint: 'пробел — да · Esc — нет', restart: 'Этаж заново',
      pwd: 'Пароль', pwdTitle: 'ВВОД ПАРОЛЯ', pwdHint: '↑↓ знак · ←→ место · пробел — ввод · Esc — назад', pwdBad: 'Пароль не подошёл', pwdIs: 'Пароль этажа',
      clear: 'ЭТАЖ ЗАПУЩЕН', bonus: 'бонус', checkpoint: 'Отметка обходчика', chainUp: 'Цепь тяжелее', chainMax: 'Цепь на пределе: +1000',
      nosparks: 'Мало искр', life: '+1 жизнь', freeze: 'Стоп-маятник!', branch: 'Две двери наверх', route_A: 'Ход шестерён', route_B: 'Колокольная галерея',
      coreGot: 'Шестерня хода!', winText: 'Часовое Сердце бьётся — время в башне снова идёт.',
      hint: '←→ ход · Пробел прыжок · X удар цепью (↑+X — вверх) · C орудие · ↑↓ лестница · P пауза',
      f_works: 'Нижний механизм', f_pendulum: 'Маятниковый зал', f_springs: 'Пружинная шахта', f_gears: 'Ход шестерён',
      f_flywheel: 'Зал маховиков', f_gallery: 'Колокольная галерея', f_belfry: 'Звонница', f_heart: 'Часовое Сердце',
      b_cuckoo: 'Кукушка-часовщица', b_pendulum: 'Маятниковый страж', b_drake: 'Пружинный дракон-автомат', b_spider: 'Паук-завод',
      b_flywheel: 'Маховик-бегун', b_bellows: 'Кузнечные мехи', b_ringer: 'Звонарь-двойник', b_heart: 'Часовое Сердце',
      s_key: 'Метательный ключ', s_flask: 'Огненная склянка', s_gear: 'Шестерня-бумеранг', s_spring: 'Часовая пружина', s_stopper: 'Стоп-маятник',
      e_tick: 'Тикун', e_moth: 'Латунная моль', e_oiler: 'Маслёнщик', e_springer: 'Попрыгун', e_guard: 'Часовой',
      d_pit: 'Сорвался в шахту', d_saw: 'Зубчатка', d_boss: 'Страж', d_hit: 'Удар', d_test: 'Испытание', d_tick: 'Тикун', d_moth: 'Моль', d_oiler: 'Маслёнщик',
      d_springer: 'Попрыгун', d_guard: 'Часовой', d_oil: 'Капля масла', d_gear: 'Шестерня', d_egg: 'Латунное яйцо', d_shard: 'Осколок', d_steam: 'Пар',
      d_nut: 'Гайка', d_ember: 'Искра горна', d_wave: 'Звон', d_dart: 'Стрелка часов', d_ringer: 'Звонарь',
      foot: '<b>ЦЕПЬ</b> · ← → / A D — ход · Пробел / Z / K — прыжок (дуга не меняется в полёте) · X / J — удар цепью (замах!), ↑ + удар — наискось вверх · C / I / Shift — орудие за искры · ↑ ↓ — лестница, ↓ — присед · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Floor', best: 'Best', pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      win: 'TIME MOVES AGAIN!', gameover: 'THE CLOCKS STAND STILL',
      title: 'TSEP', subtitle: 'A Hefest bell-ringer in the Tower of Stopped Clocks',
      sub2: 'Chain flail, sparks and pendulums — climb to the Clock Heart',
      back: 'Catalog', lives: 'Lives', floor: 'Floor', sparks: 'Sparks', none: 'none',
      cont: 'Continue', contQ: 'CONTINUE?', contHint: 'space — yes · Esc — no', restart: 'Restart floor',
      pwd: 'Password', pwdTitle: 'ENTER PASSWORD', pwdHint: '↑↓ symbol · ←→ slot · space — enter · Esc — back', pwdBad: 'Wrong password', pwdIs: 'Floor password',
      clear: 'FLOOR RUNNING', bonus: 'bonus', checkpoint: 'Warden mark', chainUp: 'Heavier chain', chainMax: 'Chain maxed: +1000',
      nosparks: 'Not enough sparks', life: '+1 life', freeze: 'Stop-Pendulum!', branch: 'Two doors lead up', route_A: 'Gear Run', route_B: 'Bell Gallery',
      coreGot: 'Drive gear!', winText: 'The Clock Heart beats — time in the tower moves again.',
      hint: '←→ move · Space jump · X chain strike (↑+X — upward) · C tool · ↑↓ stairs · P pause',
      f_works: 'Lower Works', f_pendulum: 'Pendulum Hall', f_springs: 'Spring Shaft', f_gears: 'Gear Run',
      f_flywheel: 'Flywheel Hall', f_gallery: 'Bell Gallery', f_belfry: 'Belfry', f_heart: 'The Clock Heart',
      b_cuckoo: 'Clockwork Cuckoo', b_pendulum: 'Pendulum Warden', b_drake: 'Spring Drake Automaton', b_spider: 'Windup Spider',
      b_flywheel: 'Runaway Flywheel', b_bellows: 'Forge Bellows', b_ringer: 'Bell-Ringer Double', b_heart: 'The Clock Heart',
      s_key: 'Throwing Wrench', s_flask: 'Fire Flask', s_gear: 'Boomerang Gear', s_spring: 'Clock Spring', s_stopper: 'Stop-Pendulum',
      e_tick: 'Ticker', e_moth: 'Brass Moth', e_oiler: 'Oiler', e_springer: 'Hopper', e_guard: 'Clock Guard',
      d_pit: 'Fell down the shaft', d_saw: 'Saw gear', d_boss: 'Warden', d_hit: 'Hit', d_test: 'Test', d_tick: 'Ticker', d_moth: 'Moth', d_oiler: 'Oiler',
      d_springer: 'Hopper', d_guard: 'Clock Guard', d_oil: 'Oil drop', d_gear: 'Gear', d_egg: 'Brass egg', d_shard: 'Shard', d_steam: 'Steam',
      d_nut: 'Nut', d_ember: 'Forge ember', d_wave: 'Bell wave', d_dart: 'Clock hand', d_ringer: 'Bell-Ringer',
      foot: '<b>TSEP</b> · ← → / A D — move · Space / Z / K — jump (fixed arc) · X / J — chain strike (wind-up!), ↑ + strike — diagonal up · C / I / Shift — tool for sparks · ↑ ↓ — stairs, ↓ — crouch · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
