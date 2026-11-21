/* ПЕРЕПРАВА · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — ПЕРЕПРАВА, EN/TR/ES/PT — BEETLEFORD). PEREPRAVA.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var K = global.PEREPRAVA = global.PEREPRAVA || {};
  K.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'ВСЕ СКЛАДЫ ПОЛНЫ!', gameover: 'ШУРУП ОБЕСТОЧЕН',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ПЕРЕПРАВА', subtitle: 'Жук-курьер Шуруп · проезд и канал · 10 смен',
      back: 'Каталог', lives: 'Жизни', time: 'Время',
      ready: 'СМЕНА', readySub: 'Доставь детали в 5 ячеек склада',
      clear: 'СКЛАД ЗАПОЛНЕН', bonus: 'Бонус', lost: 'ПОТЕРЯ', next: 'Следующая смена',
      d_water: 'Утонул в канале', d_edge: 'Унесло течением', d_car: 'Сбит транспортом', d_spider: 'Пойман пауком',
      d_fish: 'Схвачен сомом', d_wall: 'Удар о стену склада', d_trap: 'Ячейка с капканом', d_time: 'Время вышло',
      t_bay: 'ДОСТАВЛЕНО', t_prize: 'ДЕТАЛЬ-ПРИЗ', t_mate: 'ШАЙБА ДОМА', t_pickup: 'ШАЙБА С ТОБОЙ', t_extra: '+1 ЖИЗНЬ',
      t_trap: 'КАПКАН!',
      lv_1: 'Утренняя', lv_2: 'Пересменка', lv_3: 'Паук на насыпи', lv_4: 'Капканы', lv_5: 'Сом в канале',
      lv_6: 'Половодье', lv_7: 'Гонка фур', lv_8: 'Два паука', lv_9: 'Ночная', lv_10: 'Аврал',
      cardNext: 'пробел / тап — дальше', rwLife: 'Реклама: +1 жизнь',
      hint: '←↑→↓ / WASD — прыжок · свайп или кнопки · P — пауза',
      foot: '<b>ПЕРЕПРАВА</b> · ←↑→↓ / WASD — прыжок на клетку · свайп или кнопки на экране · P/Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'ALL BAYS STOCKED!', gameover: 'SHURUP POWERED DOWN',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'BEETLEFORD', subtitle: 'Shurup the courier beetle · road & canal · 10 shifts',
      back: 'Catalog', lives: 'Lives', time: 'Time',
      ready: 'SHIFT', readySub: 'Deliver parts to all 5 warehouse bays',
      clear: 'WAREHOUSE STOCKED', bonus: 'Bonus', lost: 'LOST', next: 'Next shift',
      d_water: 'Sank in the canal', d_edge: 'Swept away', d_car: 'Hit by traffic', d_spider: 'Caught by the spider',
      d_fish: 'Snapped by the catfish', d_wall: 'Hit the warehouse wall', d_trap: 'Trapped bay', d_time: 'Out of time',
      t_bay: 'DELIVERED', t_prize: 'PRIZE PART', t_mate: 'WASHER HOME', t_pickup: 'WASHER ABOARD', t_extra: '+1 LIFE',
      t_trap: 'TRAP!',
      lv_1: 'Morning', lv_2: 'Shift change', lv_3: 'Bank spider', lv_4: 'Traps', lv_5: 'Canal catfish',
      lv_6: 'High water', lv_7: 'Truck rush', lv_8: 'Two spiders', lv_9: 'Night shift', lv_10: 'Rush hour',
      cardNext: 'space / tap — go on', rwLife: 'Watch ad: +1 life',
      hint: '←↑→↓ / WASD — hop · swipe or buttons · P — pause',
      foot: '<b>BEETLEFORD</b> · ←↑→↓ / WASD — hop one cell · swipe or on-screen buttons · P/Esc — pause · L language, T theme, M sound.'
    }
  };
  K.STR.tr = {
    play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Puan', level: 'Sv.', best: 'Rekor', win: 'TÜM GÖZLER DOLU!', gameover: 'SHURUP’UN GÜCÜ BİTTİ',
    pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
    title: 'BEETLEFORD', subtitle: 'Kurye böcek Shurup · yol ve kanal · 10 vardiya',
    back: 'Katalog', lives: 'Can', time: 'Süre',
    ready: 'VARDİYA', readySub: 'Parçaları depodaki 5 göze teslim et',
    clear: 'DEPO DOLDU', bonus: 'Bonus', lost: 'KAYIP', next: 'Sonraki vardiya',
    d_water: 'Kanalda battı', d_edge: 'Akıntıya kapıldı', d_car: 'Araç çarptı', d_spider: 'Örümceğe yakalandı',
    d_fish: 'Yayın balığı kaptı', d_wall: 'Depo duvarına çarptı', d_trap: 'Kapanlı göz', d_time: 'Süre doldu',
    t_bay: 'TESLİM', t_prize: 'ÖDÜL PARÇA', t_mate: 'PUL EVDE', t_pickup: 'PUL SENDE', t_extra: '+1 CAN',
    t_trap: 'KAPAN!',
    lv_1: 'Sabah', lv_2: 'Vardiya değişimi', lv_3: 'Sette örümcek', lv_4: 'Kapanlar', lv_5: 'Kanalda yayın',
    lv_6: 'Taşkın', lv_7: 'Tır yarışı', lv_8: 'İki örümcek', lv_9: 'Gece vardiyası', lv_10: 'Telaş',
    cardNext: 'boşluk / dokun — devam', rwLife: 'Reklam: +1 can',
    hint: '←↑→↓ / WASD — zıpla · kaydır ya da düğmeler · P — duraklat',
    foot: '<b>BEETLEFORD</b> · ←↑→↓ / WASD — bir kare zıpla · kaydır ya da ekran düğmeleri · P/Esc — duraklat · L dil, T tema, M ses.'
  };
  K.STR.es = {
    play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Puntos', level: 'Niv.', best: 'Récord', win: '¡TODOS LOS HUECOS LLENOS!', gameover: 'SHURUP SIN ENERGÍA',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
    title: 'BEETLEFORD', subtitle: 'Shurup, el escarabajo mensajero · calle y canal · 10 turnos',
    back: 'Catálogo', lives: 'Vidas', time: 'Tiempo',
    ready: 'TURNO', readySub: 'Entrega piezas en los 5 huecos del almacén',
    clear: 'ALMACÉN LLENO', bonus: 'Bonus', lost: 'PERDIDO', next: 'Siguiente turno',
    d_water: 'Se hundió en el canal', d_edge: 'Lo arrastró la corriente', d_car: 'Atropellado', d_spider: 'Atrapado por la araña',
    d_fish: 'Lo atrapó el siluro', d_wall: 'Chocó con el muro', d_trap: 'Hueco con cepo', d_time: 'Se acabó el tiempo',
    t_bay: 'ENTREGADO', t_prize: 'PIEZA PREMIO', t_mate: 'ARANDELA EN CASA', t_pickup: 'ARANDELA A BORDO', t_extra: '+1 VIDA',
    t_trap: '¡CEPO!',
    lv_1: 'Mañana', lv_2: 'Cambio de turno', lv_3: 'Araña en el talud', lv_4: 'Cepos', lv_5: 'Siluro en el canal',
    lv_6: 'Crecida', lv_7: 'Carrera de camiones', lv_8: 'Dos arañas', lv_9: 'Turno de noche', lv_10: 'Hora punta',
    cardNext: 'espacio / toca — seguir', rwLife: 'Anuncio: +1 vida',
    hint: '←↑→↓ / WASD — saltar · desliza o botones · P — pausa',
    foot: '<b>BEETLEFORD</b> · ←↑→↓ / WASD — salto de una casilla · desliza o usa los botones · P/Esc — pausa · L idioma, T tema, M sonido.'
  };
  K.STR.pt = {
    play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Pontos', level: 'Nív.', best: 'Recorde', win: 'TODAS AS BAIAS CHEIAS!', gameover: 'SHURUP SEM ENERGIA',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
    title: 'BEETLEFORD', subtitle: 'Shurup, o besouro entregador · rua e canal · 10 turnos',
    back: 'Catálogo', lives: 'Vidas', time: 'Tempo',
    ready: 'TURNO', readySub: 'Entregue peças nas 5 baias do armazém',
    clear: 'ARMAZÉM CHEIO', bonus: 'Bônus', lost: 'PERDA', next: 'Próximo turno',
    d_water: 'Afundou no canal', d_edge: 'Levado pela correnteza', d_car: 'Atropelado', d_spider: 'Pego pela aranha',
    d_fish: 'Abocanhado pelo bagre', d_wall: 'Bateu no muro', d_trap: 'Baia com armadilha', d_time: 'Tempo esgotado',
    t_bay: 'ENTREGUE', t_prize: 'PEÇA-PRÊMIO', t_mate: 'ARRUELA EM CASA', t_pickup: 'ARRUELA A BORDO', t_extra: '+1 VIDA',
    t_trap: 'ARMADILHA!',
    lv_1: 'Manhã', lv_2: 'Troca de turno', lv_3: 'Aranha no barranco', lv_4: 'Armadilhas', lv_5: 'Bagre no canal',
    lv_6: 'Cheia', lv_7: 'Corrida de caminhões', lv_8: 'Duas aranhas', lv_9: 'Turno da noite', lv_10: 'Correria',
    cardNext: 'espaço / toque — seguir', rwLife: 'Anúncio: +1 vida',
    hint: '←↑→↓ / WASD — pular · deslize ou botões · P — pausa',
    foot: '<b>BEETLEFORD</b> · ←↑→↓ / WASD — pulo de uma casa · deslize ou use os botões · P/Esc — pausa · L idioma, T tema, M som.'
  };
})(typeof window !== 'undefined' ? window : globalThis);
