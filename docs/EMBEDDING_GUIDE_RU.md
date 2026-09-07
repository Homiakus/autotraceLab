# Руководство по интеграции и кастомизации AutoTrace SDK

Пакет `@autotrace/sdk` спроектирован по принципу **модульного разделения слоев (Clean Layered Architecture)**:
- **Базовое ядро (Headless Core)** — чистый TypeScript, **0 внешних зависимостей** в runtime. Не тянет за собой React, тяжелые фреймворки или UI-библиотеки. Работает в Node.js, CLI, Web Workers, бэкендах и любых фронтенд-фреймворках (Vue, Svelte, Angular, Solid, Vanilla JS).
- **Опциональный UI-виджет** (`@autotrace/sdk/labtrace-ui`) — изолирован в отдельный субпуть с `peerDependencies`, подключается только если вам нужен готовый интерактивный редактор на React.

---

## 1. Установка в проект

```bash
npm install @autotrace/sdk
```

Если вы используете **только алгоритмы, трассировку, расчеты или рендеринг в SVG**, никаких других пакетов устанавливать не нужно!

Если вам нужен готовый React-компонент холста (`@autotrace/sdk/labtrace-ui`), установите React и иконки:
```bash
npm install react react-dom lucide-react
```

---

## 2. Быстрый старт (Минимум кода, 0 мусора)

### Вариант А: Быстрая трассировка и экспорт в SVG через `routeSimpleGraph`

```typescript
import { routeSimpleGraph } from '@autotrace/sdk';

const result = routeSimpleGraph({
  title: 'Микросервисный конвейер',
  nodes: [
    { id: 'gateway', title: 'API Gateway', shape: 'rounded' },
    { id: 'auth', title: 'Auth Service', shape: 'chip_ic' },
    { id: 'db', title: 'User DB', shape: 'diamond' },
  ],
  edges: [
    { from: 'gateway', to: 'auth', label: 'JWT Check' },
    { from: 'auth', to: 'db', label: 'SQL Query' },
  ],
  autoLayout: 'sugiyama', // Автоматическое послойное размещение
  options: 'presentation', // Пресет красивых плавных скруглений
  theme: 'dark',           // Встроенная темная тема
});

// Получаем чистый SVG-код (для вставки в HTML, сохранения в файл или отправки клиенту)
const svgString = result.toSvg();

// А также точные координаты узлов и ортогональные трассы для собственного рендера:
console.log(result.nodes);
console.log(result.edges);
```

---

### Вариант Б: Текучий построитель (Fluent `DiagramBuilder`)

```typescript
import { DiagramBuilder } from '@autotrace/sdk';

const diagram = new DiagramBuilder('presentation', 'blueprint')
  .setTitle('Архитектура контроллера')
  .addNode({ id: 'sensor', title: 'Датчик давления', x: 50, y: 100, shape: 'circle' })
  .addNode({ id: 'mcu', title: 'STM32 MCU', x: 300, y: 100, shape: 'chip_ic' })
  .addNode({ id: 'valve', title: 'Клапан', x: 550, y: 100, shape: 'rounded' })
  .connect('sensor', 'mcu', { label: 'SPI', color: '#38bdf8' })
  .connect('mcu', 'valve', { label: 'PWM Out', color: '#f43f5e' });

// Трассировка с 90° углами и предотвращением наложений
const { nodes, edges, metrics } = diagram.route();

// Генерация SVG-документа
const svg = diagram.toSvg();
```

---

## 3. Простая кастомизация (Customization)

### 3.1. Темы оформления (Themes)

В библиотеку встроены готовые темы:
- `'light'` — чистый строгий светлый стиль для документов и отчетов;
- `'dark'` — современный темный стиль в духе GitHub Dark;
- `'blueprint'` — классический инженерный синий чертеж с моноширинными шрифтами;
- `'cyberpunk'` — неоновый стиль с акцентами цвета фуксии и циан;
- `'minimal'` — монохромная графика без фоновой сетки.

#### Создание собственной темы:

```typescript
import { resolveTheme, DiagramBuilder } from '@autotrace/sdk';

const myBrandTheme = resolveTheme({
  name: 'corp-brand',
  background: '#ffffff',
  gridColor: '#f1f5f9',
  nodeFill: '#f8fafc',
  nodeStroke: '#0284c7',
  nodeRadius: 12,
  edgeColor: '#0369a1',
  edgeWidth: 2,
  fontFamily: 'Inter, sans-serif',
});

const builder = new DiagramBuilder('balanced', myBrandTheme);
```

---

### 3.2. Профили трассировки (Routing Profiles)

Вы можете переключать поведение трассировщика одним словом или точечно переопределять параметры:

