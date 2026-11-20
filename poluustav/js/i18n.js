/* ПОЛУУСТАВ · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — ПОЛУУСТАВ, EN/TR/ES/PT — GALLWICK). POLU.STR — таблицы для Arcade.createGame({strings}).
   В самой игре слов нет — только рисунки и пиктограммы; строки нужны меню, паузе, финалу и подписи под канвой. */
(function (global) {
  'use strict';
  var P = global.POLU = global.POLU || {};
  P.STR = {
    ru: {
      play: 'Новая рукопись', cont: 'Продолжить', restart: 'К последней отметке', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Оценка', best: 'Рекорд', win: 'КОЛОФОН', gameover: 'КЛЯКСА',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ПОЛУУСТАВ', subtitle: 'Ученик переписчика внутри рукописи',
      hint: '◀▶ / A D — идти · ▲ / W / пробел — прыжок · E / X — действие (держать — тянуть) · P — пауза · T — тема · L — язык',
      foot: 'Тихая сказка без слов: ученик переписчика бредёт по страницам старой рукописи. Ящики, верёвки, рычаги и противовесы, вода и тушь; песок сушит кляксы, перо дорисовывает мосты, наброски твердеют в свете лампады. Смерть — лишь клякса: сразу снова у отметки.',
      blots: 'кляксы', pages: 'страницы',
      pagePick: 'Страница', rwSkip: 'Реклама: перелистнуть страницу', starNew: 'новый рекорд звёзд!', starsHint: '★ пройти · ★ до 3 клякс · ★ без клякс'
    },
    en: {
      play: 'New manuscript', cont: 'Continue', restart: 'Back to last mark', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Grade', best: 'Best', win: 'COLOPHON', gameover: 'BLOT',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'GALLWICK', subtitle: 'A scribe’s apprentice within the manuscript',
      hint: '◀▶ / A D — walk · ▲ / W / space — jump · E / X — act (hold to pull) · P — pause · T — theme · L — language',
      foot: 'A quiet tale without words: a scribe’s apprentice wanders the pages of an old manuscript. Crates, ropes, levers and counterweights, water and ink; sand dries the blots, the quill draws bridges, sketches turn solid in the lamp’s light. Death is only a blot: you are back at the mark at once.',
      blots: 'blots', pages: 'pages',
      pagePick: 'Page', rwSkip: 'Watch ad: turn the page', starNew: 'new star record!', starsHint: '★ finish · ★ up to 3 blots · ★ no blots'
    }
  };

  P.STR.tr = {
    play: 'Yeni el yazması', cont: 'Devam', restart: 'Son işarete dön', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Not', best: 'Rekor', win: 'KOLOFON', gameover: 'MÜREKKEP LEKESİ',
    pause: 'DURAKLATILDI', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
    title: 'GALLWICK', subtitle: 'El yazmasının içinde bir kâtip çırağı',
    hint: '◀▶ / A D — yürü · ▲ / W / boşluk — zıpla · E / X — etkileşim (basılı tut — çek) · P — duraklat · T — tema · L — dil',
    foot: 'Sözsüz, sakin bir masal: bir kâtip çırağı eski bir el yazmasının sayfalarında dolaşır. Sandıklar, halatlar, kollar ve karşı ağırlıklar, su ve mürekkep; kum lekeleri kurutur, kalem köprüler çizer, eskizler kandil ışığında sertleşir. Ölüm sadece bir lekedir: hemen işarete dönersin.',
    blots: 'leke', pages: 'sayfa',
    pagePick: 'Sayfa', rwSkip: 'Reklam: sayfayı çevir', starNew: 'yeni yıldız rekoru!', starsHint: '★ bitir · ★ en çok 3 leke · ★ lekesiz'
  };
  P.STR.es = {
    play: 'Nuevo manuscrito', cont: 'Continuar', restart: 'A la última marca', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Nota', best: 'Récord', win: 'COLOFÓN', gameover: 'BORRÓN',
    pause: 'PAUSA', resume: 'Seguir', menu: 'Menú', tapstart: 'espacio / toca',
    title: 'GALLWICK', subtitle: 'Un aprendiz de copista dentro del manuscrito',
    hint: '◀▶ / A D — andar · ▲ / W / espacio — saltar · E / X — acción (mantén para tirar) · P — pausa · T — tema · L — idioma',
    foot: 'Un cuento tranquilo sin palabras: un aprendiz de copista recorre las páginas de un viejo manuscrito. Cajas, cuerdas, palancas y contrapesos, agua y tinta; la arena seca los borrones, la pluma dibuja puentes, los bocetos se vuelven sólidos a la luz de la lámpara. La muerte es solo un borrón: vuelves enseguida a la marca.',
    blots: 'borrones', pages: 'páginas',
    pagePick: 'Página', rwSkip: 'Anuncio: pasar la página', starNew: '¡nuevo récord de estrellas!', starsHint: '★ terminar · ★ hasta 3 borrones · ★ sin borrones'
  };
  P.STR.pt = {
    play: 'Novo manuscrito', cont: 'Continuar', restart: 'Voltar à última marca', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Nota', best: 'Recorde', win: 'CÓLOFON', gameover: 'BORRÃO',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
    title: 'GALLWICK', subtitle: 'Um aprendiz de copista dentro do manuscrito',
    hint: '◀▶ / A D — andar · ▲ / W / espaço — pular · E / X — ação (segure para puxar) · P — pausa · T — tema · L — idioma',
    foot: 'Um conto tranquilo sem palavras: um aprendiz de copista percorre as páginas de um velho manuscrito. Caixas, cordas, alavancas e contrapesos, água e tinta; a areia seca os borrões, a pena desenha pontes, os esboços ficam sólidos à luz da lamparina. A morte é só um borrão: você volta logo à marca.',
    blots: 'borrões', pages: 'páginas',
    pagePick: 'Página', rwSkip: 'Anúncio: virar a página', starNew: 'novo recorde de estrelas!', starsHint: '★ terminar · ★ até 3 borrões · ★ sem borrões'
  };
})(typeof window !== 'undefined' ? window : globalThis);
