/* КОРОМЫСЛО · строки RU/EN/TR/ES/PT (движок v2.8 берёт языки из ключей strings). Название: RU — КОРОМЫСЛО, EN/TR/ES/PT — POISEWRIGHT
   (одно имя внутри языка, Яндекс 5.1.3). Ключи play/language/theme/… — для стандартных экранов движка, остальные — игре.
   TR/ES/PT — перевод ИИ по глоссарию tools/i18n-glossary.md; носитель не вычитывал. */
(function (global) {
  'use strict';
  var K = global.KOROMYSLO = global.KOROMYSLO || {};
  K.STR = {
    ru: {
      play: 'Играть', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Счёт', level: 'Уровень', best: 'Рекорд', win: 'ПОБЕДА!', gameover: 'КОРОМЫСЛО ОПРОКИНУТО',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'КОРОМЫСЛО', subtitle: 'Уравновесь чаши · равный вес напротив — пара снята',
      back: 'Каталог', lives: 'Жизни',
      daily: 'Вызов дня', dailyBest: 'Рекорд дня', dailyNew: 'Новый рекорд дня!', streak: 'Серия дней', dayTag: 'ВЫЗОВ',
      lb: 'Лидеры', lbAll: 'Рекорды', rwLife: 'Реклама: +1 жизнь',
      levelUp: 'УРОВЕНЬ', cardNext: 'пробел / тап — дальше', combo: 'КОМБО', even: 'РАВНОВЕСИЕ', tip: 'ПЕРЕВЕС!', jam: 'НЕКУДА!',
      tut1: 'Тапни по чаше — гирька упадёт туда', tut2: 'Равный вес напротив — пара снята', tut3: 'Не перевешивай: стрелка в красном — чаша опрокинется',
      hint: '← → — чаша · Пробел — бросить · P — пауза', hintTouch: 'Тапни по чаше — бросить · II — пауза',
      foot: '<b>КОРОМЫСЛО</b> · тап / клик по чаше или ← → и пробел — бросить гирьку · P / Esc — пауза · L язык, T тема, M звук.'
    },
    en: {
      play: 'Play', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Score', level: 'Level', best: 'Best', win: 'YOU WIN!', gameover: 'THE BEAM TIPPED OVER',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'POISEWRIGHT', subtitle: 'Balance the pans · equal weight opposite clears the pair',
      back: 'Catalog', lives: 'Lives',
      daily: 'Daily challenge', dailyBest: 'Daily best', dailyNew: 'New daily best!', streak: 'Day streak', dayTag: 'DAILY',
      lb: 'Leaderboard', lbAll: 'All-time best', rwLife: 'Watch ad: +1 life',
      levelUp: 'LEVEL', cardNext: 'space / tap to continue', combo: 'COMBO', even: 'BALANCED', tip: 'TIPPED!', jam: 'NO ROOM!',
      tut1: 'Tap a pan to drop the weight there', tut2: 'Equal weight opposite clears the pair', tut3: 'Don’t overload: needle in the red tips a pan',
      hint: '← → pan · Space drop · P pause', hintTouch: 'Tap a pan to drop · II pause',
      foot: '<b>POISEWRIGHT</b> · tap / click a pan, or ← → and Space, to drop a weight · P / Esc pause · L language, T theme, M sound.'
    },
    tr: {
      play: 'Oyna', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
      score: 'Puan', level: 'Seviye', best: 'Rekor', win: 'KAZANDIN!', gameover: 'TERAZİ DEVRİLDİ',
      pause: 'DURAKLATILDI', resume: 'Devam et', menu: 'Ana menü', tapstart: 'boşluk / dokun',
      title: 'POISEWRIGHT', subtitle: 'Kefeleri dengele · karşıda eşit ağırlık çifti siler',
      back: 'Katalog', lives: 'Can',
      daily: 'Günlük mücadele', dailyBest: 'Günün rekoru', dailyNew: 'Yeni günlük rekor!', streak: 'Gün serisi', dayTag: 'GÜNLÜK',
      lb: 'Liderler', lbAll: 'Tüm zamanlar', rwLife: 'Reklam: +1 can',
      levelUp: 'SEVİYE', cardNext: 'boşluk / dokun — devam', combo: 'KOMBO', even: 'DENGEDE', tip: 'DEVRİLDİ!', jam: 'YER YOK!',
      tut1: 'Bir kefeye dokun — ağırlık oraya düşer', tut2: 'Karşıda eşit ağırlık çifti siler', tut3: 'Fazla yükleme: ibre kırmızıda kefe devrilir',
      hint: '← → kefe · Boşluk bırak · P duraklat', hintTouch: 'Kefeye dokun — bırak · II duraklat',
      foot: '<b>POISEWRIGHT</b> · kefeye dokun / tıkla ya da ← → ve Boşluk — ağırlık bırak · P / Esc duraklat · L dil, T tema, M ses.'
    },
    es: {
      play: 'Jugar', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
      score: 'Puntos', level: 'Nivel', best: 'Récord', win: '¡VICTORIA!', gameover: 'LA BALANZA SE VOLCÓ',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menú principal', tapstart: 'espacio / toca',
      title: 'POISEWRIGHT', subtitle: 'Equilibra los platillos · igual peso enfrente borra el par',
      back: 'Catálogo', lives: 'Vidas',
      daily: 'Reto diario', dailyBest: 'Récord del día', dailyNew: '¡Nuevo récord del día!', streak: 'Días seguidos', dayTag: 'RETO',
      lb: 'Clasificación', lbAll: 'Récord histórico', rwLife: 'Anuncio: +1 vida',
      levelUp: 'NIVEL', cardNext: 'espacio / toca — seguir', combo: 'COMBO', even: 'EQUILIBRIO', tip: '¡VUELCO!', jam: '¡SIN SITIO!',
      tut1: 'Toca un platillo y la pesa caerá ahí', tut2: 'Igual peso enfrente borra el par', tut3: 'No sobrecargues: aguja en rojo vuelca un platillo',
      hint: '← → platillo · Espacio soltar · P pausa', hintTouch: 'Toca un platillo para soltar · II pausa',
      foot: '<b>POISEWRIGHT</b> · toca / pulsa un platillo, o ← → y Espacio, para soltar una pesa · P / Esc pausa · L idioma, T tema, M sonido.'
    },
    pt: {
      play: 'Jogar', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
      score: 'Pontos', level: 'Nível', best: 'Recorde', win: 'VITÓRIA!', gameover: 'A BALANÇA TOMBOU',
      pause: 'PAUSA', resume: 'Continuar', menu: 'Menu principal', tapstart: 'espaço / toque',
      title: 'POISEWRIGHT', subtitle: 'Equilibre os pratos · peso igual em frente limpa o par',
      back: 'Catálogo', lives: 'Vidas',
      daily: 'Desafio diário', dailyBest: 'Recorde do dia', dailyNew: 'Novo recorde do dia!', streak: 'Dias seguidos', dayTag: 'DESAFIO',
      lb: 'Ranking', lbAll: 'Recorde geral', rwLife: 'Anúncio: +1 vida',
      levelUp: 'NÍVEL', cardNext: 'espaço / toque — seguir', combo: 'COMBO', even: 'EQUILÍBRIO', tip: 'TOMBOU!', jam: 'SEM ESPAÇO!',
      tut1: 'Toque num prato e o peso cai lá', tut2: 'Peso igual em frente limpa o par', tut3: 'Não sobrecarregue: ponteiro no vermelho tomba um prato',
      hint: '← → prato · Espaço soltar · P pausa', hintTouch: 'Toque num prato para soltar · II pausa',
      foot: '<b>POISEWRIGHT</b> · toque / clique num prato, ou ← → e Espaço, para soltar um peso · P / Esc pausa · L idioma, T tema, M som.'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
