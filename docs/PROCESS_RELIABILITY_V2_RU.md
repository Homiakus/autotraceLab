# Reliability v2 — MTBF/MTTR как policy ProcessScenarioProfile

## Цель

`failures` уже являются частью `ProcessScenarioProfile`, поэтому Reliability не должен поддерживать собственную копию процесса и отдельный scheduler path.

Основной маршрут `/?view=process-reliability` использует Universal Scheduler. Старый экран сохранён как `/?view=process-reliability-legacy`.

## Paired Monte Carlo

Для каждой итерации создаются две модели с одинаковым seed:

1. **baseline** — полный профиль, но без `failures`;
2. **failure case** — исходный полный профиль.

Все остальные свойства одинаковы:

- arrivals;
- stochastic durations;
- priority;
- retry/rework;
- batch cycles;
- compatibility;
- changeovers;
- calendars;
- resource capacities.

Поэтому `addedDelaySeconds = failure makespan - baseline makespan` изолирует вклад отказов значительно лучше, чем сравнение независимых случайных прогонов.

## API

Добавлен `processUniversalReliability.ts`:

- `runUniversalReliabilityMonteCarlo`;
- `setResourceFailurePolicy`;
- `failurePolicyForResource`.

Результат содержит распределения makespan, baseline makespan, added delay, throughput, availability, changeover и rework, а также SLA confidence и resource-level failure/availability statistics.

## Profile editor

`UniversalProcessReliabilityApp` редактирует `profile.failures` напрямую:

- enable/disable policy;
- MTBF;
- MTTR;
- fixed/uniform/triangular repair distribution;
- repair spread.

Monte Carlo запускается по snapshot, поэтому редактирование поля не запускает сотни симуляций на каждый ввод.

## Verification

`processUniversalReliabilityV2Test.ts` проверяет:

- профиль без failures имеет нулевой paired added delay;
- baseline и failure distributions совпадают при отсутствии failures;
- aggressive MTBF генерирует failure windows;
- failures снижают resource availability;
- одинаковый profile + seed воспроизводим;
- failure policy можно безопасно добавить/удалить;
- неизвестный resource отклоняется fail-closed.

## Архитектурный результат

После Reliability v2 основные аналитические экраны Math, Simulation, Risk, Batch, Digital Twin и Reliability работают от одного `ProcessScenarioProfile` и одного Universal Scheduler. Legacy engines остаются только как regression/parity reference и migration compatibility layer.
