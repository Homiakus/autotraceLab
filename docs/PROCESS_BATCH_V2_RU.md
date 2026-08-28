# Process Batch v2 — единые batch policies в ProcessScenarioProfile

## Цель

Batch и BatchRisk больше не должны иметь собственный формат процесса. Единственным рабочим документом является `ProcessScenarioProfile`, а batch-поведение задаётся полем `batchPolicies` и исполняется Universal Scheduler вместе с остальными policies.

## Основная модель

```text
Domain Pack / Process Math v2 / Simulation v2
                    ↓
          ProcessScenarioProfile
                    ↓
 batchPolicies + compatibility + changeovers
 calendars + failures + priority + retry + uncertainty
                    ↓
          Universal Scheduler
              ↙            ↘
   deterministic Batch    Monte Carlo BatchRisk
```

`ProcessBatchConfig` остаётся низкоуровневым контрактом физического batch-цикла:

- `blockId` — операция, запускаемая общей партией;
- `batchCapacity` — физическая вместимость цикла;
- `minBatchSize` — минимальное желаемое наполнение до запуска;
- `maxWaitSeconds` — максимальное ожидание anchor job перед разрешением неполного цикла.

## Что изменилось

### Один источник истины

Основные URL `/?view=process-batch` и `/?view=process-batch-risk` теперь открывают один `UniversalProcessBatchApp`.

Старые экраны сохранены для сравнения и безопасного отката:

- `/?view=process-batch-legacy`;
- `/?view=process-batch-risk-legacy`.

### BatchRisk больше не отдельный движок

BatchRisk использует `runUniversalProcessMonteCarlo(profile, ...)`. Каждая Monte Carlo итерация проходит через тот же Universal Scheduler, что и deterministic simulation.

Поэтому распределения автоматически учитывают:

- реальное формирование batch cycles;
- compatibility rules по атрибутам jobs;
- sequence-dependent changeovers;
- resource calendars и planned downtime;
- MTBF/MTTR failures;
- priority;
- retry/rework;
- stochastic duration uncertainty.

Дополнительно Universal Monte Carlo возвращает:

- `averageBatchFillPercent`;
- `partialBatchRatePercent`.

### Compatibility не редактируется упрощённым Batch UI

Batch editor изменяет только `batchPolicies`. Политики `compatibility`, пришедшие из Domain Pack или внешнего приложения, сохраняются без изменений.

Это важно для сценариев, где в одну партию нельзя смешивать, например:

- разные рецептуры;
- разные материалы/цвета;
- разные программы обработки;
- разные tenant/customer classes;
- разные диагностические протоколы;
- любые другие доменные атрибуты.

## Legacy migration

Старый ключ:

```text
autotrace:batch-simulation:v1
```

используется только как migration input.

`migrateLegacyBatchPolicies(profile, legacyPolicies)`:

1. сохраняет уже существующие валидные `profile.batchPolicies`;
2. добавляет legacy policies только для блоков, где policy ещё отсутствует;
3. отбрасывает ссылки на несуществующие блоки;
4. нормализует capacity/minBatch/maxWait;
5. не изменяет `compatibility`, `changeovers` и другие rich policies;
6. отмечает источник миграции в metadata.

После миграции рабочим источником остаётся `ProcessScenarioProfile`.

## Public helpers

Через `@autotrace/sdk/process` экспортируются:

- `LEGACY_BATCH_SIMULATION_STORAGE_KEY`;
- `getBatchPolicy`;
- `setProcessBatchPolicy`;
- `removeProcessBatchPolicy`;
- `migrateLegacyBatchPolicies`;
- `defaultBatchPolicyForBlock`;
- `evaluateProcessBatchReadiness`.

## Проверки

`processUniversalBatchV2Test.ts` закрывает следующие инварианты:

1. простой legacy-compatible physical batch cycle даёт одинаковые ключевые результаты в `simulateBatchCycleProcess` и `simulateUniversalScenario`;
2. совпадают makespan, completed jobs, batch cycle count, partial cycles, fill, cycle/wait, throughput и resource busy/peak;
3. setters нормализуют некорректные значения;
4. миграция не перезаписывает уже существующую policy;
5. migration не разрушает compatibility rules;
6. `same` compatibility реально разделяет несовместимые jobs на отдельные physical cycles;
7. Universal Monte Carlo сохраняет batch fill/partial semantics;
8. invalid block references fail closed через readiness/validation.

## Следующий этап

После Batch v2 отдельные legacy Batch/BatchRisk модели перестают быть архитектурными зависимостями. Следующий vertical slice — Digital Twin/priority/rework/arrivals: существующий UI должен стать editor/view тех же полей `ProcessScenarioProfile`, без собственного storage-формата и без параллельного scheduler path.
