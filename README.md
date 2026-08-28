<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# AutoTrace Lab

Интерактивная лаборатория для построения, трассировки и анализа сложных схем.

## Universal Process Domain — одно ядро для разных применений

Process Math / Simulation / Digital Twin / Batch / Reliability / Optimizer развиваются как **domain-neutral core**. LBC является одним из профилей применения, а не архитектурой ядра.

```text
http://localhost:3000/?view=process-universal
```

или:

```text
http://localhost:3000/#process-universal
```

Универсальный контракт использует `job`, `operation`, `resource`, `batch`, `calendar`, `priority`, `retry`, `failure`, `compatibility`, `changeover` и `objective`. Предметная специфика хранится в произвольных job attributes и Domain Profile/Pack, поэтому новый домен подключается данными и адаптером без форка scheduler.

Встроенные демонстрационные профили: generic manufacturing cell, service queue и compute pipeline. Совместимость партий задаётся декларативными правилами по любым атрибутам (`recipe`, `color`, `material`, `program`, `tenant`, `lot`), переналадка — setup-state атрибутами и матрицей `from → to → seconds`, а цели оптимизации — списком `metric / maximize|minimize|target / weight`.

Подробности: [`docs/UNIVERSAL_PROCESS_DOMAIN_RU.md`](docs/UNIVERSAL_PROCESS_DOMAIN_RU.md).

## Unified Stochastic Batch Twin — единый цифровой двойник линии

Новый интегрированный режим объединяет per-sample stochasticity, batch/rack/rotor cycles, resource capacity, смены, STAT priority, rework и MTBF/MTTR в **одном** discrete-event scheduler.

```text
http://localhost:3000/?view=process-unified-twin
```

или:

```text
http://localhost:3000/#process-unified-twin
```

Batch-операция резервирует физический аппарат один раз на общий цикл, но каждая проба сохраняет собственные `ready time`, priority, attempt и rework history. Поэтому после общего центрифужного или staining cycle отдельная проба может вернуться на повтор и попасть уже в другую следующую партию.

Режим читает сохранённую Resource Simulation модель и существующие batch-политики. В одном UI задаются stochastic spread, rework, batch capacity/min batch/max wait, смены ресурсов и MTBF/MTTR. Рассчитываются makespan, P95 cycle/wait, throughput, fill rate, partial cycles, utilization, availability, generated failures и bottleneck.

Подробности: [`docs/PROCESS_UNIFIED_TWIN_RU.md`](docs/PROCESS_UNIFIED_TWIN_RU.md).

## Process Digital Twin — per-sample stochastic DES

Новый уровень моделирования рассчитывает уже не только детерминированный DAG и ограниченные ресурсы, а поведение каждой отдельной пробы: индивидуальное время операций, случайный поток поступления, очередь, приоритет STAT и rework.

```text
http://localhost:3000/?view=process-digital-twin
```

или:

```text
http://localhost:3000/#process-digital-twin
```

Digital Twin читает последнюю Resource Simulation модель. Для каждого этапа можно задать triangular-разброс времени `±%`, вероятность повторной обработки и максимальное число повторов. Поток поступления может быть фиксированным либо Poisson; одинаковый `seed` воспроизводит тот же сценарий. STAT priority является non-preemptive: уже начатая операция не прерывается, но STAT получает следующий совместимый свободный слот.

Рассчитываются makespan, average/P95 cycle time, average/P95 wait, throughput/output rate, rework rate, STAT vs routine cycle time, utilization, peak units, resource bottleneck и статистика каждого этапа.

Подробности: [`docs/PROCESS_DIGITAL_TWIN_RU.md`](docs/PROCESS_DIGITAL_TWIN_RU.md).

## Resource-Constrained Process Simulation — очереди и реальная пропускная способность

Новый режим моделирует несколько образцов/заказов одновременно и учитывает ограниченные ресурсы: операторов, автоматы, центрифуги, станции окраски, QC и любые пользовательские единицы.

```text
http://localhost:3000/?view=process-sim
```

или:

```text
http://localhost:3000/#process-sim
```

Симулятор использует DAG и времена Process Math, добавляет ресурсные календари и рассчитывает makespan партии, средний и P95 cycle time, очереди по этапам, utilization оборудования, resource bottleneck, batch throughput и наблюдаемую скорость выхода после разгона конвейера. Поддерживаются разные capacities ресурсов и интервал поступления новых образцов.

Текущую модель Process Math можно импортировать одним нажатием. Все LBC-платформы также доступны как стартовые шаблоны.

Подробности: [`docs/PROCESS_SIMULATION_RU.md`](docs/PROCESS_SIMULATION_RU.md).

## Process Math Workbench — формулы непосредственно у блоков

В проект добавлен универсальный режим математического моделирования технологических процессов:

```text
http://localhost:3000/?view=process-math
```

или:

```text
http://localhost:3000/#process-math
```

В каждом блоке можно задать фиксированное время либо формулу, присвоить математический ключ, указать зависимости от других блоков и тип операции: ручная, автоматическая, смешанная, ожидание, внешний модуль или QC.

Формулы могут ссылаться на значения других блоков через `<key>.time`, например `prep.time + 30`. Итоговый Σ-блок автоматически считает сумму времён, критический путь DAG, ручное/автоматическое время, покрытие модели, долю автоматизации, bottleneck и модельную пропускную способность партии. Поддерживаются ветвления и слияния зависимостей, обнаружение циклов, импорт/экспорт JSON и сохранение модели в Local Storage.

Можно загрузить одну из LBC-платформ как готовый шаблон и затем заменить опубликованные/неопубликованные времена собственными валидированными значениями.

Подробности: [`docs/PROCESS_MATH_WORKBENCH_RU.md`](docs/PROCESS_MATH_WORKBENCH_RU.md).

## LBC Workflow Atlas — русская сравнительная карта жидкостной цитологии

В проект добавлен отдельный интерактивный режим для сравнения технологических цепочек LBC — от поступления виалы в лабораторию до готового окрашенного по Папаниколау стекла.

Открыть после запуска приложения:

```text
http://localhost:3000/?view=lbc
```

Также поддерживается:

```text
http://localhost:3000/#lbc
```

В доске рядом сравниваются:

- Hologic ThinPrep 2000;
- Hologic ThinPrep 5000 / AutoLoader;
- Hologic ThinPrep Genesis;
- BD SurePath PrepMate + PrepStain;
- BD Totalys MultiProcessor + SlidePrep;
- EASYPREP;
- CellPrep Plus / Cellprep AUTO;
- HURO PATH S;
- NOVAprep NPS 25 / NPS 50;
- CytoReference 12;
- LTS-3000A / LTS-3000B;
- CellSlide.

Цветами разделены ручные, автоматические, смешанные и внешние этапы. Для каждого шага указаны время, уровень доказательности, роль оператора и роль автомата. Если производитель не публикует длительность внутренней операции, интерфейс не подменяет её вычисленной оценкой.

Подробная методология, регуляторные оговорки и список источников: [`docs/LBC_WORKFLOWS_RU.md`](docs/LBC_WORKFLOWS_RU.md).

## Run locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key if AI-assisted features are required.
3. Run the app:
   `npm run dev`
