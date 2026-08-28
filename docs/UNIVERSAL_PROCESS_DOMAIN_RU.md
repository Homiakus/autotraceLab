# Universal Process Domain — универсальный контракт процессов AutoTrace

## Цель

Process Math / Simulation / Digital Twin / Batch / Reliability / Optimizer не должны быть привязаны к лаборатории, LBC или конкретному производству.

Ядро оперирует только универсальными понятиями:

```text
job
operation / block
DAG dependency
resource
resource requirement
calendar
batch policy
priority
retry / rework
uncertainty
failure
compatibility
changeover
objective
```

LBC, производство, покраска, CNC, логистика, сервисные заявки, вычислительные job-очереди и другие предметные области являются **профилями поверх одного ядра**.

## Слои

### 1. Core

Core не должен знать слова:

- specimen;
- Pap;
- centrifuge как специальный тип;
- STAT как обязательную медицинскую семантику;
- production order;
- customer ticket;
- GPU task.

Для core это `ProcessJobDescriptor`, `GraphProcessBlock`, `ProcessResource` и политики.

### 2. Universal Process Profile

`ProcessScenarioProfile` — переносимый versioned контракт сценария.

Ключевые поля:

```ts
schemaVersion
id
name
domain?
jobs[]
blocks[]
resources[]
requirementsByBlock
arrivals
uncertaintyByBlock
retryByBlock
batchPolicies
calendars
failures
compatibility
changeovers
objectives
metadata
```

`domain` — только метаданные. Scheduler не ветвится по нему.

## Job attributes

Любая предметная специфика хранится как атрибуты job:

```json
{
  "id": "order-17",
  "priority": 20,
  "priorityClass": "expedite",
  "attributes": {
    "product": "A",
    "material": "steel",
    "color": "black",
    "recipe": "R4",
    "lot": "L2026-08",
    "tenant": "customer-12",
    "program": "P3"
  }
}
```

Таким образом новый домен не требует добавления полей в scheduler.

## Priority

Универсальный API использует:

```text
job.priority: number
job.priorityClass?: string
```

Старые `STAT / routine` поля остаются только backward-compatible представлением существующего Digital Twin. Universal API возвращает нейтральные:

```text
highPriorityAverageCycleSeconds
basePriorityAverageCycleSeconds
priorityAdvantagePercent
```

## Batch compatibility

Совместимость задаётся декларативно и теперь **исполняется Universal Policy Scheduler при формировании каждого физического batch**.

Примеры:

### Одинаковый рецепт

```json
{
  "attribute": "recipe",
  "mode": "same"
}
```

### Одинаковый цвет

```json
{
  "attribute": "color",
  "mode": "same"
}
```

### Запрещённая пара материалов

```json
{
  "attribute": "material",
  "mode": "forbidden-pairs",
  "forbiddenPairs": [["A", "C"]]
}
```

Один механизм подходит для:

- rotor/rack;
- печи;
- окраски;
- мойки;
- thermal batch;
- принтера;
- CNC fixture;
- GPU batching;
- multi-tenant jobs.

Функции `areJobsCompatible`, `isJobCompatibleWithBatch` и `partitionCompatibleJobs` не содержат domain-specific условий.

Scheduler рассматривает несколько возможных anchor jobs. Поэтому одна несовместимая ранняя job не должна блокировать формирование другой совместимой партии.

## Changeover

Переналадка описывается `ProcessChangeoverPolicy`.

Setup state строится из произвольных job attributes:

```text
stateAttributes = [product, material, color]
```

Поддерживаются:

```text
sameStateSeconds
defaultSeconds
initialState
matrixSeconds[from][to]
```

Примеры одной абстракции:

```text
white paint → black paint
product A → product B
recipe R1 → recipe R2
tool set X → tool set Y
GPU model small → large
reagent lot A → lot B
```

### Исполнение в scheduler

`src/processUniversalScheduler.ts` хранит setup-state **по каждой lane ресурса отдельно**.

Если `capacity = 3`, это не один общий state на три машины: каждая из трёх единиц может оставаться настроенной на свой продукт/рецепт/инструмент.

