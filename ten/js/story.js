/* ТЕНЬ · story.js — кат-сцены-комиксы между актами (свои рисованные слайды, текст RU/EN).
   TEN.STORY[i] — список панелей: 0 — вступление, 1..5 — после актов 1..5, 6 — финал.
   Панель: { art: имя картинки для render.js (TEN.R.art), ru, en }. */
(function (global) {
  'use strict';
  var TEN = global.TEN = global.TEN || {};
  TEN.STORY = [
    [
      { art: 'workshop', ru: 'Полночь. Мастерская «Гефест». Сейф вскрыт — пропали чертежи парового сердца, над которыми мастера работали три года.', en: 'Midnight at the Hephaestus workshop. The safe is open — the steam heart blueprints, three years of work, are gone.' },
      { art: 'clue', ru: 'На полу — ржавая заклёпка с клеймом в виде шестерни без зубца. Знак Ржавого Синдиката.', en: 'On the floor lies a rusty rivet stamped with a toothless gear. The mark of the Rust Syndicate.' },
      { art: 'hero', ru: 'Мастер зовёт разведчицу по прозвищу Тень: плащ, серп на тросе и крюк. «Верни чертежи. И не попадайся в свет».', en: 'The master calls the scout known as Shade: a cloak, a sickle on a line and a grapple. "Bring the blueprints back. And stay out of the light."' }
    ],
    [
      { art: 'fortress', ru: 'Крыши предместья позади. Впереди — цитадель Синдиката: трубы, прожекторы и стражи на каждой стене.', en: 'The outskirts are behind her. Ahead looms the Syndicate stronghold: chimneys, searchlights and a guard on every wall.' },
      { art: 'pipes', ru: 'Пленный механик шепчет: чертежи увезли вниз, в Котельную, — по трубопроводу, где не ходят люди.', en: 'A captive mechanic whispers: the blueprints went down to the Boiler Works, through pipes where no person walks.' }
    ],
    [
      { art: 'dock', ru: 'Котёл-Молот остыл. Но свёрток с чертежами уже грузят на дирижабль у причальных мачт.', en: 'The Boiler Hammer is cold. But the blueprint bundle is already being loaded onto an airship at the mooring masts.' },
      { art: 'hero', ru: 'Тень проверяет трос. До верфи — только по кольцам грузовых кранов, над пустотой.', en: 'Shade checks her line. The only way to the dock is along the crane rings, over the drop.' }
    ],
    [
      { art: 'airship', ru: 'Швартовы отданы. Тень цепляется крюком за якорный трос уходящего дирижабля.', en: 'The lines are cast off. Shade hooks onto the anchor line of the departing airship.' },
      { art: 'clouds', ru: 'Над облаками ветер рвёт плащ. На палубах — дроны-птицы и стрелки Синдиката.', en: 'Above the clouds the wind tears at her cloak. The decks crawl with bird drones and Syndicate gunners.' }
    ],
    [
      { art: 'archive', ru: 'Дирижабль причалил к цитадели. Чертежи заперли в Часовом архиве — там всё движется по часам.', en: 'The airship docks at the stronghold. The blueprints are locked in the Clockwork Archive, where everything moves on schedule.' },
      { art: 'gears', ru: 'Шестерни размером с дом, маятники-лезвия. Главное — поймать ритм.', en: 'Gears the size of houses, pendulum blades. The trick is to catch the rhythm.' }
    ],
    [
      { art: 'tower', ru: 'Свёрток в руках! Но из архива есть лишь один путь — наверх, сквозь Башню прожекторов.', en: 'The bundle is in her hands! But the only way out of the archive is up, through the Searchlight Tower.' },
      { art: 'chancellor', ru: 'На вершине ждёт глава Синдиката — Канцлер Ржавь. Его глаз-прожектор видит всё.', en: 'At the top waits the head of the Syndicate — Chancellor Rust. His searchlight eye sees everything.' }
    ],
    [
      { art: 'fall', ru: 'Канцлер повержен. Прожекторы цитадели гаснут один за другим.', en: 'The Chancellor falls. One by one, the stronghold searchlights go dark.' },
      { art: 'dawn', ru: 'На рассвете чертежи лежат на верстаке мастерской. А Тень уже растворилась в утреннем тумане.', en: 'At dawn the blueprints lie on the workshop bench. And Shade has already vanished into the morning mist.' }
    ]
  ];
})(typeof window !== 'undefined' ? window : globalThis);
