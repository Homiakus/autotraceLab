<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# AutoTrace Lab

Интерактивная лаборатория для построения, трассировки и анализа сложных схем.

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