Для каждой candidate operation scheduler рассчитывает:

```text
previous lane state
        ↓
sequence-dependent setup cost
        ↓
setup interval on resource lane
        ↓
common operation start
        ↓
operation interval
        ↓
new lane state
```

Setup входит в busy time и utilization ресурса.

Для операции с несколькими ресурсами ищется общий operation start, при котором setup + operation допустимы одновременно по календарям всех требуемых ресурсов.

Для batch setup-state строится по jobs внутри партии. Если все jobs дают один state — используется он. Если batch по правилам допускает разные setup-state, используется детерминированный aggregate state; таким образом поведение остаётся определённым без знания предметной области.

`orderJobsByChangeover` остаётся отдельной детерминированной nearest-changeover эвристикой для planner/UI, тогда как DES самостоятельно выбирает следующее задание по фактическому earliest feasible start.

## Calendars и failures

Universal scheduler использует те же нейтральные контракты:

- повторяющиеся working windows;
- planned downtime;
- MTBF/MTTR failure windows;
- resource capacity.

Changeover не обходит календарь: setup + operation должны помещаться в допустимое окно ресурса.

## Retry / rework

`retryByBlock` — универсальная политика повторного выполнения operation.

Для batch rework остаётся per-job: общий batch может завершиться успешно для большинства jobs, а отдельная job возвращается в очередь и участвует в формировании следующей совместимой партии.

## Objectives

`ProcessOptimizationObjective` задаёт:

```text
metric
goal = maximize | minimize | target
weight
target?
tolerance?
```

Встроенные универсальные метрики:

- throughputPerHour;
- p95CycleSeconds;
- averageCycleSeconds;
- averageWaitSeconds;
- p95WaitSeconds;
- averageBatchFillPercent;
- partialBatchRate;
- availabilityPercent;
- utilizationPercent.

Host-приложение может передать дополнительные числовые метрики через custom metric snapshot без изменения core schema.

## Policy stats

Universal scheduler дополнительно возвращает:

```text
totalChangeoverSeconds
changeoverCount
changeover seconds/count by resource
compatibilityPoliciesApplied
changeoverPoliciesApplied
```

Это позволяет строить отдельную экономику переналадок и видеть, где sequence-dependent setup становится bottleneck.

## Profile / Pack архитектура

Рекомендуемая структура интеграции:

```text
AutoTrace Process Core
        ↑
Universal Process Contract
        ↑
Domain Profile / Pack
        ↑
Host adapter
        ↑
Web / Obsidian / Electron / Tauri / CLI / service
```

Domain Pack может определять:

- словарь пользовательских названий;
- типовые job attributes;
- готовые process templates;
- compatibility rules;
- changeover matrices;
- objectives;
- validation rules;
- UI panels;
- импорт/экспорт из внешней системы.

Он не должен форкать scheduler.

## Portable schema

Machine-readable контракт:

```text
schemas/process-scenario.schema.json
```

JSON Schema позволяет создавать и валидировать профили вне React/TypeScript: в Go, Node, CLI, CI, Electron/Tauri или внешнем сервисе.

## Примеры

`src/processProfiles.ts` содержит три разных класса применения одного API:

1. Generic manufacturing cell;
2. Generic service queue;
3. Generic compute pipeline.

Открыть:

```text
/?view=process-universal
```

или:

```text
/#process-universal
```

## Backward compatibility

Существующие режимы не удаляются:

```text
process-math
process-sim
process-batch
process-digital-twin
process-reliability
process-unified-twin
process-unified-opt
lbc
```

Legacy режимы продолжают работать через прежний scheduler.

`processUniversalCompiler.ts` переводит Universal Profile в новый `processUniversalScheduler.ts`, но сохраняет backward-compatible `UnifiedTwinOptions` adapter payload для host-приложений, которые ещё используют старый контракт.

Это позволяет мигрировать постепенно, без big-bang rewrite.

## Архитектурный инвариант

Новая предметная область подключается **данными и адаптером**, а не `if (domain === ...)` внутри scheduler.

В scheduler запрещено добавлять отраслевые ветвления. Новая семантика должна выражаться через универсальное расширение контракта или policy interface.
