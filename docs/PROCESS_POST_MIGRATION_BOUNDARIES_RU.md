# Post-migration boundaries — Universal Process production path

## Зачем нужен отдельный consolidation этап

После миграции всех основных process views старые UI и schedulers остаются полезными как:

- regression/parity reference;
- migration compatibility;
- временный rollback path.

Но их наличие в репозитории не должно означать, что production entry point загружает их вместе с Universal Core.

## Route-level code splitting

`src/main.tsx` больше не делает статические imports route applications. Все крупные поверхности загружаются через `React.lazy(() => import(...))` и `Suspense`.

Это относится как к universal views, так и к legacy regression routes.

Следствия:

1. открытие основного AutoTrace canvas не должно загружать process workbenches;
2. открытие Universal Simulation не должно загружать legacy Risk/Batch/Twin UI;
3. legacy scheduler/UI code загружается только при явном переходе на `*-legacy` route;
4. сохранение rollback routes больше не означает обязательную стоимость initial bundle.

## Primary route architecture guard

`processPrimaryRouteBoundaryTest.ts` проверяет primary Universal views:

- Universal Process Math;
- Simulation;
- Risk;
- Batch;
- Digital Twin / Unified Twin;
- Reliability;
- Optimizer;
- Universal Process Lab.

Им запрещено напрямую использовать:

- legacy localStorage keys;
- legacy resource scheduler;
- legacy Monte Carlo;
- legacy batch scheduler;
- legacy stochastic twin;
- legacy reliability runner;
- legacy unified twin/optimizer;
- raw `LBC_PLATFORMS`.

Domain-specific LBC доступен Universal Core только через Domain Pack/template boundary.

## Initial bundle guard

После `npm run build` скрипт `verifyProcessEntryBundle.ts`:

1. находит module entry из `dist/index.html`;
2. проверяет отсутствие legacy storage/scheduler markers в initial entry JS;
3. проверяет наличие нескольких JS chunks, то есть фактическое route splitting.

Это дополняет source-level test реальной проверкой production build artifact.

## Legacy policy

Legacy routes пока не удаляются. Их назначение явно ограничено:

- regression/parity;
- migration validation;
- аварийное сравнение поведения.

Новые функции не должны добавляться только в legacy implementations. Любое новое production поведение должно сначала появляться в `ProcessScenarioProfile` / Universal Scheduler / Domain Pack contracts.

## Следующий consolidation шаг

После закрепления route boundaries можно безопасно переходить к deprecation inventory старых engines и измерять, какие из них ещё нужны только тестам. Удаление должно происходить отдельно, только после покрытия эквивалентных invariant/parity tests и без потери migration readers.
