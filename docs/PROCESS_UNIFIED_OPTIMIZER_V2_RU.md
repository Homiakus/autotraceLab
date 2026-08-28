# Unified Twin / Optimizer v2

## Unified Twin: удалить дублирование, а не переписать ещё раз

Исторический `ProcessUnifiedTwinApp` вручную собирал из старых storage-моделей:

- arrivals;
- batch configs;
- uncertainty;
- rework;
- calendars;
- MTBF/MTTR;
- priority;

и запускал `simulateUnifiedStochasticBatchTwin`.

После миграции Math → Simulation → Risk → Batch → Digital Twin → Reliability эта функциональность уже является обычными полями `ProcessScenarioProfile` и исполняется Universal Scheduler.

Поэтому основной `/?view=process-unified-twin` теперь использует `UniversalProcessDigitalTwinApp`.

Legacy implementation сохранена как:

`/?view=process-unified-twin-legacy`.

Это уменьшает число независимых UI/state/scheduler paths без потери возможностей.

## Universal Optimizer v2

Старый optimizer строил отдельную `StoredSimulationModel`, читал legacy batch storage и оценивал кандидатов через `simulateUnifiedStochasticBatchTwin`.

Новый `optimizeUniversalBatchPolicy(profile, options)`:

1. принимает полный `ProcessScenarioProfile`;
2. генерирует варианты только для выбранных `batchPolicies`;
3. для каждого кандидата клонирует исходный profile;
4. изменяет только `minBatchSize`/`maxWaitSeconds` выбранных batch policies;
5. запускает `simulateUniversalScenario(candidate, sameSeed)`;
6. сохраняет compatibility, changeovers, calendars, failures, priority, retry, uncertainty, resources и objectives;
7. рассчитывает прежний weighted score и Pareto frontier;
8. дополнительно показывает domain-neutral `objectiveScore` из `scoreUniversalScenario`.

Основной маршрут:

`/?view=process-unified-opt` → `UniversalProcessOptimizerApp`.

Legacy route:

`/?view=process-unified-opt-legacy`.

## Оптимизируемые метрики

Для backward-compatible ranking используются:

- throughput — maximize;
- P95 cycle — minimize;
- average wait — minimize;
- batch fill — maximize;
- partial batch rate — minimize;
- SLA P95 score.

Domain Pack может отдельно определять `profile.objectives`; их aggregate score показывается для каждого scenario и используется как tie-breaker, не меняя существующую scoring семантику.

## Применение лучшего сценария

Кнопка Apply best сохраняет полный `best.profile` обратно в `PROCESS_SIMULATION_PROFILE_STORAGE_KEY`. После этого Simulation, Risk, Batch, Digital Twin и Reliability видят новую batch policy без конвертации.

## Verification

`processUniversalOptimizerV2Test.ts` проверяет:

- parity с legacy `optimizeUnifiedBatchPolicy` на legacy-compatible scenario;
- одинаковое число generated/evaluated scenarios;
- сохранение best batch config и ключевых metrics;
- baseline равен прямому `simulateUniversalScenario`;
- compatibility/changeover/resource policies не теряются в кандидатах;
- objective score вычисляется для каждого scenario;
- отсутствие batch policy завершается fail-closed.

## Результат архитектуры

Основные process views теперь являются разными проекциями одного документа и одного runtime:

```text
ProcessScenarioProfile
  ├─ Math
  ├─ Simulation
  ├─ Risk
  ├─ Batch / BatchRisk
  ├─ Digital Twin / Unified Twin
  ├─ Reliability
  └─ Optimizer
          ↓
    Universal Scheduler
```

Старые специализированные scheduler implementations остаются regression/parity references до отдельной deprecation/remove итерации.
