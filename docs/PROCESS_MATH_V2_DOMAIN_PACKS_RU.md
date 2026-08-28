# Process Math v2 — Universal Profile + Domain Packs

## Что изменилось

`/?view=process-math` больше не строит математическую модель напрямую из LBC-specific структур.

Новый путь:

```text
Domain Pack template
        ↓
ProcessScenarioProfile
        ↓
Universal Process Math UI
        ↓
analyzeGraphProcess
```

Старый экран сохранён для сравнения и обратной совместимости:

```text
/?view=process-math-legacy
```

## Поддерживаемые классы шаблонов

Новый dropdown формируется из `ProcessDomainPackManifest`, поэтому один редактор уже показывает:

- Generic Manufacturing;
- Generic Service Operations;
- Generic Compute Pipeline;
- Liquid-Based Cytology.

Добавление следующего домена не требует изменения Process Math editor: достаточно предоставить новый pack с `profileTemplates`.

## LBC как Domain Pack

`src/domainPacks/lbc.ts` преобразует `LBC_PLATFORMS` в универсальные `ProcessScenarioProfile`.

Каждая стадия LBC становится `GraphProcessBlock`, а исходная предметная информация сохраняется в metadata:

```text
phase
sourceTime
evidence
description
operator
machine
note
sourceUrl
```

Платформенная информация также сохраняется:

```text
vendor
family
principle
statedTotalTime
statedThroughput
stainingMode
registrationRu
regulatoryNote
sourcePage
```

## Политика неизвестных времён

Adapter использует тот же conservative timing parser `extractInitialDuration`.

Он извлекает число только из однозначно распознаваемого published/estimated time.

Не преобразуются в выдуманное значение:

- диапазоны;
- «входит в общий цикл» без отдельного числа;
- «не опубликовано»;
- лабораторно-зависимые интервалы без одного определённого значения.

Такие блоки получают:

```json
{
  "value": null,
  "unit": "min"
}
```

и должны быть заполнены валидированными измерениями или явными `timingOverrides`.

`evaluateLbcTimingReadiness` возвращает:

```text
totalBlocks
timedBlocks
unresolvedBlockIds
coveragePercent
simulationReady
```

Таким образом UI может честно отличать структурно готовый workflow от simulation-ready profile.

## Process Math хранит universal profile

Новый storage key:

```text
autotrace:process-math-profile:v2
```

Хранится полный `ProcessScenarioProfile`, а не отдельная UI-модель.

Итоговая формула Process Math сохраняется в:

```text
profile.metadata.processMath.summaryFormula
```

Количество jobs используется как `batch.count` математической модели.

## Миграция v1

Если v2 profile отсутствует, приложение проверяет прежний key:

```text
autotrace:generic-process-math:v1
```

`migrateLegacyProcessMathModel` переводит старые:

```text
name
blocks
batchSize
summaryFormula
```

в `ProcessScenarioProfile` и сохраняет результат в v2.

Старые данные пользователя поэтому не требуют ручного экспорта/импорта.

## Template Catalog

`processTemplateCatalog.ts` создаёт domain-neutral ссылки:

```text
<packId>::<templateId>
```

Функции:

```text
processTemplateRef
parseProcessTemplateRef
buildProcessTemplateCatalog
createScenarioFromTemplateRef
```

Это позволяет одному UI безопасно смешивать шаблоны из независимых pack без коллизии `templateId`.

## SDK/package surface

Generic Process helpers доступны через:

```ts
import {
  ProcessScenarioProfile,
  buildProcessTemplateCatalog,
  createScenarioFromTemplateRef,
  resizeProcessScenarioJobs,
} from '@autotrace/sdk/process';
```

LBC является отдельным domain extension:

```ts
import {
  LBC_DOMAIN_PACK,
  lbcPlatformToProcessScenario,
  evaluateLbcTimingReadiness,
} from '@autotrace/sdk/domain-packs/lbc';
```

Root `@autotrace/sdk` также re-exported LBC pack для удобства, но `src/process/index.ts` остаётся domain-neutral.

## JSON Schema package exports

Схемы теперь включаются в npm package:

```text
@autotrace/sdk/schemas/process-scenario.json
@autotrace/sdk/schemas/process-domain-pack.json
```

Это важно для Go/Node/CI/agent integrations, которым нужна валидация без TypeScript runtime.

## Проверки

CI проверяет:

1. исходный LBC platform ↔ universal profile stage parity;
2. сохранение evidence metadata;
3. отсутствие invented timings;
4. timing override → simulation-ready profile;
5. запуск такого profile через Universal Scheduler;
6. Domain Pack registry;
7. уникальность template refs;
8. legacy Process Math v1 → v2 migration;
9. SDK ESM/CJS exports;
10. TypeScript declarations;
11. наличие JSON Schema в `npm pack --dry-run`.

## Архитектурный результат

Process Math теперь является первым legacy UI, фактически переведённым на новую универсальную модель.

Следующие экраны можно мигрировать тем же способом:

```text
ProcessSimulationApp
ProcessDigitalTwinApp
ProcessReliabilityApp
ProcessUnifiedTwinApp
ProcessUnifiedOptimizerApp
```

без изменения Domain Pack contract.
