/* ДЕСАНТ · строки RU/EN (движок: g.t(key)). Все имена — оригинальные: десантники «Ольха» и «Пихта», сажевики,
   танкетка «Сверчок», зоны и машины-боссы придуманы студией «Гефест». */
(function (global) {
  'use strict';
  var DS = global.DESANT = global.DESANT || {};
  DS.STR = {
    ru: {
      title: 'ДЕСАНТ', subtitle: 'Кооп-run-and-gun: десант «Гефеста» идёт на север',
      play: 'Играть', players: 'Игроки', touch1p: 'тач — 1 игрок', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', win: 'СЕВЕР СВОБОДЕН!', gameover: 'ДЕСАНТ РАЗБИТ', best: 'Рекорд', score: 'Счёт',
      tapstart: 'пробел / тап — в меню', level: 'Зона',
      hint1: 'И1: WASD · F — огонь (держи — стрейф) · G — граната',
      hint2: 'И2: стрелки · . — огонь · / — граната · 1/2 — игроки',
      p1: 'ОЛЬХА', p2: 'ПИХТА', zone: 'ЗОНА', z_1: 'Северная тайга', z_2: 'Торфяные топи', z_3: 'Каменоломня', z_4: 'Сплавные пороги', z_5: 'Старая крепость мастеровых',
      zs_1: 'ельник, ручьи и первые посты сажевиков', zs_2: 'гати через трясину, катера на протоках', zs_3: 'уступы, вагонетки и дзоты в карьере',
      zs_4: 'мосты над порогами, катера и лесосклады', zs_5: 'стены, ворота и Чадная машина во дворе',
      b_icebreaker: 'ЛЕДОКОЛ-ТЯГАЧ', b_dredger: 'ЗЕМЛЕЧЕРПАЛКА', b_crusher: 'КАМНЕДРОБИЛКА', b_dam: 'ПЛОТИНА СО ШЛЮЗАМИ', b_engine: 'ЧАДНАЯ МАШИНА',
      bs_icebreaker: 'сбей две пушки — откроется топка', bs_dredger: 'миномёт и пулемёты прикрывают ковш-ядро', bs_crusher: 'уходи от валунов, бей бункеры, затем жернов',
      bs_dam: 'бей шлюз, пока он открыт', bs_engine: 'четыре котла питают спираль, потом — ядро',
      checkpoint: 'ЧЕКПОИНТ', clear: 'ЗОНА ПРОЙДЕНА', bossDown: 'МАШИНА ПОВЕРЖЕНА', cont: 'ПРОДОЛЖИТЬ?', contHint: 'огонь — с чекпоинта, осталось продолжений: ',
      board: 'в танкетке', exit: 'вышел', noFuel: 'нет топлива', noNade: 'нет гранат', armorWord: 'броня', fuelWord: 'топливо', tank: 'СВЕРЧОК',
      p_nade: '+3 гранаты', p_med: '+ здоровье', p_spread: 'ВЕЕР', p_rapid: 'СКОРОСТРЕЛ', p_fuel: 'топливо и ремонт', life: '+1 ЖИЗНЬ',
      w_rifle: 'карабин', w_spread: 'веер', w_rapid: 'скорострел', out: 'выбыл', ready: 'ВПЕРЁД!', armor: 'броня!'
    },
    en: {
      title: 'SOOTBREAKERS', subtitle: 'Co-op run-and-gun: the Hefest drop team marches north',
      play: 'Play', players: 'Players', touch1p: 'touch — 1 player', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      pause: 'PAUSED', resume: 'Resume', menu: 'Main menu', win: 'THE NORTH IS FREE!', gameover: 'SQUAD DOWN', best: 'Best', score: 'Score',
      tapstart: 'space / tap — to menu', level: 'Zone',
      hint1: 'P1: WASD · F — fire (hold to strafe) · G — grenade',
      hint2: 'P2: arrows · . — fire · / — grenade · 1/2 — players',
      p1: 'ALDER', p2: 'FIR', zone: 'ZONE', z_1: 'Northern Taiga', z_2: 'Peat Bogs', z_3: 'The Quarry', z_4: 'Log-Drive Rapids', z_5: "Old Craftsmen's Fortress",
      zs_1: 'spruce woods, creeks and the first Sooter posts', zs_2: 'boardwalks over the mire, launches in the channels', zs_3: 'ledges, carts and pillboxes in the pit',
      zs_4: 'bridges over the rapids, launches and timber yards', zs_5: 'walls, gates and the Smoke Engine in the yard',
      b_icebreaker: 'ICEBREAKER HAULER', b_dredger: 'BOG DREDGER', b_crusher: 'ROCK CRUSHER', b_dam: 'SLUICE DAM', b_engine: 'SMOKE ENGINE',
      bs_icebreaker: 'knock out both cannons to bare the firebox', bs_dredger: 'a mortar and two guns shield the bucket core', bs_crusher: 'dodge the boulders, smash the hoppers, then the millstone',
      bs_dam: 'hit each sluice while it is open', bs_engine: 'four boilers feed the spiral, then the core',
      checkpoint: 'CHECKPOINT', clear: 'ZONE CLEAR', bossDown: 'MACHINE DESTROYED', cont: 'CONTINUE?', contHint: 'fire — from checkpoint, continues left: ',
      board: 'in the tankette', exit: 'out', noFuel: 'no fuel', noNade: 'no grenades', armorWord: 'armor', fuelWord: 'fuel', tank: 'CRICKET',
      p_nade: '+3 grenades', p_med: '+ health', p_spread: 'FAN GUN', p_rapid: 'RAPID GUN', p_fuel: 'fuel & repair', life: '+1 LIFE',
      w_rifle: 'carbine', w_spread: 'fan gun', w_rapid: 'rapid gun', out: 'out', ready: 'MOVE OUT!', armor: 'armored!'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
