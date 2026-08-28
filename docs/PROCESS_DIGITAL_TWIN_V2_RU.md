# Digital Twin v2 — один ProcessScenarioProfile

## Цель

Основной Digital Twin больше не должен строить отдельную runtime-модель поверх старого Resource Simulation storage. Стохастические свойства процесса являются частью `ProcessScenarioProfile` и исполняются тем же Universal Scheduler, что Math, Simulation, Risk и Batch.

## Поля профиля

Digital Twin v2 редактирует напрямую:

- `jobs` — количество работ, приоритеты и priority classes;
- `arrivals` — fixed или Poisson arrivals;
- `uncertaintyByBlock` — распределения длительности операций;
- `retryByBlock` — probability/max repeats;
- `calendars` — рабочие окна и planned downtime ресурсов;
- уже существующие `batchPolicies`, `compatibility`, `changeovers`, `failures` остаются частью того же профиля и автоматически учитываются scheduler.

## Основной маршрут

`/?view=process-digital-twin` → `UniversalProcessDigitalTwinApp`.

Legacy экран сохранён:

`/?view=process-digital-twin-legacy`.

## Profile helpers

Добавлен `processDigitalTwinProfile.ts`:

- `setProcessArrival`;
- `setProcessRetry`;
- `retryPercent`;
- `setPeriodicJobPriority`;
- `setDailyResourceSchedule`;
- `evaluateDigitalTwinReadiness`.

Все helpers клонируют profile и не создают параллельный storage format.

## Priority

Периодический high-priority pattern — только convenience operation для UI. Канонические данные после применения находятся в `jobs[].priority` и `jobs[].priorityClass`, поэтому внешний Domain Pack или host может задавать произвольную priority модель без зависимости от UI pattern.

## Calendars

UI предоставляет простую daily-shift проекцию:

- shift enabled;
- start/end hour;
- optional planned downtime.

После редактирования это обычный `ProcessResourceCalendarPolicy`. Universal Scheduler применяет его вместе с resource capacity и failure windows.

## Проверки

`processDigitalTwinV2Test.ts` проверяет:

1. legacy-compatible deterministic stochastic-twin scenario сохраняет базовые simulation semantics;
2. fixed/Poisson arrival normalization;
3. periodic priority materializes directly into jobs;
4. 100% retry с `maxRepeats=1` действительно создаёт один повтор на job;
5. resource shift 08:00–17:00 переносит midnight-ready task на 08:00;
6. удаление calendar policy возвращает ресурс к unrestricted availability;
7. unresolved duration делает Digital Twin profile not-ready.

## Архитектурный результат

После этой миграции цепочка выглядит так:

```text
ProcessScenarioProfile
 ├─ Math
 ├─ Simulation
 ├─ Risk / Monte Carlo
 ├─ Batch / BatchRisk
 └─ Digital Twin
       ↓
 Universal Scheduler
```

Следующий vertical slice — Reliability: `failures` уже принадлежат `ProcessScenarioProfile`, поэтому отдельный Reliability UI должен стать editor/analysis view этого же профиля и использовать Universal Monte Carlo вместо собственной параллельной модели там, где это возможно.
