# Unified Stochastic Batch Twin

Режим:

```text
/?view=process-unified-twin
```

или:

```text
/#process-unified-twin
```

## Назначение

Этот движок объединяет ранее независимые модели AutoTrace в один дискретно-событийный scheduler:

- индивидуальную стохастику каждой пробы;
- DAG технологического процесса;
- ограниченные ресурсы и capacity;
- batch/rack/rotor cycles;
- рабочие смены ресурсов;
- плановые окна недоступности;
- STAT priority;
- rework отдельных проб;
- случайные отказы оборудования по MTBF/MTTR.

Главное отличие от последовательного запуска отдельных симуляторов: все ограничения участвуют **в одном расписании**. Результат одного механизма меняет формирование следующего batch и очередь ресурсов.

## Индивидуальные операции

Для обычного блока каждая проба имеет собственную длительность:

```text
T(i, block, attempt) = Tbase(block) × K(i, block, attempt)
```

где `K` выбирается из заданного fixed / uniform / triangular распределения.

Sampling детерминирован по `seed + job + block + attempt`, поэтому повторный запуск одинаковой модели воспроизводим и не зависит от количества промежуточных вычислений UI.

## Batch-cycle

Для batch-блока физический аппарат резервируется **один раз на общий цикл**.

Например:

```text
resource.capacity = 1 centrifuge
batchCapacity     = 12 samples
cycle duration    = 8 min
```

означает одну центрифугу с ротором на 12 проб, а не 12 независимых центрифуг.

Для batch задаются:

- `batchCapacity` — максимальная вместимость;
- `minBatchSize` — размер, после которого разрешён запуск без ожидания timeout;
- `maxWaitSeconds` — максимальное ожидание первой готовой пробы.

После определения допустимого времени запуска scheduler дополнительно дозаполняет корзину пробами, которые успели стать ready до фактического захвата ресурса.

## Приоритет внутри batch

При выборе проб учитываются:

1. deadline ожидания batch;
2. STAT priority;
3. ready time;
4. индекс пробы как стабильный tie-breaker.

Это не preemptive scheduling: уже начавшийся batch не разрывается при появлении STAT-пробы.

## Batch rework

Rework применяется к каждой пробе внутри общего цикла независимо.

Пример:

```text
Batch #1: samples 1,2,3,4
QC result after cycle:
1 PASS
2 REWORK
3 PASS
4 PASS
```

После завершения batch:

- 1,3,4 переходят downstream;
- 2 возвращается в ready queue того же блока;
- sample 2 может попасть в совершенно другой следующий batch.

Ресурс первого batch при этом резервировался только один раз.

## Рабочие календари

Используется тот же `ProcessResourceCalendarPolicy`, что и в Process Digital Twin.

Scheduler учитывает:

- повторяющиеся working windows;
- planned downtime;
- `block-overlap` downtime;
- `block-start` failure windows.

Batch должен целиком помещаться в рабочее окно ресурса. Если цикл не помещается до конца смены, весь batch переносится на следующее допустимое окно.

## MTBF/MTTR

В Unified Twin можно передать `failurePolicies`.

Для каждого ресурса строится последовательность:

```text
uptime ~ Exp(MTBF)
repair ~ configured MTTR distribution
```

Отказы преобразуются в `block-start` downtime windows. Уже начатый цикл не прерывается, но новый batch или одиночная операция не стартуют во время ремонта.

UI позволяет включить MTBF/MTTR для любого ресурса. Значение `0` отключает stochastic failures.

## Метрики

Unified Twin считает одновременно:

- makespan;
- average/P95 cycle time;
- average/P95 queue wait;
- throughput и output rate;
- STAT vs routine cycle time;
- rework rate;
- число batch cycles;
- average batch fill;
- partial batch cycles;
- utilization каждого ресурса;
- calendar/failure-aware availability;
- число сгенерированных failure windows;
- bottleneck resource;
- per-block wait/rework/batch statistics.

## Почему это важно для LBC

Реальная LBC-линия редко является последовательностью независимых проб.

Типичный процесс содержит одновременно:

- ручную регистрацию;
- индивидуальную подготовку проб;
- общий centrifuge rotor;
- индивидуальные промежуточные операции;
- общий rack stainer;
- QC/rework;
- человеческие смены;
- технические простои аппаратов.

Поэтому формула

```text
throughput = 1 / sum(stage times)
```

для такой линии почти всегда неверна.

Unified Twin позволяет моделировать фактическое взаимодействие очередей, партий и ресурсов.

## Пример LBC-модели

```text
Arrival
  ↓
Receipt        operator, per-sample, ±15%
  ↓
Prep           operator, per-sample, ±20%
  ↓
Centrifuge     1 machine, batchCapacity=12, minBatch=8, maxWait=10 min
  ↓
Resuspension   per-sample, ±10%
  ↓
Slide prep     per-sample
  ↓
Pap stain      1 stainer, batchCapacity=20
  ↓
QC             per-sample, rework=2%
```

Если QC отправляет одну пробу на повтор, она повторно конкурирует за соответствующий этап и может изменить состав последующих партий.

## Тестовые инварианты

`processUnifiedTwinTest.ts` проверяет:

- один общий batch резервирует аппарат один раз;
- per-sample stochasticity действительно различается между пробами;
- batch rework создаёт новый общий цикл только для повторяемых проб;
- STAT учитывается при формировании batch;
- batch соблюдает рабочие смены;
- MTBF/MTTR увеличивает makespan при частых отказах;
- старые уровни Process Math / Resource Simulation / Batch / Digital Twin / Reliability остаются отдельными тестами CI.

## Текущие границы

1. Отказ `block-start` не прерывает уже запущенный batch.
2. Batch duration sample-ится один раз на физический цикл, что соответствует общей программе центрифуги/stainer.
3. В одной batch-конфигурации пока нет сложной совместимости типов образцов, reagent lots и changeover matrix.
4. Нет конечного срока хранения WIP и spoilage/expiry внутри очереди.
5. Нет cost model и оптимизатора политики запуска batch.

Следующий уровень: sequence-dependent changeover, совместимость партий, reagent/consumable inventory и автоматический поиск оптимальных `minBatch/maxWait/capacity` по SLA + cost + utilization.
