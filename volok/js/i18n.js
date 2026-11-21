/* ВОЛОК · i18n (RU/EN/TR/ES/PT — движок v2.8 берёт языки из ключей strings; название: RU — ВОЛОК, EN/TR/ES/PT — KETTLEWAKE). VOLOK.STR — таблицы для Arcade.createGame({strings}).
   В самой игре слов нет — только пиктограммы; строки нужны меню, паузе, финалу и подписи под канвой. */
(function (global) {
  'use strict';
  var V = global.VOLOK = global.VOLOK || {};
  V.STR = {
    ru: {
      play: 'Новый путь', cont: 'Продолжить путь', language: 'Язык', theme: 'Тема', sound: 'Звук', on: 'вкл', off: 'выкл',
      score: 'Путь', best: 'Рекорд', win: 'ЗИМОВЬЕ', gameover: 'АВАРИЯ',
      pause: 'ПАУЗА', resume: 'Продолжить', menu: 'В меню', tapstart: 'пробел / тап',
      title: 'ВОЛОК', subtitle: 'Изба-мастерская на колёсах и на воде',
      back: 'Каталог', sec: 'участок',
      secPick: 'Участок', secDone: 'УЧАСТОК', starNew: 'новый рекорд звёзд!', starsHint: '★ пройти · ★ без аварий · ★ без пожара',
      cardNext: 'пробел / тап — дальше в путь', rwHere: 'Реклама: починиться на месте', rwFix: 'Реклама: корпус и полный бункер',
      hintTouch: 'Тап по месту в избе — подмастерье идёт и делает дело · ◀▲▼▶ — ход · ✋ — действие · II — пауза',
      hint: 'Стрелки/WASD: ход и лестницы · Пробел/E: действие (держать) · Тап по месту в избе · P: пауза · T: тема · L: язык',
      foot: 'Веди избу-мастерскую подмастерьем изнутри: дрова в топку, клапан при перегреве, рычаг хода, парус по ветру, лебёдка у преград, заплатки с верстака. На берегу изба станет судном.'
    },
    en: {
      play: 'New journey', cont: 'Continue journey', language: 'Language', theme: 'Theme', sound: 'Sound', on: 'on', off: 'off',
      score: 'Journey', best: 'Best', win: 'WINTER CAMP', gameover: 'WRECKED',
      pause: 'PAUSE', resume: 'Resume', menu: 'Menu', tapstart: 'space / tap',
      title: 'KETTLEWAKE', subtitle: 'A workshop hut on wheels — and on water',
      back: 'Catalog', sec: 'leg',
      secPick: 'Leg', secDone: 'LEG', starNew: 'new star record!', starsHint: '★ pass · ★ no wrecks · ★ no fire',
      cardNext: 'space / tap — on with the journey', rwHere: 'Watch ad: repair on the spot', rwFix: 'Watch ad: hull and full bunker',
      hintTouch: 'Tap a spot in the hut — the apprentice goes and does the job · ◀▲▼▶ — walk · ✋ — act · II — pause',
      hint: 'Arrows/WASD: walk & ladders · Space/E: act (hold) · Tap a spot in the hut · P: pause · T: theme · L: language',
      foot: 'Run the workshop hut from inside as the apprentice: logs into the firebox, the valve when it overheats, the drive lever, the sail with the wind, the winch at obstacles, patches from the workbench. At the shore the hut turns into a boat.'
    }
  };
  V.STR.tr = {
    play: 'Yeni yolculuk', cont: 'Yolculuğa devam', language: 'Dil', theme: 'Tema', sound: 'Ses', on: 'açık', off: 'kapalı',
    score: 'Yol', best: 'Rekor', win: 'KIŞLAK', gameover: 'KAZA',
    pause: 'DURAKLATILDI', resume: 'Devam', menu: 'Menü', tapstart: 'boşluk / dokun',
    title: 'KETTLEWAKE', subtitle: 'Tekerlekli — ve suda yüzen — atölye kulübesi',
    back: 'Katalog', sec: 'etap',
    secPick: 'Etap', secDone: 'ETAP', starNew: 'yeni yıldız rekoru!', starsHint: '★ geç · ★ kazasız · ★ yangınsız',
    cardNext: 'boşluk / dokun — yola devam', rwHere: 'Reklam: yerinde onar', rwFix: 'Reklam: gövde ve dolu bunker',
    hintTouch: 'Kulübede bir yere dokun — çırak gidip işi yapar · ◀▲▼▶ — yürü · ✋ — eylem · II — duraklat',
    hint: 'Oklar/WASD: yürü ve merdiven · Boşluk/E: eylem (basılı tut) · Kulübede bir yere dokun · P: duraklat · T: tema · L: dil',
    foot: 'Atölye kulübesini içeriden çırak olarak yönet: odunlar ocağa, aşırı ısınınca vana, yürüyüş kolu, rüzgârla yelken, engellerde vinç, tezgâhtan yamalar. Kıyıda kulübe tekneye dönüşür.'
  };
  V.STR.es = {
    play: 'Nuevo viaje', cont: 'Seguir el viaje', language: 'Idioma', theme: 'Tema', sound: 'Sonido', on: 'sí', off: 'no',
    score: 'Camino', best: 'Récord', win: 'REFUGIO DE INVIERNO', gameover: 'AVERÍA',
    pause: 'PAUSA', resume: 'Seguir', menu: 'Menú', tapstart: 'espacio / toca',
    title: 'KETTLEWAKE', subtitle: 'Una cabaña taller sobre ruedas — y sobre el agua',
    back: 'Catálogo', sec: 'tramo',
    secPick: 'Tramo', secDone: 'TRAMO', starNew: '¡nuevo récord de estrellas!', starsHint: '★ pasar · ★ sin averías · ★ sin fuego',
    cardNext: 'espacio / toca — seguir el viaje', rwHere: 'Anuncio: reparar aquí mismo', rwFix: 'Anuncio: casco y búnker lleno',
    hintTouch: 'Toca un sitio de la cabaña — el aprendiz va y hace el trabajo · ◀▲▼▶ — andar · ✋ — acción · II — pausa',
    hint: 'Flechas/WASD: andar y escaleras · Espacio/E: acción (mantener) · Toca un sitio de la cabaña · P: pausa · T: tema · L: idioma',
    foot: 'Lleva la cabaña taller desde dentro como el aprendiz: leña al hogar, la válvula si se recalienta, la palanca de marcha, la vela con el viento, el torno ante los obstáculos, parches del banco. En la orilla la cabaña se vuelve barco.'
  };
  V.STR.pt = {
    play: 'Nova jornada', cont: 'Continuar a jornada', language: 'Idioma', theme: 'Tema', sound: 'Som', on: 'lig.', off: 'desl.',
    score: 'Caminho', best: 'Recorde', win: 'ABRIGO DE INVERNO', gameover: 'AVARIA',
    pause: 'PAUSA', resume: 'Continuar', menu: 'Menu', tapstart: 'espaço / toque',
    title: 'KETTLEWAKE', subtitle: 'Uma cabana oficina sobre rodas — e sobre a água',
    back: 'Catálogo', sec: 'trecho',
    secPick: 'Trecho', secDone: 'TRECHO', starNew: 'novo recorde de estrelas!', starsHint: '★ passar · ★ sem avarias · ★ sem fogo',
    cardNext: 'espaço / toque — seguir viagem', rwHere: 'Anúncio: consertar aqui mesmo', rwFix: 'Anúncio: casco e depósito cheio',
    hintTouch: 'Toque num ponto da cabana — o aprendiz vai e faz o serviço · ◀▲▼▶ — andar · ✋ — ação · II — pausa',
    hint: 'Setas/WASD: andar e escadas · Espaço/E: ação (segurar) · Toque num ponto da cabana · P: pausa · T: tema · L: idioma',
    foot: 'Conduza a cabana oficina por dentro como o aprendiz: lenha na fornalha, a válvula se superaquecer, a alavanca de marcha, a vela com o vento, o guincho nos obstáculos, remendos da bancada. Na margem a cabana vira barco.'
  };
})(typeof window !== 'undefined' ? window : globalThis);
