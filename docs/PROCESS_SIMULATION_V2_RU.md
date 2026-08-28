# Process Simulation v2 — один Universal Process Profile

## Цель

`Process Simulation` больше не должен иметь отдельную модель данных, отличную от Process Math, Digital Twin и внешнего SDK.

Новый основной путь:

```text
Domain Pack / Process Math / imported JSON
                ↓
        ProcessScenarioProfile
                ↓
     Universal Process Simulation UI
                ↓
       Universal Policy Scheduler
```

Старый экран сохранён для сравнения:

```text
/?view=process-sim-legacy
```

Основной экран:

```text
/?view=process-sim
```

## Единственный рабочий документ

Simulation v2 редактирует непосредственно:

```text
profile.jobs
profile.arrivals
profile.blocks
profile.resources
profile.requirementsByBlock
profile.batchPolicies
profile.compatibility
profile.changeovers
profile.calendars
profile.failures
profile.retryByBlock
```

То есть дальнейшие уровни моделирования больше не требуют преобразования в отдельную UI-specific `SimulationModel`.

## Domain Packs

Template selector использует тот же каталог, что Process Math v2:

- Generic Manufacturing;
- Generic Service;
- Generic Compute;
- LBC Cytology.

Если template уже содержит resources/requirements, они используются без изменения.

Если domain profile описывает только workflow, как часть LBC templates, пользователь может применить generic automation→resource defaults. Это adapter/bootstrap convenience, а не условие внутри scheduler.

## Импорт Process Math v2

Simulation читает:

```text
autotrace:process-math-profile:v2
```

и переносит тот же `ProcessScenarioProfile`.

Если в нём ещё нет ресурсов, `applyAutomationResourceDefaults` может добавить generic defaults:

```text
manual    → operator
automatic → automation
mixed     → operator + automation
external  → external
qc        → qc
wait      → no resource
```

Это только стартовая конфигурация. После импорта resources и requirements становятся обычной частью profile и могут свободно редактироваться.

## Миграция Resource Simulation v1

При отсутствии v2 profile проверяется старый key:

```text
autotrace:resource-simulation:v1
```

Старый формат:

```text
name
blocks
resources
requirementsByBlock
batchSize
releaseIntervalSeconds
```

переводится существующим `legacyResourceModelToProcessScenario` в universal profile.

Новый key:

```text
autotrace:process-simulation-profile:v2
```

## Resource helpers

`processSimulationProfile.ts` предоставляет переиспользуемые операции:

```text
createBlankProcessSimulationScenario
migrateLegacyResourceSimulationModel
resizeSimulationJobs
setFixedArrivalInterval
upsertProcessResource
removeProcessResourceFromScenario
setBlockResourceRequirement
applyAutomationResourceDefaults
evaluateProcessSimulationReadiness
```

### Безопасное удаление resource

Удаление resource очищает связанные ссылки из:

```text
requirementsByBlock
calendars
failures
changeovers
```

чтобы profile не оставался с dangling references.

## Simulation readiness

`evaluateProcessSimulationReadiness` сообщает:

```text
totalBlocks
unresolvedTimeBlockIds
invalidRequirementBlockIds
missingResourceIds
resourceCount
simulationReady
```

Неопубликованные LBC timings поэтому не превращаются в фиктивные данные: профиль виден и редактируем, но scheduler честно возвращает ошибку до заполнения времени.

## Universal Scheduler

Simulation v2 запускает:

```ts
simulateUniversalScenario(profile, seed)
```

Следовательно один экран автоматически поддерживает всё, что уже умеет Universal Scheduler:

- resource capacity;
- queues;
- fixed/Poisson arrivals;
- arbitrary priorities;
- stochastic durations;
- retry/rework;
- physical batch cycles;
- batch compatibility;
- sequence-dependent changeovers;
- independent lane setup states;
- shifts/calendars;
- planned downtime;
- MTBF/MTTR failures.

Legacy Resource Simulation поддерживал только базовую часть этого множества.

## Отображаемая статистика

UI показывает:

- makespan;
- P95 cycle time;
- average wait;
- throughput;
- batch fill;
- total changeover time;
- runs/status;
- resource utilization/availability/peak units;
- operation average/P95 queues;
- rework rate;
- timeline первых task runs.

## Parity test

`processSimulationV2Test.ts` строит deterministic no-policy модель и запускает её одновременно через:

```text
legacy simulateResourceConstrainedProcess
Universal simulateUniversalScenario
```

Для migration baseline сравниваются:

- makespan;
- completed jobs;
- total runs;
- average cycle;
- P95 cycle;
- average wait;
- throughput;
- resource busy unit seconds;
- peak units.

Это даёт доказательство semantic parity для старого поддерживаемого подмножества, а не только визуальное сходство UI.

## Архитектурный результат

После Process Math v2 это второй legacy vertical slice, переведённый на `ProcessScenarioProfile`.

Следующие кандидаты:

```text
ProcessRisk
ProcessBatch / BatchRisk
ProcessDigitalTwin
ProcessReliability
ProcessUnifiedTwin
ProcessUnifiedOptimizer
```

Их следует последовательно превращать в views/editors одного profile, а не поддерживать отдельные форматы данных.
