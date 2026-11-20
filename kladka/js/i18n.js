/* КЛАДКА · i18n (RU/EN/TR/ES/PT). KLADKA.STR — таблицы для Arcade.createGame({strings}).
   Ключи play/language/theme/... нужны стандартным экранам движка; остальные — игре. */
(function (global) {
  'use strict';
  var K = global.KLADKA = global.KLADKA || {};
  K.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Ур.', best: 'Рекорд', win: 'ПЛАВИЛЬНЯ ПОГАШЕНА!', gameover: 'КЛАДКА УСТОЯЛА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'КЛАДКА', subtitle: 'Разбери кладку · 10 уровней · сердце печи',
      back: 'Каталог', lives: 'Жизни',
      ready: 'УРОВЕНЬ', launch: 'Пробел / клик — пуск ядра', bossSub: 'Бей ядром в сердце печи, береги мастерок от искр',
      clear: 'КЛАДКА РАЗОБРАНА', bonus: 'Бонус', lost: 'ЯДРО ПОТЕРЯНО', heart: 'Сердце печи', draft: 'ТЯГА ПЕЧИ',
      lv_base: 'Фундамент', lv_arch: 'Арка', lv_checker: 'Шахматка', lv_gates: 'Ворота', lv_flue: 'Дымоход',
      lv_stairs: 'Лестница', lv_grate: 'Решётка', lv_bastion: 'Бастион', lv_hearth: 'Горн', lv_smelter: 'Плавильня',
      pw_wide: 'РАЗМАХ', pw_narrow: 'ТЕСНОТА', pw_triple: 'ТРОЙНЯ', pw_glue: 'СМОЛА', pw_cutter: 'РЕЗАК', pw_chill: 'ОСТУДА', pw_life: 'ЗАПАС',
      hint: 'Мышь / ← → — мастерок · Пробел — пуск и резак · P — пауза',
      nextLevel: 'Пробел / тап — дальше', revived: 'ЕЩЁ ОДНО ЯДРО', rwLife: 'Реклама: +1 ядро',
      lvPick: 'Уровень', unlockedLv: 'Открыто', st_clear: 'Кладка разобрана', st_safe: 'Без потери ядра', st_fast: 'Быстрее {n} с', opened: 'ОТКРЫТ УРОВЕНЬ {n}',
      foot: '<b>КЛАДКА</b> · мышь, палец или ← → / A D — мастерок · Пробел / клик / тап — пуск ядра и резак · P — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Lvl', best: 'Best', win: 'SMELTER QUENCHED!', gameover: 'THE WALL STANDS',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'MASONRY', subtitle: 'Break the masonry · 10 levels · furnace heart',
      back: 'Catalog', lives: 'Lives',
      ready: 'LEVEL', launch: 'Space / click — launch the core', bossSub: 'Hit the furnace heart, keep the trowel clear of sparks',
      clear: 'WALL TORN DOWN', bonus: 'Bonus', lost: 'CORE LOST', heart: 'Furnace heart', draft: 'FURNACE DRAFT',
      lv_base: 'Foundation', lv_arch: 'Arch', lv_checker: 'Checkerboard', lv_gates: 'Gates', lv_flue: 'Flue',
      lv_stairs: 'Staircase', lv_grate: 'Grate', lv_bastion: 'Bastion', lv_hearth: 'Hearth', lv_smelter: 'Smelter',
      pw_wide: 'SPAN', pw_narrow: 'PINCH', pw_triple: 'TRIPLET', pw_glue: 'RESIN', pw_cutter: 'CUTTER', pw_chill: 'CHILL', pw_life: 'SPARE',
      hint: 'Mouse / ← → — trowel · Space — launch & cutter · P — pause',
      nextLevel: 'Space / tap — continue', revived: 'ONE MORE CORE', rwLife: 'Watch ad: +1 core',
      lvPick: 'Level', unlockedLv: 'Unlocked', st_clear: 'Wall torn down', st_safe: 'No core lost', st_fast: 'Under {n} s', opened: 'LEVEL {n} UNLOCKED',
      foot: '<b>MASONRY</b> · mouse, finger or ← → / A D — trowel · Space / click / tap — launch the core & fire the cutter · P — pause · L language, T theme, M sound.'
    },
    // TR / ES / PT-BR — перевод ИИ, вычитан обратным переводом и вторым проходом; носитель языка НЕ проверял. Название внутри языка
    // одно (Яндекс 5.1.3): в TR/ES/PT — EN-название MASONRY (README, «Языки»). Строки движка (реклама за награду, загрузка) — в движке v2.8.
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
      score: 'Puan', level: 'Sv.', best: 'Rekor', win: 'FIRIN SÖNDÜRÜLDÜ!', gameover: 'DUVAR AYAKTA KALDI',
      pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
      title: 'MASONRY', subtitle: 'Duvarı yık · 10 seviye · fırının kalbi',
      back: 'Katalog', lives: 'Canlar',
      ready: 'SEVİYE', launch: 'Boşluk / tıkla — çekirdeği fırlat', bossSub: 'Fırının kalbine vur, malayı kıvılcımlardan koru',
      clear: 'DUVAR YIKILDI', bonus: 'Bonus', lost: 'ÇEKİRDEK KAYBOLDU', heart: 'Fırının kalbi', draft: 'FIRIN ÇEKİŞİ',
      lv_base: 'Temel', lv_arch: 'Kemer', lv_checker: 'Dama', lv_gates: 'Kapılar', lv_flue: 'Baca',
      lv_stairs: 'Merdiven', lv_grate: 'Izgara', lv_bastion: 'Burç', lv_hearth: 'Ocak', lv_smelter: 'Ergitme fırını',
      pw_wide: 'GENİŞLİK', pw_narrow: 'DARLIK', pw_triple: 'ÜÇLÜ', pw_glue: 'REÇİNE', pw_cutter: 'KESİCİ', pw_chill: 'SOĞUTMA', pw_life: 'YEDEK',
      hint: 'Fare / ← → — mala · Boşluk — fırlat ve kesici · P — duraklat',
      nextLevel: 'Boşluk / dokun — devam', revived: 'BİR ÇEKİRDEK DAHA', rwLife: 'Reklam: +1 çekirdek',
      lvPick: 'Seviye', unlockedLv: 'Açık', st_clear: 'Duvar yıkıldı', st_safe: 'Çekirdek kaybı yok', st_fast: '{n} sn altında', opened: 'SEVİYE {n} AÇILDI',
      foot: '<b>MASONRY</b> · fare, parmak veya ← → / A D — mala · Boşluk / tıklama / dokunma — çekirdeği fırlat ve kesiciyi ateşle · P — duraklat · L dil, T tema, M ses.'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
      score: 'Puntos', level: 'Niv.', best: 'Récord', win: '¡FUNDICIÓN APAGADA!', gameover: 'EL MURO RESISTE',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
      title: 'MASONRY', subtitle: 'Derriba el muro · 10 niveles · corazón del horno',
      back: 'Catálogo', lives: 'Vidas',
      ready: 'NIVEL', launch: 'Espacio / clic — lanza el núcleo', bossSub: 'Golpea el corazón del horno, protege la llana de las chispas',
      clear: 'MURO DERRIBADO', bonus: 'Bonus', lost: 'NÚCLEO PERDIDO', heart: 'Corazón del horno', draft: 'TIRO DEL HORNO',
      lv_base: 'Cimientos', lv_arch: 'Arco', lv_checker: 'Damero', lv_gates: 'Puertas', lv_flue: 'Chimenea',
      lv_stairs: 'Escalera', lv_grate: 'Rejilla', lv_bastion: 'Bastión', lv_hearth: 'Fragua', lv_smelter: 'Fundición',
      pw_wide: 'AMPLITUD', pw_narrow: 'ESTRECHEZ', pw_triple: 'TRIPLE', pw_glue: 'RESINA', pw_cutter: 'CORTADOR', pw_chill: 'FRÍO', pw_life: 'REPUESTO',
      hint: 'Ratón / ← → — llana · Espacio — lanzar y cortador · P — pausa',
      nextLevel: 'Espacio / toca — seguir', revived: 'UN NÚCLEO MÁS', rwLife: 'Anuncio: +1 núcleo',
      lvPick: 'Nivel', unlockedLv: 'Abiertos', st_clear: 'Muro derribado', st_safe: 'Sin perder núcleo', st_fast: 'En menos de {n} s', opened: 'NIVEL {n} DESBLOQUEADO',
      foot: '<b>MASONRY</b> · ratón, dedo o ← → / A D — llana · Espacio / clic / toque — lanza el núcleo y dispara el cortador · P — pausa · L idioma, T tema, M sonido.'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'ligado', off: 'desligado',
      score: 'Pontos', level: 'Fase', best: 'Recorde', win: 'FUNDIÇÃO APAGADA!', gameover: 'O MURO RESISTIU',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
      title: 'MASONRY', subtitle: 'Derrube o muro · 10 fases · coração da fornalha',
      back: 'Catálogo', lives: 'Vidas',
      ready: 'FASE', launch: 'Espaço / clique — lance o núcleo', bossSub: 'Acerte o coração da fornalha, proteja a colher das faíscas',
      clear: 'MURO DERRUBADO', bonus: 'Bônus', lost: 'NÚCLEO PERDIDO', heart: 'Coração da fornalha', draft: 'TIRAGEM DA FORNALHA',
      lv_base: 'Alicerce', lv_arch: 'Arco', lv_checker: 'Xadrez', lv_gates: 'Portões', lv_flue: 'Chaminé',
      lv_stairs: 'Escada', lv_grate: 'Grelha', lv_bastion: 'Bastião', lv_hearth: 'Forja', lv_smelter: 'Fundição',
      pw_wide: 'AMPLO', pw_narrow: 'ESTREITO', pw_triple: 'TRIPLO', pw_glue: 'RESINA', pw_cutter: 'CORTADOR', pw_chill: 'FRIO', pw_life: 'RESERVA',
      hint: 'Mouse / ← → — colher de pedreiro · Espaço — lançar e cortador · P — pausa',
      nextLevel: 'Espaço / toque — continuar', revived: 'MAIS UM NÚCLEO', rwLife: 'Anúncio: +1 núcleo',
      lvPick: 'Fase', unlockedLv: 'Liberadas', st_clear: 'Muro derrubado', st_safe: 'Sem perder núcleo', st_fast: 'Em menos de {n} s', opened: 'FASE {n} LIBERADA',
      foot: '<b>MASONRY</b> · mouse, dedo ou ← → / A D — colher de pedreiro · Espaço / clique / toque — lança o núcleo e dispara o cortador · P — pausa · L idioma, T tema, M som.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
