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

Новый универсальный API использует:

```text
job.priority: number
job.priorityClass?: string
```

Старые `STAT / routine` поля остаются backward-compatible адаптером существующего Digital Twin, но наружу Universal API возвращает нейтральные:

```text
highPriorityAverageCycleSeconds
basePriorityAverageCycleSeconds
priorityAdvantagePercent
```

## Batch compatibility

Совместимость задаётся декларативно.

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

Один и тот же механизм подходит для:

- общего rotor/rack;
- печи;
- окраски;
- мойки;
- thermal batch;
- принтера;
- CNC fixture;
- GPU batching;
- multi-tenant jobs.

Функции `areJobsCompatible`, `isJobCompatibleWithBatch` и `partitionCompatibleJobs` не содержат domain-specific условий.

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

`orderJobsByChangeover` предоставляет детерминированную nearest-changeover эвристику для planner/UI.

## Objectives

Оптимизатор больше не обязан быть связан с фиксированным набором бизнес-терминов.

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

## Примеры, включённые в репозиторий

`src/processProfiles.ts` содержит три разных класса применения одного и того же API:

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

Экран показывает profile JSON, jobs/attributes, operations/resources, simulation result, objectives, compatibility grouping и changeover preview.

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

Universal Profile компилируется в существующий Unified Twin через `processUniversalCompiler.ts`.

Это позволяет мигрировать без big-bang rewrite.

## Текущая граница интеграции

На этой итерации `compatibility` и `changeovers` являются стабильными domain-neutral контрактами, имеют валидатор, planner-функции, UI preview и tests.

Они **ещё не резервируют время непосредственно внутри lane-level Unified DES**. Compiler явно выдаёт предупреждение, если эти политики присутствуют.

Это сделано намеренно: сначала фиксируется универсальный контракт, затем scheduler интегрирует его без появления отраслевых условий в hot path.

Следующая scheduler-итерация должна:

1. фильтровать состав batch через `isJobCompatibleWithBatch`;
2. хранить setup state на resource lane;
3. резервировать changeover как отдельный временной интервал перед operation/batch;
4. учитывать sequence-dependent setup в optimizer;
5. сохранять прежнее поведение при отсутствии compatibility/changeover policies.

## Инвариант

Новая предметная область должна подключаться **данными и адаптером**, а не изменением алгоритма scheduler.
