/* СПУТНИК · i18n (RU/EN). SPUTNIK.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var Sp = global.SPUTNIK = global.SPUTNIK || {};
  Sp.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Уровень', best: 'Рекорд', win: 'ПОЯС ОКАЛИНЫ ПРОЙДЕН!', gameover: 'КОРАБЛЬ ПОТЕРЯН',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'СПУТНИК', subtitle: 'Корабль «Горн» и дрон «Наковальня» · 6 уровней сквозь пояс Окалины',
      back: 'Каталог', lives: 'Корабли',
      lvl: 'УРОВЕНЬ', ready: 'Курс — на восток!', clear: 'УРОВЕНЬ ПРОЙДЕН', bonus: 'Бонус', lost: 'КОРАБЛЬ ПОДБИТ', cp: 'контрольная точка',
      lv_orbit: 'Орбита мастерской', lv_slag: 'Шлаковые пещеры', lv_gears: 'Механический пояс', lv_channel: 'Литейный канал', lv_hive: 'Улей Окалины', lv_heart: 'Сердце Окалины',
      sub_orbit: 'Наковальня глотает пули — держи её впереди',
      sub_slag: 'Стены пещер смертельны — не прижимайся к рельефу',
      sub_gears: 'Поршни и шестерни ходят по такту — лови окно',
      sub_channel: 'Узкий канал и пушки на стенах — пригодится «змейка»',
      sub_hive: 'Рой гуще — «веер» и оптики держат строй',
      sub_heart: 'Последний рубеж: сбей пушки-руки и пробей ядро',
      b_crucible: 'ГОРНИЛО', b_hammer: 'МОЛОТ', b_worm: 'МНОГОНОЖКА', b_hive: 'УЛЕЙ', b_mirror: 'ЗЕРЦАЛО', b_heart: 'СЕРДЦЕ ОКАЛИНЫ', guard: 'СТРАЖ',
      w_crucible: 'Бей в пасть, когда раскроется', w_hammer: 'Глаз за бойком — бей между взмахами', w_worm: 'Уязвим только хвост',
      w_hive: 'Ядро открыто, пока выпускает рой', w_mirror: 'Глаз открыт, пока копит луч — потом уходи с линии', w_heart: 'Створки ядра расходятся — бей в щель',
      weak: 'слабое место',
      cap_R: 'РИКОШЕТ', cap_S: 'ЗМЕЙКА', cap_V: 'ВЕЕР', cap_O: 'ОПТИКА', extra: '+1 КОРАБЛЬ',
      dr_front: 'нос', dr_back: 'корма', dr_free: 'отстёгнут', dr_launch: 'в полёте', dr_return: 'возврат', dr_none: 'без луча',
      charge: 'ЗАРЯД', drone: 'НАКОВАЛЬНЯ',
      hint: 'Стрелки — полёт · Пробел — огонь (держать — заряд) · X — дрон · P — пауза',
      foot: '<b>СПУТНИК</b> · Стрелки / WASD — полёт · Пробел / Z — огонь (удержание — заряд, отпусти — луч) · X / Shift — отстегнуть/вернуть дрон · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Level', best: 'Best', win: 'THE SCALE BELT IS BREACHED!', gameover: 'SHIP LOST',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'SPUTNIK', subtitle: 'The Furnace ship and the Anvil drone · 6 levels through the Scale belt',
      back: 'Catalog', lives: 'Ships',
      lvl: 'LEVEL', ready: 'Heading east!', clear: 'LEVEL CLEAR', bonus: 'Bonus', lost: 'SHIP DOWN', cp: 'checkpoint',
      lv_orbit: 'Workshop Orbit', lv_slag: 'Slag Caves', lv_gears: 'Gear Belt', lv_channel: 'Casting Channel', lv_hive: 'Scale Hive', lv_heart: 'Heart of Scale',
      sub_orbit: 'The Anvil swallows bullets — keep it in front',
      sub_slag: 'Cave walls are deadly — keep clear of the rock',
      sub_gears: 'Pistons and gears move in rhythm — catch the gap',
      sub_channel: 'A narrow channel with wall cannons — the crawler helps',
      sub_hive: 'The swarm is thicker — the fan and lenses hold the line',
      sub_heart: 'The last line: break the cannon arms, then the core',
      b_crucible: 'CRUCIBLE', b_hammer: 'HAMMER', b_worm: 'CENTIPEDE', b_hive: 'HIVE', b_mirror: 'MIRROR', b_heart: 'HEART OF SCALE', guard: 'WARDEN',
      w_crucible: 'Hit the maw when it opens', w_hammer: 'The eye hides behind the swinging head', w_worm: 'Only the tail is vulnerable',
      w_hive: 'The core opens while it releases the swarm', w_mirror: 'The eye opens while it charges — then leave the line', w_heart: 'The core shutters part — shoot the gap',
      weak: 'weak point',
      cap_R: 'RICOCHET', cap_S: 'CRAWLER', cap_V: 'FAN', cap_O: 'LENS', extra: '+1 SHIP',
      dr_front: 'nose', dr_back: 'tail', dr_free: 'detached', dr_launch: 'flying', dr_return: 'returning', dr_none: 'no beam',
      charge: 'CHARGE', drone: 'ANVIL',
      hint: 'Arrows — fly · Space — fire (hold to charge) · X — drone · P — pause',
      foot: '<b>SPUTNIK</b> · Arrows / WASD — fly · Space / Z — fire (hold to charge, release for a beam) · X / Shift — detach/recall the drone · P / Esc — pause · L language, T theme, M sound.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
