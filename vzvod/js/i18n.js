/* ВЗВОД · i18n (RU/EN). VZVOD.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/sound/pause/resume/menu/win/gameover/best/score/tapstart нужны стандартным экранам движка;
   n_0..n_23 — имена болванчиков, r_0..r_5 — ранги, op_N/m_N_M — операции и миссии, o_* — цели. */
(function (global) {
  'use strict';
  var V = global.VZVOD = global.VZVOD || {};
  var NAMES = {
    ru: ['Шуруп', 'Гайка', 'Болтик', 'Шплинт', 'Клёпка', 'Пружина', 'Втулка', 'Зубец', 'Ключик', 'Скоба', 'Штифт', 'Шайба',
      'Уголок', 'Кулачок', 'Рычажок', 'Валик', 'Поршень', 'Фланец', 'Сверло', 'Кернер', 'Муфта', 'Хомут', 'Защёлка', 'Колёсико'],
    en: ['Screw', 'Nut', 'Bolty', 'Cotter', 'Rivet', 'Spring', 'Bushing', 'Cog', 'Keylet', 'Bracket', 'Pin', 'Washer',
      'Angle', 'Cam', 'Lever', 'Roller', 'Piston', 'Flange', 'Drill', 'Punch', 'Coupler', 'Clamp', 'Latch', 'Wheely']
  };
  V.STR = {
    ru: {
      play: 'Новая кампания', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Операция', best: 'Рекорд', win: 'УЛЕЙ ОСТАНОВЛЕН! КВАРТАЛЫ СНОВА РАБОТАЮТ', gameover: 'ДРУЖИНА ОТСТУПИЛА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ВЗВОД', subtitle: 'Дружина ремонтников мастерской «Гефест» против Ржавого Улья',
      back: 'Каталог', cont: 'Продолжить', newc: 'Новая кампания', newcSure: 'Начать заново? (ещё раз)',
      op: 'ОПЕРАЦИЯ', opShort: 'Оп.', missionW: 'Миссия',
      op_1: 'Пробный пуск', op_2: 'Литейный квартал', op_3: 'Холодный склад', op_4: 'Трубное болото', op_5: 'Ледяной ангар', op_6: 'Сердце Улья',
      m_1_1: 'Первая искра', m_1_2: 'Чистый цех',
      m_2_1: 'Три трубы', m_2_2: 'Наладчик в пути', m_2_3: 'Насосная',
      m_3_1: 'Иней на клёпках', m_3_2: 'Вагонетка', m_3_3: 'Метель',
      m_4_1: 'Самоход', m_4_2: 'Шлюз', m_4_3: 'Ржавая топь',
      m_5_1: 'Ледяные пролёты', m_5_2: 'Котельная', m_5_3: 'Последний обоз',
      m_6_1: 'Корни Улья', m_6_2: 'Через пекло', m_6_3: 'Сборочная линия', m_6_4: 'Сердцевина',
      b_factory: 'заводской квартал', b_snow: 'снежные склады', b_swamp: 'болото с трубами',
      o_hives: 'Взорвите ульи-генераторы шестернями или ракетами (паяльник улей не берёт)',
      o_clear: 'Взорвите ульи и разберите все механизмы квартала',
      o_escort: 'Доведите наладчика до выхода: он идёт, только когда рядом кто-то из отряда',
      o_hold: 'Удержите насосную точку: кто-то из отряда должен стоять в круге',
      os_hives: 'Ульи', os_clear: 'Осталось', os_escort: 'Наладчик', os_hold: 'Точка',
      r_0: 'Ученик', r_1: 'Слесарь', r_2: 'Наладчик', r_3: 'Мастер', r_4: 'Ст. мастер', r_5: 'Гл. мастер',
      squad: 'ОТРЯД', inRepair: 'В ремонте', fund: 'Ремонтный фонд', repairCost: 'ремонт —', ammo: 'Запас',
      gear: 'Шестерни', rocket: 'Ракеты', goFight: 'Enter / клик — в бой', toMenu: 'Esc — в меню', next: 'Enter / клик — дальше',
      returns: 'вернётся', waitFund: 'ждёт фонд', soon: 'после миссии',
      won: 'МИССИЯ ВЫПОЛНЕНА', lost: 'ОТРЯД ВЫБЫЛ', lostVip: 'НАЛАДЧИК СЛОМАН', retry: 'Миссию придётся повторить',
      kills: 'Механизмов', hivesW: 'Ульев', xp: 'опыт', promo: 'новый ранг', broken: 'на ремонт', fundGain: 'В фонд',
      recruits: 'Мастерская собрала', repaired: 'Из ремонта', emergency: 'Срочная сборка', opDone: 'Операция завершена!',
      grpA: 'Группа А', grpB: 'Группа Б', inCart: 'вагонетка', inSkimmer: 'самоход',
      t_noAmmo_gear: 'нет шестерней', t_noAmmo_rocket: 'нет ракет', t_ping: 'улей — только шестернёй или ракетой',
      t_pick_gear: '+3 шестерни', t_pick_rocket: '+2 ракеты', t_supply: 'мастерская прислала ящик!', t_hive: 'улей взорван!',
      t_broken: 'сломан — на ремонт', t_board: 'в машине', t_exit: 'вышли', t_noExit: 'здесь не выйти', t_vehDown: 'машина разбита!',
      t_split: 'отряд разделён', t_merge: 'отряд собран', t_switch: 'управление:', t_vip: 'наладчик повреждён!', t_hold: 'точка занята — держитесь!',
      t_wave: 'идут механизмы!',
      mode_fire: 'огонь', mode_gear: 'шестерня', mode_rocket: 'ракета',
      hintKeys: 'ЛКМ — идти · ПКМ (держать) / пробел — огонь · Q — шестерня · E — ракета · X — делить · Tab — группа · F — выйти',
      foot: '<b>ВЗВОД</b> · ЛКМ — отряд идёт гуськом за лидером (клик по машине — сесть) · ПКМ (держать) или пробел — огонь паяльниками в точку курсора · Q/G — шестерня (взрывается, летит через стены) · E/R — ракета · X — разделить/собрать отряд · Tab — переключить группу · F — выйти из машины · стрелки/WASD — осмотреться · клик по миникарте — идти туда · P/Esc пауза · L язык, T тема, M звук. Тач: тап — идти, двойной тап — огонь, кнопки внизу.'
    },
    en: {
      play: 'New campaign', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Operation', best: 'Best', win: 'THE HIVE IS STOPPED! THE BLOCKS ARE WORKING AGAIN', gameover: 'THE CREW FELL BACK',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'VZVOD', subtitle: 'The Hefest workshop repair crew versus the Rust Hive',
      back: 'Catalog', cont: 'Continue', newc: 'New campaign', newcSure: 'Start over? (again)',
      op: 'OPERATION', opShort: 'Op.', missionW: 'Mission',
      op_1: 'Test Run', op_2: 'Foundry Block', op_3: 'Cold Storage', op_4: 'Pipe Marsh', op_5: 'Ice Hangar', op_6: 'Heart of the Hive',
      m_1_1: 'First Spark', m_1_2: 'Clean Floor',
      m_2_1: 'Three Stacks', m_2_2: 'Tuner on the Move', m_2_3: 'Pump House',
      m_3_1: 'Frost on Rivets', m_3_2: 'The Cart', m_3_3: 'Blizzard',
      m_4_1: 'The Skimmer', m_4_2: 'The Lock', m_4_3: 'Rusty Bog',
      m_5_1: 'Frozen Spans', m_5_2: 'Boiler Room', m_5_3: 'Last Convoy',
      m_6_1: 'Hive Roots', m_6_2: 'Through the Furnace', m_6_3: 'Assembly Line', m_6_4: 'The Core',
      b_factory: 'factory block', b_snow: 'snowy depots', b_swamp: 'pipe marsh',
      o_hives: 'Blow up the hive generators with gears or rockets (solder beams do not harm hives)',
      o_clear: 'Blow up the hives and take apart every machine in the block',
      o_escort: 'Bring the tuner to the exit: he only walks while one of the crew is near',
      o_hold: 'Hold the pump point: someone from the crew must stand inside the circle',
      os_hives: 'Hives', os_clear: 'Left', os_escort: 'Tuner', os_hold: 'Point',
      r_0: 'Trainee', r_1: 'Fitter', r_2: 'Tuner', r_3: 'Master', r_4: 'Sr. master', r_5: 'Chief',
      squad: 'CREW', inRepair: 'In repair', fund: 'Repair fund', repairCost: 'repair —', ammo: 'Supplies',
      gear: 'Gears', rocket: 'Rockets', goFight: 'Enter / click — go', toMenu: 'Esc — menu', next: 'Enter / click — next',
      returns: 'returns', waitFund: 'awaits fund', soon: 'after a mission',
      won: 'MISSION COMPLETE', lost: 'CREW KNOCKED OUT', lostVip: 'THE TUNER IS BROKEN', retry: 'The mission must be replayed',
      kills: 'Machines', hivesW: 'Hives', xp: 'xp', promo: 'promoted', broken: 'to repair', fundGain: 'To fund',
      recruits: 'Workshop built', repaired: 'Back from repair', emergency: 'Rush build', opDone: 'Operation complete!',
      grpA: 'Group A', grpB: 'Group B', inCart: 'cart', inSkimmer: 'skimmer',
      t_noAmmo_gear: 'no gears', t_noAmmo_rocket: 'no rockets', t_ping: 'hives need a gear or a rocket',
      t_pick_gear: '+3 gears', t_pick_rocket: '+2 rockets', t_supply: 'the workshop sent a crate!', t_hive: 'hive destroyed!',
      t_broken: 'broken — off to repair', t_board: 'aboard', t_exit: 'out', t_noExit: 'cannot get out here', t_vehDown: 'vehicle wrecked!',
      t_split: 'crew split', t_merge: 'crew joined', t_switch: 'control:', t_vip: 'the tuner is hit!', t_hold: 'point taken — hold on!',
      t_wave: 'machines incoming!',
      mode_fire: 'fire', mode_gear: 'gear', mode_rocket: 'rocket',
      hintKeys: 'LMB — move · RMB (hold) / space — fire · Q — gear · E — rocket · X — split · Tab — group · F — get out',
      foot: '<b>VZVOD</b> · LMB — the crew walks in single file behind the leader (click a vehicle to board) · RMB (hold) or space — fire solder beams at the cursor · Q/G — gear (explodes, flies over walls) · E/R — rocket · X — split/join the crew · Tab — switch group · F — leave the vehicle · arrows/WASD — look around · click the minimap — go there · P/Esc pause · L language, T theme, M sound. Touch: tap — move, double tap — fire, buttons below.'
    }
  };
  NAMES.ru.forEach(function (n, i) { V.STR.ru['n_' + i] = n; V.STR.en['n_' + i] = NAMES.en[i]; });
})(typeof window !== 'undefined' ? window : globalThis);
