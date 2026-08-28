# Reliability Twin — MTBF / MTTR для Process Digital Twin

Режим:

```text
/?view=process-reliability
```

или:

```text
/#process-reliability
```

## Цель

Reliability Twin оценивает, как случайные отказы оборудования изменяют технологический процесс: makespan, throughput, availability и вероятность выполнить SLA.

Для каждой Monte Carlo итерации строятся два сценария с одинаковым stochastic workload:

1. baseline без случайных отказов;
2. тот же workload с отказами ресурсов.

За счёт одинакового seed разница между сценариями интерпретируется как вклад надёжности оборудования, а не как случайный разброс поступления или длительности проб.

## MTBF

Время исправной работы между отказами моделируется экспоненциальным распределением:

```text
T_up ~ Exp(mean = MTBF)
```

После завершения ремонта начинается новый интервал uptime.

В текущей версии MTBF отсчитывается по календарному времени модели, а не только по фактическому времени вращения/работы оборудования.

## MTTR

Длительность ремонта имеет одну из моделей:

- `fixed` — постоянный MTTR;
- `uniform` — равномерное распределение вокруг MTTR;
- `triangular` — треугольное распределение с mode = MTTR.

Для uniform/triangular задаётся симметричный spread `±%`.

## Non-preemptive отказ

Случайное окно ремонта имеет режим `block-start`.

Это означает:

- если операция уже началась до момента отказа, она не прерывается;
- пока ресурс находится в repair window, новая операция стартовать не может;
- после ремонта scheduler снова разрешает старт при выполнении остальных ограничений.

Это намеренно отличается от planned downtime, который по умолчанию имеет `block-overlap`: технологическую операцию нельзя заранее запланировать так, чтобы она пересекала известное окно ТО.

## Совместимость с Resource Calendar

Failure windows объединяются с существующими:

- рабочими сменами;
- planned downtime;
- capacity lanes.

Пересекающиеся окна физической недоступности корректно объединяются при вычислении availability, чтобы одно и то же время не вычиталось дважды.

## Monte Carlo

Для каждой итерации:

1. выбирается воспроизводимый iteration seed;
2. рассчитывается baseline Digital Twin;
3. отдельно по каждому ресурсу генерируются failure/repair windows;
4. выполняется тот же Digital Twin с отказами;
5. сохраняются makespan, added delay, throughput, availability и число ремонтов.

Если отказов настолько много, что makespan приближается к заранее построенному failure horizon, horizon автоматически расширяется и сценарий пересчитывается с тем же seed.

## Метрики

Reliability Twin выводит:

- makespan P50/P90/P95/P99;
- baseline makespan P50/P90/P95/P99;
- added failure delay P50/P90/P95/P99;
- throughput distribution;
- availability distribution;
- SLA confidence;
- mean/P95 failures по ресурсу;
- mean/P95 repair downtime;
- mean resource availability.

## Практический пример

```text
Автомат LBC:
MTBF = 168 h
MTTR = 2 h
repair distribution = triangular
spread = ±25%
```

После Monte Carlo можно сравнить, например:

```text
Baseline makespan P95 = 6.2 h
Failure makespan P95  = 7.4 h
Added delay P95       = 1.3 h
SLA <= 8 h            = 96.7%
```

Числа в примере иллюстративные — реальные значения зависят от вашей модели.

## Текущая граница

Эта версия не моделирует физическое прерывание активной операции при аварии. Поэтому она подходит для non-preemptive/finish-current-operation политики и анализа потери доступности, но не описывает crash/restart внутри конкретного процесса.

Следующий уровень:

- `interrupt-active-task`;
- restart / resume / scrap политики;
- стоимость отказа и расходников;
- preventive maintenance optimization;
- operating-time MTBF;
- единый stochastic batch + reliability scheduler.
