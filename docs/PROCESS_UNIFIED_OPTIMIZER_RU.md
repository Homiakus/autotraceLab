# Batch Policy Optimizer для Unified Twin

Режим:

```text
/?view=process-unified-opt
```

или:

```text
/#process-unified-opt
```

## Задача

Оптимизатор ищет компромисс между двумя противоположными стратегиями:

- ждать более полный batch и реже запускать оборудование;
- запускать batch раньше, уменьшая TAT конкретной пробы.

Для каждого выбранного batch-блока перебираются кандидаты `minBatch` и `maxWait` на одном и том же workload Unified Stochastic Batch Twin.

## Search space

По умолчанию:

```text
minBatch = 1, 50% capacity, 100% capacity
maxWait  = 0, 1, 5, 10, 20 min
```

Если batch-блоков несколько, строится декартово произведение вариантов. Число сценариев ограничивается `maxScenarios`, чтобы браузер не зависал на больших моделях.

## Целевая функция

После симуляции всех допустимых сценариев метрики нормализуются по фактически найденному диапазону. Итоговый score является взвешенной комбинацией:

- throughput — больше лучше;
- P95 cycle time — меньше лучше;
- average queue wait — меньше лучше;
- average batch fill — больше лучше;
- partial batch rate — меньше лучше;
- SLA score — больше лучше.

Вес каждой составляющей задаётся в UI.

Если SLA задан, сценарий получает полный SLA score при `P95 cycle <= SLA`; при превышении score плавно уменьшается пропорционально отклонению.

## Pareto frontier

Помимо одного scalar score строится Pareto frontier.

Сценарий считается Pareto-optimal, если не существует другого сценария, который одновременно:

- имеет throughput не ниже;
- P95 cycle не выше;
- average wait не выше;
- fill rate не ниже;
- partial batch rate не выше;

и хотя бы по одной метрике строго лучше.

Это позволяет не скрывать альтернативы за одной суммарной оценкой.

## Пример

Для ротора на 12 проб:

```text
Policy A
minBatch = 12
maxWait = 20 min
```

может иметь высокий fill, но большой TAT при низком потоке.

```text
Policy B
minBatch = 1
maxWait = 0
```

уменьшает ожидание, но увеличивает число неполных запусков.

Optimizer показывает оба сценария на одинаковом workload и позволяет задать бизнес/клинические веса.

## Интеграция с AutoTrace

Optimizer читает:

- последнюю Resource Simulation model;
- текущие batch configs.

Кнопка **«Применить лучший сценарий»** записывает найденные batch configs обратно в `autotrace:batch-simulation:v1`, после чего их использует Unified Twin и Batch Simulation.

## Тесты

`processUnifiedOptimizerTest.ts` проверяет:

- полный перебор заданного search space;
- выбор полного ротора при fill-only objective;
- выбор раннего запуска при cycle-time-only objective;
- воспроизводимость ранжирования;
- SLA classification;
- ошибку при отсутствии batch-блоков.

## Ограничения

Текущий optimizer оптимизирует `minBatch` и `maxWait` при фиксированном физическом `batchCapacity`.

Следующие расширения:

1. оптимизация числа аппаратов / resource capacity;
2. стоимость реагентов и запуска партии;
3. changeover/setup cost;
4. совместимость типов проб и reagent lots;
5. robust optimization по нескольким Monte Carlo seeds вместо одного сценария;
6. multi-objective evolutionary search для очень большого пространства параметров.
