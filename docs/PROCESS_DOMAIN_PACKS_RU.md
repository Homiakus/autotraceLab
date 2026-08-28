# Process Domain Packs — предметная область без форка ядра

## Зачем

Universal Process Core не должен изменяться при появлении новой области применения.

Вместо этого используется два уровня расширения:

```text
Portable Domain Pack Manifest
        +
Runtime Adapter (optional)
```

## Portable Domain Pack Manifest

`ProcessDomainPackManifest` не содержит функций и может быть сохранён как JSON.

Он задаёт:

- id/version/name;
- пользовательский словарь терминов;
- определения job attributes;
- profile templates;
- default optimization objectives;
- metadata.

Например одна и та же сущность `job` может отображаться пользователю как:

```text
order
request
sample
task
case
part
shipment
work item
```

Но scheduler по-прежнему работает с `job`.

## Attribute definitions

Pack может описывать ожидаемые attributes:

```json
{
  "key": "material",
  "label": "Material",
  "dataType": "string",
  "required": true,
  "group": "routing"
}
```

Поддерживаются:

```text
string
number
boolean
enum
```

Также доступны defaultValue, allowedValues, unit, description и metadata.

## Profile templates

Pack может содержать несколько готовых `ProcessScenarioProfile`.

Например manufacturing pack может иметь:

```text
single machine cell
batch oven line
paint line
assembly line
```

Это шаблоны данных, а не новые scheduler classes.

## Runtime Adapter

Некоторые интеграции требуют кода, который нельзя безопасно/переносимо хранить в JSON manifest.

`ProcessRuntimeAdapter` подключается только во время исполнения host-приложения и может:

- дополнительно валидировать job;
- вычислять/добавлять derived attributes;
- возвращать custom numeric metrics для objectives/dashboard.

Пример применения:

```text
ERP adapter
  ↓
derive productFamily / dueClass
  ↓
Universal Process Profile
  ↓
Universal Policy Scheduler
```

Или:

```text
laboratory adapter
  ↓
derive sampleClass / stabilityWindow
```

Сам scheduler не знает, откуда эти значения появились.

## Registry

`ProcessDomainPackRegistry` поддерживает:

```text
registerPack
unregisterPack
getPack
listPacks
registerRuntimeAdapter
unregisterRuntimeAdapter
listRuntimeAdapters
createProfile
prepareProfile
collectCustomMetrics
```

Удаление pack автоматически удаляет связанные runtime adapters.

## Fail closed versioning

Profile и Pack имеют независимый `schemaVersion`.

Текущая версия:

```text
1.0
```

`parseProcessScenario` и `parseProcessDomainPack` не пытаются угадывать будущий неизвестный формат. Неизвестная версия отклоняется.

Новые версии должны получать явную migration function.

## JSON Schemas

Portable schemas:

```text
schemas/process-scenario.schema.json
schemas/process-domain-pack.schema.json
```

Они предназначены для внешней валидации в:

- Go;
- Node.js;
- CLI;
- CI;
- Electron/Tauri;
- backend services;
- генераторах конфигураций;
- LLM/agent workflows.

## Legacy adapter

`legacyResourceModelToProcessScenario` переводит старую Resource Simulation model в `ProcessScenarioProfile`.

Адаптер намеренно не придумывает предметные attributes. Он создаёт generic jobs, а Domain Pack/Runtime Adapter может затем обогатить их.

Это сохраняет миграционный путь без big-bang rewrite.

## Built-in packs

В репозитории есть три демонстрационных pack:

```text
generic-manufacturing
generic-service
generic-compute
```

Они используют один и тот же process core.

## Граница ответственности

### Core отвечает за

- DAG;
- время и формулы;
- ресурсы/capacity;
- batch;
- compatibility;
- changeover;
- uncertainty;
- retries;
- calendars;
- failures;
- scheduling;
- statistics;
- optimization primitives.

### Pack отвечает за

- предметные названия;
- типовые attributes;
- шаблоны;
- стандартные objectives;
- декларативные политики.

### Runtime Adapter отвечает за

- интеграцию с внешней системой;
- derived attributes;
- дополнительную domain validation;
- custom metrics.

## Инвариант расширяемости

Добавление новой предметной области не является основанием добавлять:

```ts
if (domain === 'laboratory') ...
if (domain === 'manufacturing') ...
```

в Process Core.

Если новой области не хватает возможности, сначала проверяется, можно ли выразить её:

1. существующим attribute/policy;
2. новым универсальным policy contract;
3. runtime adapter;
4. только затем — новым generic primitive в core.
