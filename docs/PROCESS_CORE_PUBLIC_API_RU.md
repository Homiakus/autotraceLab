# Public Process Core API

## Цель

Внешнее приложение не должно импортировать внутренние файлы вида:

```ts
import ... from './src/processUniversalScheduler'
```

Поддерживаемая точка входа Process Core:

```ts
import {
  ProcessScenarioProfile,
  ProcessDomainPackRegistry,
  simulateUniversalScenario,
  scoreUniversalScenario,
} from '@autotrace/sdk';
```

Внутри репозитория тот же контракт собран в:

```text
src/process/index.ts
```

и re-exported из:

```text
src/sdk/index.ts
```

## Версии контрактов

Публичный API экспортирует отдельно:

```text
PROCESS_CORE_API_VERSION = 1.0.0
PROCESS_SCENARIO_SCHEMA_VERSION = 1.0
PROCESS_DOMAIN_PACK_SCHEMA_VERSION = 1.0
```

Это разные уровни совместимости.

Изменение runtime API не обязано автоматически менять JSON schema и наоборот.

## Что входит в public Process Core

### Scenario contract

- ProcessScenarioProfile;
- ProcessJobDescriptor;
- compatibility rules;
- changeover policies;
- optimization objectives;
- validate/clone.

### Scheduler

- simulateUniversalPolicyTwin;
- UniversalPolicyTwinResult;
- policy/changeover stats.

### Compiler/facade

- compileUniversalScenario;
- simulateUniversalScenario;
- neutral result aliases.

### Objectives

- universalMetricSnapshot;
- scoreUniversalScenario;
- custom numeric metric support.

### Domain Packs

- ProcessDomainPackRegistry;
- portable manifest types;
- runtime adapter types;
- built-in generic packs.

### IO/migration

- parse/serialize ProcessScenario;
- parse/serialize Domain Pack;
- legacyResourceModelToProcessScenario.

### Supporting policy types

Public barrel экспортирует типы ресурсов, batch config, uncertainty, arrivals/retry, calendars и MTBF/MTTR failures, необходимые для построения `ProcessScenarioProfile`.

## Почему это важно

Host-приложение зависит от одного стабильного API вместо физической структуры исходников.

Можно менять:

```text
internal scheduler implementation
folder layout
UI components
React screens
legacy adapters
```

не заставляя потребителя переписывать импорты.

## Использование без UI

```ts
import {
  ProcessDomainPackRegistry,
  MANUFACTURING_DOMAIN_PACK,
  simulateUniversalScenario,
} from '@autotrace/sdk';

const registry = new ProcessDomainPackRegistry();
registry.registerPack(MANUFACTURING_DOMAIN_PACK);

const profile = registry.createProfile('generic-manufacturing', 'cell');
const result = simulateUniversalScenario(profile, 12345);

if (!result.ok) {
  throw new Error(result.errors.join('; '));
}

console.log(result.stats.throughputPerHour);
```

React, Canvas и DOM для этой операции не требуются.

## Библиотечная сборка

`npm run build:lib` теперь обязан собирать Process Core вместе с основным `@autotrace/sdk` и генерировать declarations.

CI дополнительно проверяет public API test, который импортирует Process Core **только через `src/sdk/index.ts`**, не через внутренние implementation paths.

## Правило развития

Новый стабильный Process API сначала добавляется в `src/process/index.ts`.

Внешним приложениям не следует считать любой произвольный `src/process*.ts` публичным контрактом.
