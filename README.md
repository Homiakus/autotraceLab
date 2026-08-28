<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# AutoTrace Lab

Интерактивная лаборатория для построения, трассировки и анализа сложных схем.

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
