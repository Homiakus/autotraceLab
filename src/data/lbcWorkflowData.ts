export type LbcAutomationKind = 'manual' | 'automatic' | 'mixed' | 'wait' | 'external' | 'qc';
export type LbcEvidenceLevel = 'manufacturer' | 'official-register' | 'publication' | 'secondary' | 'lab-estimate' | 'not-published';

export type LbcPhaseId =
  | 'receipt'
  | 'loading'
  | 'conditioning'
  | 'enrichment'
  | 'slide'
  | 'fixation'
  | 'staining'
  | 'finish';

export interface LbcStage {
  phase: LbcPhaseId;
  title: string;
  description: string;
  automation: LbcAutomationKind;
  time: string;
  evidence: LbcEvidenceLevel;
  operator?: string;
  machine?: string;
  note?: string;
  sourceUrl?: string;
}

export interface LbcPlatform {
  id: string;
  vendor: string;
  name: string;
  family: string;
  principle: string;
  totalTime: string;
  throughput: string;
  staining: 'integrated' | 'external' | 'optional';
  registrationRu?: string;
  regulatoryNote?: string;
  imageUrl?: string;
  imageAlt?: string;
  sourcePage?: string;
  stages: LbcStage[];
}

export const LBC_PHASES: Array<{ id: LbcPhaseId; short: string; title: string }> = [
  { id: 'receipt', short: '01', title: 'Приём и идентификация' },
  { id: 'loading', short: '02', title: 'Загрузка / подготовка партии' },
  { id: 'conditioning', short: '03', title: 'Диспергирование / подготовка суспензии' },
  { id: 'enrichment', short: '04', title: 'Очистка / обогащение клеток' },
  { id: 'slide', short: '05', title: 'Формирование клеточного пятна' },
  { id: 'fixation', short: '06', title: 'Фиксация' },
  { id: 'staining', short: '07', title: 'Окраска по Папаниколау' },
  { id: 'finish', short: '08', title: 'Заключение, QC и выдача стекла' },
];

export const LBC_AUTOMATION_COLORS: Record<LbcAutomationKind, string> = {
  manual: '#F59E0B',
  automatic: '#10B981',
  mixed: '#8B5CF6',
  wait: '#3B82F6',
  external: '#06B6D4',
  qc: '#EF4444',
};

export const LBC_AUTOMATION_LABELS: Record<LbcAutomationKind, string> = {
  manual: 'РУЧНО',
  automatic: 'АВТО',
  mixed: 'СМЕШАННО',
  wait: 'ОЖИДАНИЕ',
  external: 'ВНЕШНИЙ МОДУЛЬ',
  qc: 'QC',
};

const accessionStage = (sourceUrl?: string): LbcStage => ({
  phase: 'receipt',
  title: 'Приём виалы, accession и проверка ID',
  description: 'Сверка направления и идентификатора, визуальная оценка виалы, регистрация в LIS. Это лабораторный pre-analytical этап, а не часть заявленного цикла процессора.',
  automation: 'mixed',
  time: '≈1–3 мин / образец (лабораторная оценка)',
  evidence: 'lab-estimate',
  operator: 'Принимает образец, разбирает исключения и несоответствия.',
  machine: 'LIS/сканер может автоматически зарегистрировать штрихкод.',
  note: 'Не включать эту оценку в паспортное время прибора.',
  sourceUrl,
});

const finishExternal: LbcStage = {
  phase: 'finish',
  title: 'Просветление, покровное стекло и финальный QC',
  description: 'После окраски препарат дегидратируют/просветляют по валидированному протоколу, заключают под покровное стекло и проверяют ID, качество окраски, равномерность клеточного пятна и отсутствие дефектов.',
  automation: 'mixed',
  time: 'Лабораторно-зависимо; отдельно от времени LBC-процессора',
  evidence: 'not-published',
  operator: 'Загрузка/выгрузка стейнера или coverslipper, визуальный QC и разбор брака.',
  machine: 'При наличии автоматического coverslipper — нанесение среды и покровного стекла автоматически.',
};

const thinPrepStain: LbcStage = {
  phase: 'staining',
  title: 'Внешний валидированный Pap-stainer',
  description: 'Гидратация → ядерный краситель → промывка/дифференцировка → bluing → Orange G → EA → спирты → ксилол/заменитель. Hologic публикует отдельные протоколы для нескольких автоматических стейнеров.',
  automation: 'external',
  time: '≈27 мин 40 с суммарных выдержек в одном опубликованном протоколе; фактический цикл зависит от стейнера и перемещений',
  evidence: 'manufacturer',
  operator: 'Переносит штатив обработанных стекол в совместимый стейнер и запускает валидированный рецепт.',
  machine: 'Автоматически выполняет последовательность ванн и выдержек.',
  sourceUrl: 'https://www.hologic.com/package-inserts/diagnostic-products/thinprep-stain-protocols',
};

