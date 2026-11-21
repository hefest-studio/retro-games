/* ОТГОН · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — ОТГОН, EN/TR/ES/PT — WINDSHANKS). OTGON.STR — таблицы для Arcade.createGame({strings}).
   В самой игре слов нет — только пиктограммы; строки нужны меню, паузе, ночёвке, финалу и подписи под канвой. */
(function (global) {
  'use strict';
  var O = global.OTGON = global.OTGON || {};
  O.STR = {
    ru: {
      play: 'Новый путь', cont: 'Продолжить путь', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Довёл', best: 'Рекорд', win: 'ЛЕТНЕЕ ПАСТБИЩЕ', gameover: 'СТАДО РАЗБРЕЛОСЬ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ОТГОН', subtitle: 'Стадо ветроногов через северные перевалы',
      legPick: 'Участок', rwBack: 'Реклама: вернуть отбившегося', starNew: 'новый рекорд звёзд!', starsHint: '★ дойти · ★ без потерь · ★ всё стадо цело',
      back: 'Каталог', leg: 'участок', camp: 'НОЧЁВКА', home: 'дошли', of: 'из',
      campHint: '◀ ▶ — выбрать · ▲ ▼ — сменить метку · Enter / тап по костру — в путь',
      hint: 'Стрелки/WASD: идти · Shift: бег · Пробел: свист · E: посох · P: пауза · T: тема · L: язык',
      hintTouch: 'Палец по экрану или ◀▲▼▶: идти · »: бег · ♪: свист · ⚑: посох · II: пауза',
      campHintTouch: 'Тап по ветроногу — выбрать, ещё тап — сменить метку · ♪ или тап по костру — в путь',
      foot: 'Веди стадо ветроногов подпаском: иди сзади — они пойдут от тебя; свист собирает и успокаивает, посох направляет и отгоняет птиц. Трава и вода — привал. У костра — ночёвка.'
    },
    en: {
      play: 'New journey', cont: 'Continue journey', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Brought home', best: 'Best', win: 'SUMMER PASTURE', gameover: 'THE HERD SCATTERED',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'WINDSHANKS', subtitle: 'A herd of stilt-legged woollies across the northern passes',
      legPick: 'Leg', rwBack: 'Watch ad: bring a stray back', starNew: 'new star record!', starsHint: '★ arrive · ★ no losses · ★ whole herd',
      back: 'Catalog', leg: 'leg', camp: 'NIGHT CAMP', home: 'made it', of: 'of',
      campHint: '◀ ▶ — select · ▲ ▼ — change mark · Enter / tap the fire — move on',
      hint: 'Arrows/WASD: walk · Shift: run · Space: whistle · E: staff · P: pause · T: theme · L: language',
      hintTouch: 'Finger on the screen or ◀▲▼▶: walk · »: run · ♪: whistle · ⚑: staff · II: pause',
      campHintTouch: 'Tap a windshank to select, tap again to change its mark · ♪ or tap the fire — move on',
      foot: 'Drive the windshank herd as the workshop\'s herd-boy: walk behind and they move away from you; the whistle gathers and calms, the staff points the way and shoos birds. Grass and water mean rest. The campfire means a night camp.'
    }
  };

  O.STR.tr = {
    play: 'Yeni yolculuk', cont: 'Yolculuğa devam', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Varan', best: 'Rekor', win: 'YAZ OTLAĞI', gameover: 'SÜRÜ DAĞILDI',
    pause: 'DURAKLATILDI', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
    title: 'WINDSHANKS', subtitle: 'Uzun bacaklı yünlü sürü kuzey geçitlerinden geçiyor',
    legPick: 'Etap', rwBack: 'Reklam: kaçanı geri getir', starNew: 'yeni yıldız rekoru!', starsHint: '★ ulaş · ★ kayıpsız · ★ sürü eksiksiz',
    back: 'Katalog', leg: 'etap', camp: 'GECE KAMPI', home: 'vardı', of: '/',
    campHint: '◀ ▶ — seç · ▲ ▼ — işareti değiştir · Enter / ateşe dokun — yola çık',
    hint: 'Oklar/WASD: yürü · Shift: koş · Boşluk: ıslık · E: değnek · P: duraklat · T: tema · L: dil',
    hintTouch: 'Ekranda parmak veya ◀▲▼▶: yürü · »: koş · ♪: ıslık · ⚑: değnek · II: duraklat',
    campHintTouch: 'Seçmek için hayvana dokun, işaretini değiştirmek için tekrar dokun · ♪ veya ateşe dokun — yola çık',
    foot: 'Atölyenin çoban çırağı olarak sürüyü güt: arkadan yürü, senden uzaklaşırlar; ıslık toplar ve sakinleştirir, değnek yön gösterir ve kuşları kovar. Ot ve su — mola. Kamp ateşi — gece konaklaması.'
  };
  O.STR.es = {
    play: 'Nuevo viaje', cont: 'Seguir el viaje', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Llegaron', best: 'Récord', win: 'PASTO DE VERANO', gameover: 'EL REBAÑO SE DISPERSÓ',
    pause: 'PAUSA', resume: 'Seguir', menu: 'Menú', tapstart: 'espacio / toca',
    title: 'WINDSHANKS', subtitle: 'Un rebaño de lanudos zancudos por los pasos del norte',
    legPick: 'Tramo', rwBack: 'Anuncio: traer a un perdido', starNew: '¡nuevo récord de estrellas!', starsHint: '★ llegar · ★ sin pérdidas · ★ rebaño entero',
    back: 'Catálogo', leg: 'tramo', camp: 'CAMPAMENTO', home: 'llegaron', of: 'de',
    campHint: '◀ ▶ — elegir · ▲ ▼ — cambiar marca · Enter / toca la hoguera — seguir',
    hint: 'Flechas/WASD: andar · Shift: correr · Espacio: silbar · E: cayado · P: pausa · T: tema · L: idioma',
    hintTouch: 'Dedo en la pantalla o ◀▲▼▶: andar · »: correr · ♪: silbar · ⚑: cayado · II: pausa',
    campHintTouch: 'Toca un animal para elegirlo y otra vez para cambiar su marca · ♪ o toca la hoguera — seguir',
    foot: 'Guía al rebaño como el pastorcillo del taller: camina detrás y se alejarán de ti; el silbido los reúne y calma, el cayado marca el rumbo y espanta a las aves. Hierba y agua: descanso. La hoguera: noche de campamento.'
  };
  O.STR.pt = {
    play: 'Nova jornada', cont: 'Continuar a jornada', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Chegaram', best: 'Recorde', win: 'PASTO DE VERÃO', gameover: 'O REBANHO SE DISPERSOU',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
    title: 'WINDSHANKS', subtitle: 'Um rebanho de lanudos pernaltas pelos passos do norte',
    legPick: 'Trecho', rwBack: 'Anúncio: trazer um perdido', starNew: 'novo recorde de estrelas!', starsHint: '★ chegar · ★ sem perdas · ★ rebanho inteiro',
    back: 'Catálogo', leg: 'trecho', camp: 'ACAMPAMENTO', home: 'chegaram', of: 'de',
    campHint: '◀ ▶ — escolher · ▲ ▼ — trocar marca · Enter / toque na fogueira — seguir',
    hint: 'Setas/WASD: andar · Shift: correr · Espaço: assobiar · E: cajado · P: pausa · T: tema · L: idioma',
    hintTouch: 'Dedo na tela ou ◀▲▼▶: andar · »: correr · ♪: assobiar · ⚑: cajado · II: pausa',
    campHintTouch: 'Toque num animal para escolher e de novo para trocar a marca · ♪ ou toque na fogueira — seguir',
    foot: 'Conduza o rebanho como o pastorzinho da oficina: ande atrás e eles se afastam de você; o assobio reúne e acalma, o cajado aponta o caminho e espanta as aves. Capim e água: descanso. A fogueira: noite de acampamento.'
  };
})(typeof window !== 'undefined' ? window : globalThis);