| Профиль | Назначение | Особенности |
|---|---|---|
| `'presentation'` | Презентации, архитектурные схемы | Плавные G1 скругления углов ($R=16$), увеличенные зазоры, мостики (jump bridges) |
| `'eda_compact'` | Печатные платы, плотные шины | Минимальные зазоры ($10\text{px}$), жесткий штраф за изгибы, малый радиус |
| `'workflow'` | Бизнес-процессы и пайплайны | Длинные прямые выходы из портов ($30\text{px}$), читаемые стрелки |
| `'fast'` | Огромные графы (10 000+ узлов) | Максимальная скорость, отключено избыточное сглаживание |
| `'balanced'` | Стандартный сбалансированный режим | Надежные безопасные отступы и 90° выходы |

```typescript
// Тонкая настройка:
const diagram = new DiagramBuilder({
  obstacleClearance: 20, // Зазор до препятствий
  bendPenalty: 60,       // Жесткий штраф за лишние повороты
  smoothCorners: true,   // Скругление углов
  cornerRadius: 14,      // Радиус скругления дуги
  jumpBridges: true,     // Мостики в точках пересечения линий
});
```

---

### 3.3. Формы узлов и гибкое размещение портов

Поддерживаются 6 геометрических форм:
- `'rounded'` — скругленный прямоугольник (по умолчанию);
- `'rectangle'` — классический блок;
- `'chip_ic'` — микросхема с контактами;
- `'circle'` — круговой узел;
- `'diamond'` — ромб (условие / решение);
- `'hexagon'` — шестиугольник (состояние / подготовка).

```typescript
builder.addNode({
  id: 'decision',
  title: 'Проверка качества',
  shape: 'diamond',
  inputs: ['sample_in'],
  outputs: [
    { id: 'pass', name: 'Годен', side: 'right' },
    { id: 'fail', name: 'Брак', side: 'bottom' },
  ],
});
```
*AutoTrace автоматически рассчитывает минимальный размер блока (`applyBlockAutoSizing`), чтобы порты не слипались при любом их количестве.*

---

## 4. Использование в React (`@autotrace/sdk/labtrace-ui`)

Если вы хотите встроить полноценный интерактивный редактор с панорамированием, зумом и выделением:

```tsx
import React, { useState } from 'react';
import { DiagramCanvas, routeOrthogonal, BlockNode, EdgeConnection } from '@autotrace/sdk/labtrace-ui';
import '@autotrace/sdk/labtrace-ui/style.css';

export function MyDiagramEditor() {
  const [nodes, setNodes] = useState<BlockNode[]>([...]);
  const [edges, setEdges] = useState<EdgeConnection[]>([...]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <DiagramCanvas
        nodes={nodes}
        edges={edges}
        onNodesChange={setNodes}
        onEdgesChange={setEdges}
      />
    </div>
  );
}
```

---

## 5. Имитационное моделирование процессов (`@autotrace/sdk/process`)

Если вам требуется дискретно-событийный симулятор, стохастический цифровой двойник или расчет надежности (MTBF/MTTR):

```typescript
import { simulateUniversalScenario, ProcessScenarioProfile } from '@autotrace/sdk/process';

const scenario: ProcessScenarioProfile = {
  schemaVersion: 2,
  id: 'lab-analysis',
  name: 'Клинический анализ',
  jobs: [{ id: 'sample-1', priority: 10 }, { id: 'sample-2', priority: 1 }],
  blocks: [
    { id: 'prep', title: 'Пробоподготовка', formula: '120', dependencies: [] },
    { id: 'scan', title: 'Сканирование', formula: '300', dependencies: ['prep'] },
  ],
  resources: [
    { id: 'operator', name: 'Лаборант', capacity: 1 },
    { id: 'scanner', name: 'Сканер', capacity: 2 },
  ],
  requirementsByBlock: {
    prep: [{ resourceId: 'operator', units: 1 }],
    scan: [{ resourceId: 'scanner', units: 1 }],
  },
};

const result = simulateUniversalScenario(scenario);
console.log('Makespan:', result.stats.makespanSeconds);
console.log('Throughput per hour:', result.stats.throughputPerHour);
```

---

## 6. Дерево экспорта и Tree-Shaking

Благодаря строгой изоляции в `package.json`:
- `import { ... } from '@autotrace/sdk'` ➔ берет **только** чистые алгоритмы трассировки (0 зависимостей).
- `import { ... } from '@autotrace/sdk/process'` ➔ берет **только** процессное ядро симуляции.
- `import { ... } from '@autotrace/sdk/themes'` ➔ стили и цветовые палитры.
- `import { ... } from '@autotrace/sdk/labtrace-ui'` ➔ React-компоненты для интерактивного интерфейса.