export const LBC_PLATFORMS: LbcPlatform[] = [
  {
    id: 'thinprep-2000',
    vendor: 'Hologic',
    name: 'ThinPrep 2000',
    family: 'ThinPrep',
    principle: 'Управляемая мембранная фильтрация → контактный перенос клеток на стекло, пятно около 20 мм.',
    totalTime: '<90 с на приготовление одного стекла в опубликованных работах; окраска отдельно',
    throughput: 'Последовательная обработка по одному образцу',
    staining: 'external',
    registrationRu: 'ФСЗ 2012/11751 — действующая запись РФ; включает ThinPrep 2000 и ThinPrep 5000',
    regulatoryNote: 'ThinPrep — FDA PMA семейство для жидкостной цервикальной цитологии.',
    sourcePage: 'https://www.hologic.com/hologic-products/cytology/thinprep-processors',
    stages: [
      accessionStage('https://www.hologic.com/hologic-products/cytology/thinprep-processors'),
      {
        phase: 'loading', title: 'Ручная загрузка одного комплекта', description: 'Оператор устанавливает подписанное стекло, одноразовый фильтр, виалу PreservCyt и фиксирующую ванну/держатель согласно инструкции.', automation: 'manual', time: '≈1–2 мин (лабораторная оценка)', evidence: 'lab-estimate', operator: 'Устанавливает расходники и проверяет соответствие ID.', machine: 'Контролирует запуск и цикл после закрытия рабочей зоны.'
      },
      {
        phase: 'conditioning', title: 'Диспергирование клеточной суспензии', description: 'Аппарат перемешивает содержимое PreservCyt, разрушая рыхлые агрегаты и формируя более однородную суспензию перед фильтрацией.', automation: 'automatic', time: 'Входит в общий цикл <90 с; отдельно не опубликовано', evidence: 'publication', machine: 'Автоматическое механическое диспергирование.'
      },
      {
        phase: 'enrichment', title: 'Контролируемая мембранная фильтрация', description: 'Фильтр погружается в виалу. Жидкость проходит через мембрану; клетки собираются на поверхности. Система контролирует поток/сопротивление, чтобы ограничивать перегрузку клеточного слоя.', automation: 'automatic', time: 'Входит в общий цикл <90 с; отдельно не опубликовано', evidence: 'manufacturer', machine: 'Сбор клеток на одноразовом ThinPrep Pap filter.', sourceUrl: 'https://www.hologic.com/package-inserts/diagnostic-products/thinprep-5000-processor'
      },
      {
        phase: 'slide', title: 'Контактный перенос фильтр → стекло', description: 'Фильтр контактирует с предметным стеклом, и собранные клетки переносятся в стандартизованную круглую область около 20 мм.', automation: 'automatic', time: 'Секунды; входит в общий цикл', evidence: 'manufacturer', machine: 'Автоматический контролируемый контакт и отделение фильтра.'
      },
      {
        phase: 'fixation', title: 'Немедленная влажная фиксация', description: 'После переноса клеток стекло должно попасть в спиртовой фиксатор без высыхания.', automation: 'mixed', time: 'Немедленно после переноса; выдержка зависит от SOP', evidence: 'manufacturer', operator: 'В старой single-sample конфигурации участвует в выгрузке/перемещении.', machine: 'Цикл завершает приготовление препарата.'
      },
      thinPrepStain,
      finishExternal,
    ],
  },
  {
    id: 'thinprep-5000',
    vendor: 'Hologic',
    name: 'ThinPrep 5000 / AutoLoader',
    family: 'ThinPrep',
    principle: 'Та же управляемая мембранная фильтрация ThinPrep, но с пакетной автоматизацией, barcode chain-of-custody и автоматическим открытием/закрытием виал.',
    totalTime: 'до 45 мин walk-away для партии до 20; AutoLoader — до 8 ч walk-away',
    throughput: '5000: до 20 виал/стекол/фильтров одновременно; AutoLoader — высокопроизводительная непрерывная загрузка',
    staining: 'external',
    registrationRu: 'ФСЗ 2012/11751 — действующая запись РФ для ThinPrep 5000',
    regulatoryNote: 'FDA PMA семейство ThinPrep.',
    sourcePage: 'https://www.hologic.com/hologic-products/cytology/thinprep-5000-processor',
    stages: [
      accessionStage('https://www.hologic.com/hologic-products/cytology/thinprep-5000-processor'),
      {
        phase: 'loading', title: 'Загрузка карусели', description: 'Оператор загружает совместно виалы, стекла и фильтры. В ThinPrep 5000 — до 20 комплектов; в AutoLoader автоматизация расширена до длительной непрерывной работы.', automation: 'mixed', time: 'Hands-on зависит от партии; затем до 45 мин walk-away', evidence: 'manufacturer', operator: 'Комплектует карусель и расходники.', machine: 'Автоматически сопоставляет barcode виалы и стекла; открывает и закрывает виалы.'
      },
      {
        phase: 'conditioning', title: 'Автоматическое диспергирование', description: 'Каждый образец диспергируется перед сбором клеток.', automation: 'automatic', time: 'Входит в общий автоматический цикл', evidence: 'manufacturer', machine: 'Последовательно обрабатывает образцы без ручного вмешательства.'
      },
      {
        phase: 'enrichment', title: 'Feedback-controlled filtration', description: 'Клетки накапливаются на мембране фильтра при контролируемом потоке, что стандартизирует клеточность препарата.', automation: 'automatic', time: 'Отдельно производителем не раскрыто', evidence: 'manufacturer', machine: 'Контроль потока и накопления клеток.'
      },
      {
        phase: 'slide', title: 'Автоматический перенос на стекло', description: 'Фильтр переносит клетки на ~20-мм диагностическую область; система поддерживает chain-of-custody.', automation: 'automatic', time: 'Входит в цикл партии', evidence: 'manufacturer', machine: 'Перенос клеток и сортировка готовых стекол в выходной штатив.'
      },
      {
        phase: 'fixation', title: 'Стекло готово к окраске', description: 'Обработанные стекла формируются в штатив; Hologic указывает, что выходной rack можно передавать в совместимые stainer/coverslipper.', automation: 'automatic', time: 'Входит в цикл партии', evidence: 'manufacturer', machine: 'Автоматическая обработка до стадии готовности к окраске.'
      },
      thinPrepStain,
      finishExternal,
    ],
  },
  {
    id: 'thinprep-genesis',
    vendor: 'Hologic',
    name: 'ThinPrep Genesis',
    family: 'ThinPrep',
    principle: 'Single-sample ThinPrep с автоматической chain-of-custody и возможностью hands-free аликвотирования для молекулярных тестов.',
    totalTime: 'Точное публичное время отдельного slide-cycle не найдено; однообразцовая обработка',
    throughput: 'Один образец за цикл; рассчитан на гибкий поток и aliquot + slide',
    staining: 'external',
    regulatoryNote: 'FDA listing/PMA семейство ThinPrep. В найденном действующем РУ РФ ФСЗ 2012/11751 Genesis не перечислен.',
    sourcePage: 'https://www.hologic.com/package-inserts/diagnostic-products/thinprep-genesis-processor',
    stages: [
      accessionStage('https://www.hologic.com/package-inserts/diagnostic-products/thinprep-genesis-processor'),
      {
        phase: 'loading', title: 'Ручная установка виалы, фильтра и стекла', description: 'Оператор подготавливает идентифицированные расходники и загружает инструмент. После запуска система проверяет идентификаторы и выполняет дальнейшие операции автоматически.', automation: 'mixed', time: 'Hands-on — минуты; точное паспортное время не опубликовано', evidence: 'not-published', operator: 'Загрузка расходников и выбор режима Slide или Aliquot + Slide.', machine: 'Проверка ID и контроль последовательности.'
      },
      {
        phase: 'conditioning', title: 'Открытие, диспергирование и опциональный aliquot', description: 'Genesis автоматически открывает виалу, диспергирует образец и в соответствующем режиме отбирает аликвоту в вторичную пробирку.', automation: 'automatic', time: 'Отдельно не опубликовано', evidence: 'manufacturer', machine: 'Автоматический decap/recap, диспергирование и hands-free aliquoting.'
      },
      {
        phase: 'enrichment', title: 'Мембранный сбор клеток', description: 'Как и в других ThinPrep, клетки собираются на одноразовом фильтре из жидкой суспензии.', automation: 'automatic', time: 'Отдельно не опубликовано', evidence: 'manufacturer'
      },
      {
        phase: 'slide', title: 'Перенос на стекло', description: 'Собранный клеточный материал контактно переносится с фильтра на стекло.', automation: 'automatic', time: 'Отдельно не опубликовано', evidence: 'manufacturer'
      },
      {
        phase: 'fixation', title: 'Помещение стекла в фиксатор', description: 'Прибор завершает slide workflow и помещает препарат в фиксирующую среду согласно циклу.', automation: 'automatic', time: 'Немедленно после формирования препарата', evidence: 'manufacturer'
      },
      thinPrepStain,
      finishExternal,
    ],
  },
  {
    id: 'surepath-classic',
    vendor: 'BD',
    name: 'SurePath: PrepMate + PrepStain',
    family: 'SurePath',
    principle: 'Клеточное обогащение через реагент плотности и центрифугирование → pellet → ресуспендирование → естественная седиментация на PreCoat-стекло, пятно ~13 мм.',
    totalTime: 'PrepMate: <5 мин / 12; PrepStain: порядка 60 мин / 48 окрашенных стекол',
    throughput: 'до 48 окрашенных стекол/ч на PrepStain; до 96 неокрашенных/ч в prep-only конфигурациях по опубликованным данным',
    staining: 'integrated',
    registrationRu: 'PrepMate: РЗН 2013/1236; PrepStain: РЗН 2013/686',
    regulatoryNote: 'SurePath / PrepStain — FDA PMA жидкостной Pap-тест.',
    sourcePage: 'https://www.bd.com/en-us/products-and-solutions/products/product-families/bd-prepmate-automated-accessory',
    stages: [
      accessionStage('https://www.bd.com/en-us/products-and-solutions/products/product-families/bd-prepmate-automated-accessory'),
      {
        phase: 'loading', title: 'Предварительная подготовка и загрузка', description: 'В классическом SurePath часть pre-processing остаётся у оператора: маркировка, размещение пробирок/реагента плотности, подготовка центрифуги и расходников.', automation: 'manual', time: 'Лабораторно-зависимо', evidence: 'manufacturer', operator: 'Комплектует партию и выполняет ручные переходы между PrepMate, центрифугой и PrepStain.'
      },
      {
        phase: 'conditioning', title: 'PrepMate: смешивание и дозирование', description: 'PrepMate предсказуемо перемешивает, аспирирует и дозирует заданный объём образца непосредственно на BD Density Reagent.', automation: 'automatic', time: '<5 мин / 12 образцов', evidence: 'manufacturer', machine: 'Автоматическое смешивание и пипетирование.', sourceUrl: 'https://www.bd.com/en-us/products-and-solutions/products/product-families/bd-prepmate-automated-accessory'
      },
      {
        phase: 'enrichment', title: 'Центрифугирование и удаление недиагностических компонентов', description: 'Градиент плотности помогает удалить кровь, слизь и избыток воспалительных клеток и получить обогащённый клеточный осадок. В классической линии переходы/центрифуга не полностью интегрированы.', automation: 'mixed', time: 'Протокол-зависимо; в опубликованных сравнениях отдельное центрифугирование занимало порядка 10 мин', evidence: 'publication', operator: 'Переносит пробирки, запускает центрифугу и выполняет указанные SOP операции.', machine: 'Физическое разделение фракций центрифугированием.'
      },
      {
        phase: 'slide', title: 'PrepStain: ресуспендирование + седиментация', description: 'PrepStain ресуспендирует pellet и дозирует суспензию в осадочную камеру на PreCoat-стекле. Типичная пауза седиментации в руководстве — 600 с.', automation: 'automatic', time: 'Седиментация: обычно 600 с (10 мин); общий цикл prep+stain около 60 мин / 48', evidence: 'manufacturer', machine: 'Ресуспендирование, дозирование и естественная седиментация.'
      },
      {
        phase: 'fixation', title: 'Сушка/фиксация перед окраской', description: 'После осаждения клеток аппарат выполняет запрограммированные переходы; в руководстве указана типичная пауза сушки 60 с.', automation: 'automatic', time: 'Сушка по умолчанию около 60 с', evidence: 'manufacturer'
      },
      {
        phase: 'staining', title: 'PrepStain: встроенная Pap-окраска', description: 'Автоматическое индивидуальное дозирование красителей и промывок. В руководстве встречаются значения порядка 85 с для гематоксилина и отдельная выдержка EA/OG; точный рецепт задаётся протоколом.', automation: 'automatic', time: 'Входит в общий цикл ≈60 мин / 48 стекол', evidence: 'manufacturer', machine: 'Автоматическая подготовка и окраска партии.'
      },
      finishExternal,
    ],
  },
  {
    id: 'bd-totalys',
    vendor: 'BD',
    name: 'Totalys MultiProcessor + SlidePrep',
    family: 'SurePath / Totalys',
    principle: 'Полная автоматизация SurePath enrichment: перенос → центрифугирование → aspiration/decant → pellet; затем SlidePrep выполняет седиментацию и Pap-окраску с barcode chain-of-custody.',
    totalTime: 'SlidePrep: <62–68 мин / 48 окрашенных стекол в зависимости от поколения документа; MultiProcessor согласован по throughput',
    throughput: 'до 336 окрашенных стекол / 8 ч; MultiProcessor — порядка 336–384 образцов / 8 ч в зависимости от конфигурации/aliquoting',
    staining: 'integrated',
    registrationRu: 'MultiProcessor: РЗН 2022/18246; SlidePrep: РЗН 2022/19010',
    regulatoryNote: 'Автоматизированное развитие FDA PMA SurePath workflow.',
    imageUrl: 'https://www.bd.com/content/dam/bd-assets/na/integrated-diagnostic-solutions/images/product/final/product-only/2019/group-2019-01-01-1/SlidePrep_2017_DSC_0796_final_copy.jpg',
    imageAlt: 'BD Totalys SlidePrep',
    sourcePage: 'https://www.bd.com/en-us/products-and-solutions/products/product-families/bd-totalys-slideprep',
    stages: [
      accessionStage('https://www.bd.com/en-us/products-and-solutions/products/product-families/bd-totalys-multiprocessor'),
      {
        phase: 'loading', title: 'Загрузка rack и запуск chain-of-custody', description: 'Оператор загружает идентифицированные образцы и расходники. LIS и barcode обеспечивают положительную идентификацию по всей линии.', automation: 'mixed', time: 'Hands-on зависит от партии; далее walk-away', evidence: 'manufacturer', operator: 'Загрузка образцов/расходников и разбор исключений.', machine: 'Barcode scan, LIS integration, управление очередью.'
      },
      {
        phase: 'conditioning', title: 'MultiProcessor: перенос образца и опциональный aliquot', description: 'Система автоматически переносит образец; при необходимости выполняет дополнительную аликвоту для ancillary testing.', automation: 'automatic', time: 'Отдельный шаг не публикуется', evidence: 'manufacturer', machine: 'Автоматический liquid handling и optional aliquoting.'
      },
      {
        phase: 'enrichment', title: 'MultiProcessor: центрифугирование, aspiration и decant', description: 'Полностью автоматизировано клеточное обогащение SurePath — именно те операции, которые в классической линии требовали нескольких ручных переходов.', automation: 'automatic', time: 'Отдельные подэтапы не опубликованы; throughput линии ≈42–48 образцов/ч', evidence: 'manufacturer', machine: 'Sample transfer, centrifugation, aspiration, decanting.'
      },
      {
        phase: 'slide', title: 'SlidePrep: pellet → осадочная камера → стекло', description: 'SlidePrep сканирует стекло, сопоставляет его с образцом, ресуспендирует обогащённый pellet и формирует SurePath-препарат методом седиментации.', automation: 'automatic', time: 'Входит в цикл <62–68 мин / 48', evidence: 'manufacturer', machine: 'Автоматическая подготовка стекла с непрерывной chain-of-custody.'
      },
      {
        phase: 'fixation', title: 'Автоматические rinse/fix переходы', description: 'Переход от сформированного клеточного пятна к окрашиванию выполняется внутри SlidePrep без ручного перемещения каждого стекла.', automation: 'automatic', time: 'Входит в общий цикл', evidence: 'manufacturer'
      },
      {
        phase: 'staining', title: 'SlidePrep: индивидуальная Pap-окраска', description: 'Окраска выполняется в индивидуальных камерах свежими реагентами; точное дозирование и тайминг управляются системой. Российская комплектация включает гематоксилин и комбинированный EA/OG.', automation: 'automatic', time: '<62 мин / 48 по актуальной брошюре; на EMEA-странице указано 68 мин / 48', evidence: 'manufacturer', machine: 'Fully automated preparation + staining.', sourceUrl: 'https://pages.bd.com/rs/bdmarketogreaterasia/images/BD_Totalys_SlidePrep_XEUR5425-2022.pdf'
      },
      finishExternal,
    ],
  },
  {
    id: 'easyprep',
    vendor: 'YD Diagnostics',
    name: 'EASYPREP',
    family: 'Density gradient / sedimentation',
    principle: 'Прокалывание закрытой виалы → автоматическое смешивание/забор → наслаивание на градиент плотности → встроенная центрифуга → перенос целевых клеток в осадочную камеру → естественная седиментация, пятно 15 мм.',
    totalTime: 'В исследовании: около 40 мин / 48 образцов; производитель публикует 64 препарата за цикл, но не фиксированное время современного цикла',
    throughput: 'до 64 монослойных препаратов за цикл по текущей странице системы',
    staining: 'external',
    registrationRu: 'РЗН 2021/15154',
    imageUrl: 'https://static.tildacdn.com/tild3132-6261-4332-b736-666563346162/Icon_Easy_Prep3.jpg',
    imageAlt: 'EASYPREP liquid-based cytology system',
    sourcePage: 'https://easyprep.ru/',
    stages: [
      accessionStage('https://easyprep.ru/'),
      {
        phase: 'loading', title: 'Загрузка виал, пробирок, стекол и наконечников', description: 'Оператор комплектует держатели и запускает рецепт. После запуска последовательность нанесения выполняется автоматически.', automation: 'mixed', time: 'Hands-on зависит от размера партии', evidence: 'not-published', operator: 'Загрузка расходников и контроль корректности позиций.'
      },
      {
        phase: 'conditioning', title: 'Прокалывание, перемешивание и забор', description: 'Манипулятор прокалывает виалу; система автоматически перемешивает образец и аспирирует заданный объём.', automation: 'automatic', time: 'Отдельно не опубликовано', evidence: 'manufacturer', machine: 'Закрытая автоматическая liquid-handling операция.'
      },
      {
        phase: 'enrichment', title: 'Градиент плотности + центрифугирование', description: 'Образец наслаивается под наклоном на density reagent. В опубликованном исследовании использовали 5 мл gradient reagent + 5 мл образца и 3 мин при 1000 rpm; недиагностический supernatant затем аспирируется.', automation: 'automatic', time: 'Центрифугирование 3 мин в опубликованном протоколе; текущие параметры регулируемые', evidence: 'publication', sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3701823/'
      },
      {
        phase: 'slide', title: 'Перенос в осадочную камеру и седиментация', description: 'Целевые клетки автоматически переносятся в камеру и естественно оседают на адгезивное стекло; диагностическая область около 15 мм.', automation: 'automatic', time: 'Отдельно не опубликовано', evidence: 'manufacturer'
      },
      {
        phase: 'fixation', title: 'Готовое неокрашенное стекло', description: 'EASYPREP позиционируется как полностью автоматизированная система пробоподготовки; дальнейшая Pap-окраска выполняется отдельно.', automation: 'automatic', time: 'Входит в цикл подготовки', evidence: 'manufacturer'
      },
      {
        phase: 'staining', title: 'Последующая Pap-окраска', description: 'Официальная российская страница указывает возможность последующей окраски по Папаниколау; это отдельный технологический этап после EASYPREP.', automation: 'external', time: 'Зависит от выбранного stainer/reagent protocol', evidence: 'manufacturer', sourceUrl: 'https://easyprep.ru/cytology-gynecology'
      },
      finishExternal,
    ],
  },
  {
    id: 'cellprep',
    vendor: 'Biodyne',
    name: 'CellPrep Plus / Cellprep AUTO',
    family: 'Membrane filtration / air transfer',
    principle: 'Мембранная фильтрация с контролем давления/клеточности → перенос клеток на стекло воздушным импульсом; ~20-мм область.',
    totalTime: 'CellPrep PLUS: около 30 с на приготовление стекла; окраска отдельно',
    throughput: '110–120 стекол/ч; AUTO: до 40 виал на входе и 40 стекол на выходе в batch-flow',
    staining: 'external',
    registrationRu: 'CellPrep Plus: ФСЗ 2010/07117 (действует); Cellprep AUTO: РЗН 2020/11462',
    imageUrl: 'https://medcatalog.by/storage/images/30/301c61e9be25a5b09e42bba52509b289.jpg',
    imageAlt: 'CellPrep Plus LBC Processor',
    sourcePage: 'https://www.medesa.cz/lbc-processor-0',
    stages: [
      accessionStage('https://www.medesa.cz/lbc-processor-0'),
      {
        phase: 'loading', title: 'Установка виалы и стекла / batch loading AUTO', description: 'В PLUS оператор устанавливает одну виалу и одно стекло; AUTO имеет входную и выходную станции на 40 позиций и встроенный barcode reader.', automation: 'mixed', time: 'Обычно <1 мин hands-on для single-sample; batch loading зависит от партии', evidence: 'lab-estimate', operator: 'Загрузка образца/стекла и расходных фильтров.', machine: 'В AUTO — управление очередью и встроенная идентификация.'
      },
      {
        phase: 'conditioning', title: 'Автоматическая оценка/настройка переноса', description: 'Cellprep AUTO использует автоматическую турбидиметрическую оценку клеточности; PLUS применяет выбранный режим для разной клеточности/слизи.', automation: 'automatic', time: 'Секунды; входит в 30-секундный цикл PLUS', evidence: 'secondary'
      },
      {
        phase: 'enrichment', title: 'Мембранная фильтрация', description: 'Система собирает клеточный материал на мембране под контролируемым давлением, отделяя значительную часть жидкой фазы и помех.', automation: 'automatic', time: 'Входит в общий цикл', evidence: 'secondary'
      },
      {
        phase: 'slide', title: 'Air-transfer клеток на стекло', description: 'После фильтрации клетки переносятся с мембраны на предметное стекло воздушным импульсом, формируя стандартизованное пятно около 20 мм.', automation: 'automatic', time: 'CellPrep PLUS: полный slide-prep около 30 с', evidence: 'secondary', sourceUrl: 'https://www.scribd.com/document/773292087/Cellprep-PLUS-4-63-user-manual-ENG'
      },
      {
        phase: 'fixation', title: 'Спиртовая фиксация / выходной rack', description: 'Система готовит стекло для последующей стандартной окраски; AUTO включает ёмкость для спиртовой фиксации в зарегистрированной комплектации.', automation: 'mixed', time: 'Входит в slide-prep / лабораторный SOP', evidence: 'official-register'
      },
      {
        phase: 'staining', title: 'Отдельная Pap-окраска', description: 'После CellPrep выполняется обычная/автоматическая Pap-окраска на отдельном stainer.', automation: 'external', time: 'Зависит от валидированного протокола', evidence: 'secondary'
      },
      finishExternal,
    ],
  },
  {
    id: 'huro-path-s',
    vendor: 'Celltrazone',
    name: 'HURO PATH S',
    family: 'Double membrane filtration',
    principle: 'Двойная мембранная фильтрация → регулируемый перенос клеток на стекло; 20-мм диагностическая область.',
    totalTime: '40 с обработки материала на одно стекло; окраска отдельно',
    throughput: 'до 90 стекол/ч',
    staining: 'external',
    registrationRu: 'РЗН 2022/19293 — действует',
    imageUrl: 'https://mqst.ru/t/vwJwTsN5BIhT6oLQccG-xNMAe0k%3D/0x520/31338/95k3mTsUITJU0lHOPPKP1SqhvIFXpRhNPh9WhAs5.png',
    imageAlt: 'HURO PATH S cytology processor',
    sourcePage: 'https://www.ecomeds.ru/item_1785.htm',
    stages: [
      accessionStage('https://elk.roszdravnadzor.gov.ru/widget/med-product/194307'),
      {
        phase: 'loading', title: 'Ручная установка образца, фильтра и стекла', description: 'Компактный одноканальный процессор работает по одному образцу без необходимости накопления партии.', automation: 'manual', time: '≈0,5–1 мин hands-on (лабораторная оценка)', evidence: 'lab-estimate', operator: 'Устанавливает расходники и запускает цикл.'
      },
      {
        phase: 'conditioning', title: 'Аспирация образца', description: 'После запуска жидкостный тракт автоматически забирает подготовленную суспензию.', automation: 'automatic', time: 'Входит в 40 с', evidence: 'secondary'
      },
      {
        phase: 'enrichment', title: 'Двойная мембранная фильтрация', description: 'Запатентованная схема двойной мембранной фильтрации предназначена для очистки и стандартизации клеточного слоя.', automation: 'automatic', time: 'Входит в 40 с', evidence: 'secondary'
      },
      {
        phase: 'slide', title: 'Перенос клеток на 20-мм область', description: 'Отфильтрованный клеточный материал наносится на предметное стекло; толщину слоя можно регулировать.', automation: 'automatic', time: 'Полная обработка материала: 40 с', evidence: 'secondary', sourceUrl: 'https://www.ecomeds.ru/item_1785.htm'
      },
      {
        phase: 'fixation', title: 'Выход стекла для дальнейшей окраски', description: 'Российская регистрационная запись прямо указывает подготовку стеклопрепаратов, пригодных для дальнейшего окрашивания и/или микроскопического анализа.', automation: 'mixed', time: 'После 40-секундного slide-prep', evidence: 'official-register'
      },
      {
        phase: 'staining', title: 'Отдельный Pap-stainer', description: 'HURO PATH S не является встроенным стейнером; окраска выполняется отдельным валидированным процессом.', automation: 'external', time: 'Зависит от выбранного протокола', evidence: 'official-register'
      },
      finishExternal,
    ],
  },
  {
    id: 'novaprep',
    vendor: 'Novacyt / NovaPrep',
    name: 'NOVAprep NPS 25 / NPS 50',
    family: 'Differential / double decantation',
    principle: 'Полностью автоматизированная дифференциальная/двойная декантация вместо классического фильтра ThinPrep или density-gradient SurePath.',
    totalTime: '45 мин на цикл приготовления стекол',
    throughput: 'NPS 25: 16 стекол / 45 мин; NPS 50: 48 стекол / 45 мин',
    staining: 'external',
    registrationRu: 'РЗН 2023/20776 — NPS 25 и NPS 50',
    sourcePage: 'https://www.diakonlab.ru/new-and-promo/sistema-zhidkostnoy-tsitologii-novaprep-sovremennoe-reshenie-dlya-laboratoriy/',
    stages: [
      accessionStage('https://nevacert.ru/reestry/med-reestr/rzn-202320776-69940.html'),
      {
        phase: 'loading', title: 'Загрузка закрытых виал и стекол', description: 'В опубликованных материалах NovaPrep подчёркивается работа «vial to slide» без ручной предварительной декантации/гемолиза/очистки; barcode используется для traceability.', automation: 'mixed', time: 'Hands-on на загрузку партии; затем 45 мин автоматического цикла', evidence: 'secondary', operator: 'Загружает racks и расходники.', machine: 'Идентификация и liquid-handling.'
      },
      {
        phase: 'conditioning', title: 'Автоматическое дозирование и стандартизация объёма', description: 'Роботизированный дозатор обрабатывает образцы и нормализует подачу материала по алгоритму системы.', automation: 'automatic', time: 'Входит в 45 мин', evidence: 'secondary'
      },
      {
        phase: 'enrichment', title: 'Дифференциальная / double decantation', description: 'Основной отличительный принцип NovaPrep — последовательная декантация, уменьшающая кровь/воспаление и концентрирующая диагностически значимые клетки без мембранного фильтра.', automation: 'automatic', time: 'Входит в 45 мин; отдельно не опубликовано', evidence: 'publication'
      },
      {
        phase: 'slide', title: 'Роботизированное формирование препарата', description: 'Система автоматически подготавливает стандартизованное стекло; поддерживается multi-slide mode в опубликованных технических материалах.', automation: 'automatic', time: 'NPS25: 16 / 45 мин; NPS50: 48 / 45 мин', evidence: 'secondary', sourceUrl: 'https://novacyt.com/wp-content/uploads/2016/06/INVEST-SECURITIES-NOVACYT-research-note.pdf'
      },
      {
        phase: 'fixation', title: 'Выход готового к окраске препарата', description: 'NPS — система приготовления LBC-стекол; Pap-staining обычно следует как отдельная лабораторная стадия.', automation: 'automatic', time: 'К окончанию 45-минутного цикла', evidence: 'secondary'
      },
      {
        phase: 'staining', title: 'Отдельный автоматический Pap-stainer', description: 'Для полного пути до окрашенного стекла требуется отдельный stainer; конкретный рецепт определяется лабораторией.', automation: 'external', time: 'Зависит от выбранного stainer', evidence: 'not-published'
      },
      finishExternal,
    ],
  },
  {
    id: 'cytoreference-12',
    vendor: 'СОЛТ / Максима',
    name: 'CytoReference 12',
    family: 'Centrifugation + sedimentation + integrated staining',
    principle: 'Фильтрация/концентрирование и центрифугальная пробоподготовка → 13-мм препарат → встроенная окраска по Папаниколау в одной сессии.',
    totalTime: 'до 12 образцов за 45 мин — центрифугирование + окрашивание',
    throughput: '12 стекол / 45 мин',
    staining: 'integrated',
    registrationRu: 'РЗН 2022/18329',
    imageAlt: 'CytoReference 12',
    sourcePage: 'https://cytology.su/',
    stages: [
      accessionStage('https://cytology.su/'),
      {
        phase: 'loading', title: 'Загрузка до 12 образцов и расходников', description: 'Оператор формирует партию, устанавливает стекла/образцы/одноразовые наконечники и выбирает протокол.', automation: 'mixed', time: 'Hands-on не опубликован; далее единый 45-минутный цикл', evidence: 'manufacturer', operator: 'Загрузка и запуск.', machine: 'Русифицированный интерфейс, управление рецептом.'
      },
      {
        phase: 'conditioning', title: 'Автоматическое дозирование/подготовка', description: 'После запуска подготовка материала выполняется при минимальном участии оператора; одноразовые наконечники снижают риск переноса.', automation: 'automatic', time: 'Входит в 45 мин', evidence: 'official-register'
      },
      {
        phase: 'enrichment', title: 'Фильтрация/концентрирование и центрифугирование', description: 'Производитель/поставщик указывает фильтрацию и концентрирование; центрифугирование входит в одну сессию с дальнейшей окраской.', automation: 'automatic', time: 'Отдельно не опубликовано', evidence: 'manufacturer'
      },
      {
        phase: 'slide', title: 'Формирование 13-мм препарата', description: 'Подготовленный клеточный материал переносится на стекло с формированием ограниченной диагностической области.', automation: 'automatic', time: 'Входит в 45 мин', evidence: 'manufacturer'
      },
      {
        phase: 'fixation', title: 'Автоматический переход к staining', description: 'Между приготовлением препарата и окраской не требуется ручная перегрузка каждого стекла.', automation: 'automatic', time: 'Входит в единый цикл', evidence: 'official-register'
      },
      {
        phase: 'staining', title: 'Встроенная окраска по Папаниколау', description: 'Регистрационное наименование прямо включает приготовление и окрашивание; протокол настраивается.', automation: 'automatic', time: 'Полный цикл: 12 стекол / 45 мин', evidence: 'manufacturer', sourceUrl: 'https://cytology.su/'
      },
      finishExternal,
    ],
  },
  {
    id: 'lts-3000',
    vendor: 'Lituo Biotechnology',
    name: 'LTS-3000 A / B',
    family: 'Density gradient + sedimentation + integrated staining',
    principle: 'Градиентное центрифугирование → перенос клеток → естественная седиментация/charge capture → встроенная окраска.',
    totalTime: 'A: около 8 образцов / 30 мин; B: до 24 образцов / час',
    throughput: 'LTS-3000B: 24 образца/ч',
    staining: 'integrated',
    registrationRu: 'РЗН 2022/18197',
    imageUrl: 'https://www.medilink.lv/wp-content/uploads/2020/02/1550625784.png',
    imageAlt: 'LTS-3000 liquid based cytology processor',
    sourcePage: 'https://www.lituo.com.cn/page114?_l=en&product_id=20',
    stages: [
      accessionStage('https://www.lituo.com.cn/page114?_l=en&product_id=20'),
      {
        phase: 'loading', title: 'Пакетная загрузка образцов и стекол', description: 'Оператор загружает расходники и выбирает параметры. Модель B рассчитана на batch processing до 24 specimens per hour.', automation: 'mixed', time: 'Hands-on зависит от партии', evidence: 'manufacturer'
      },
      {
        phase: 'conditioning', title: 'Автоматическая обработка образца', description: 'Инструмент выполняет specimen process и cell transfer под управлением микропроцессора.', automation: 'automatic', time: 'Входит в общий цикл', evidence: 'manufacturer'
      },
      {
        phase: 'enrichment', title: 'Density-gradient centrifugation', description: 'Система использует градиент плотности для отделения недиагностических компонентов.', automation: 'automatic', time: 'Параметры центрифугирования настраиваются; отдельная длительность не опубликована', evidence: 'manufacturer'
      },
      {
        phase: 'slide', title: 'Natural sedimentation + charge capture', description: 'После переноса клеточный материал естественно оседает и удерживается на стекле.', automation: 'automatic', time: 'Входит в общий цикл', evidence: 'manufacturer'
      },
      {
        phase: 'fixation', title: 'Автоматический переход к staining', description: 'Подготовка и staining объединены в одном приборе.', automation: 'automatic', time: 'Входит в 30–60 мин batch cycle', evidence: 'manufacturer'
      },
      {
        phase: 'staining', title: 'Встроенная окраска', description: 'Производитель прямо указывает «centrifuge, cell transfer, sedimentation, smear processing and staining all in 1».', automation: 'automatic', time: 'LTS-3000B: 24 готовых препарата/ч; A: около 8/30 мин по данным поставщиков', evidence: 'manufacturer', sourceUrl: 'https://www.lituo.com.cn/page114?_l=en&product_id=20'
      },
      finishExternal,
    ],
  },
  {
    id: 'cellslide',
    vendor: 'Glenbio / CellSlide',
    name: 'CellSlide',
    family: 'Semi-automated filtration',
    principle: 'Полуавтоматическая компьютерно-управляемая фильтрация с двумя параллельными каналами → стекло; окраска отдельно.',
    totalTime: 'около 2 мин на 1–2 препарата по данным российского поставщика',
    throughput: 'два параллельных фильтрационных канала',
    staining: 'external',
    registrationRu: 'РЗН 2015/3370',
    sourcePage: 'https://www.glenbio.com/ezcyto/',
    stages: [
      accessionStage('https://www.glenbio.com/ezcyto/'),
      {
        phase: 'loading', title: 'Ручная подготовка и установка 1–2 образцов', description: 'Оператор устанавливает контейнеры, фильтры и стекла в два независимых рабочих канала.', automation: 'manual', time: '≈1 мин hands-on (лабораторная оценка)', evidence: 'lab-estimate'
      },
      {
        phase: 'conditioning', title: 'Запуск выбранного режима фильтрации', description: 'После подготовки система управляет циклом по выбранным настройкам.', automation: 'mixed', time: 'Входит в общий цикл ≈2 мин', evidence: 'secondary'
      },
      {
        phase: 'enrichment', title: 'Компьютерно-управляемая фильтрация', description: 'Жидкая фаза проходит через фильтрационный узел, клеточный материал концентрируется для переноса на стекло.', automation: 'automatic', time: 'Входит в ≈2 мин', evidence: 'secondary'
      },
      {
        phase: 'slide', title: 'Перенос клеток на стекло', description: 'Система формирует один или два тонкослойных препарата в параллельных каналах.', automation: 'automatic', time: '≈2 мин на 1–2 стекла по данным поставщика', evidence: 'secondary'
      },
      {
        phase: 'fixation', title: 'Выдача неокрашенного стекла', description: 'После автоматического формирования стекло передаётся на стандартную фиксацию/окраску согласно лабораторному SOP.', automation: 'mixed', time: 'После окончания ≈2-минутного prep cycle', evidence: 'secondary'
      },
      {
        phase: 'staining', title: 'Отдельная Pap-окраска', description: 'Окрашивание не является частью фильтрационного процессора и выполняется отдельно.', automation: 'external', time: 'Зависит от stainer и выбранного протокола', evidence: 'secondary'
      },
      finishExternal,
    ],
  },
];

export const LBC_EVIDENCE_LABELS: Record<LbcEvidenceLevel, string> = {
  manufacturer: 'Производитель / IFU',
  'official-register': 'Официальный реестр',
  publication: 'Публикация',
  secondary: 'Вторичный тех. источник',
  'lab-estimate': 'Оценка лабораторного hands-on',
  'not-published': 'Отдельное время не опубликовано',
};
