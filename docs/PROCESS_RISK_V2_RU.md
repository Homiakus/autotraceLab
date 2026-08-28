# Process Risk v2 — Monte Carlo над Universal Scheduler

## Принцип

Risk больше не строит отдельную упрощённую модель процесса.

```text
ProcessScenarioProfile
        ↓
Universal Policy Scheduler
        ↓ × N seeds
Universal Monte Carlo
```

Основной экран:

```text
/?view=process-risk
```

Legacy экран сохранён:

```text
/?view=process-risk-legacy
```

## Что анализируется

Каждая Monte Carlo итерация вызывает `simulateUniversalScenario(profile, seed_i)`, поэтому распределения учитывают всё, что содержится в profile:

- jobs/arrivals/priorities;
- DAG и stochastic durations;
- resource capacity;
- batch cycles;
- compatibility;
- sequence-dependent changeovers;
- calendars/planned downtime;
- MTBF/MTTR failures;
- retry/rework.

Старый Risk использовал `simulateResourceConstrainedProcess` и поэтому не видел новые policy contracts.

## Uncertainty

Неопределённость хранится прямо в:

```text
profile.uncertaintyByBlock
```

UI helper `setSymmetricBlockUncertainty` переводит ±P% в triangular policy:

```text
min  = 1 - P/100
mode = 1
max  = 1 + P/100
```

0% означает `fixed`.

Изменения сохраняются в том же Simulation v2 profile:

```text
autotrace:process-simulation-profile:v2
```

Поэтому цепочка Math → Simulation → Risk работает с одним документом.

## Snapshot semantics

Редактирование uncertainty не запускает сотни симуляций на каждую клавишу.

Кнопка запуска фиксирует:

- snapshot profile;
- iterations;
- seed;
- SLA makespan.

После этого Monte Carlo воспроизводим: одинаковые profile + seed дают одинаковый результат.

## Распределения

Возвращаются mean/min/max/P50/P90/P95/P99 для:

- makespan;
- average cycle;
- P95 cycle;
- throughput;
- average wait;
- P95 wait;
- total changeover time;
- rework rate.

Также вычисляется вероятность выполнения SLA makespan.

## Capacity planner

`planUniversalResourceCapacity` делает paired what-if для каждого resource:

```text
baseline profile
        ↓
resource capacity + 1
        ↓
same seed / same remaining profile
```

Сравниваются:

- makespan;
- throughput;
- wait;
- utilization;
- changeover time.

Score сохраняет прежнюю понятную эвристику:

```text
45% makespan reduction
40% throughput gain
15% non-negative wait reduction
```

Но симуляция кандидатов теперь выполняется Universal Scheduler.

## Проверки

`processUniversalRiskV2Test.ts` проверяет:

1. fixed-uncertainty parity со старым Monte Carlo на legacy-compatible сценарии;
2. воспроизводимость одинакового seed;
3. ненулевое distribution spread при stochastic duration;
4. учёт sequence-dependent changeover;
5. учёт retry/rework;
6. uncertainty helper round-trip;
7. capacity +1 scenarios для всех ресурсов.

## Архитектурный результат

Три последовательных уровня уже используют один profile:

```text
Process Math v2
      ↓
Process Simulation v2
      ↓
Process Risk v2
```

Следующий шаг — таким же образом поглотить отдельные Batch/BatchRisk и Digital Twin настройки в тот же `ProcessScenarioProfile`.