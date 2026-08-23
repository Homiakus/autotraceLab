import JSZip from 'jszip';

export async function generateAndDownloadProjectZip(): Promise<void> {
  const zip = new JSZip();

  // Glob all source and config files as raw strings
  const meta = import.meta as unknown as { glob: Function };
  const files = meta.glob(
    [
      '/src/**/*.{ts,tsx,css,json}',
      '/index.html',
      '/package.json',
      '/tsconfig.json',
      '/vite.config.ts',
      '/.env.example',
    ],
    { query: '?raw', import: 'default', eager: true }
  ) as Record<string, string>;

  // Add README.md with comprehensive instructions
  const readmeContent = `# AutoTrace Lab - Graph Placement & Orthogonal Wire Routing Engine

## Обзор проекта
AutoTrace Lab — интерактивная исследовательская платформа и CAD-движок для оптимального размещения функциональных блоков (Sugiyama Layered, TSM Orthogonal Grid, Force-Directed) и трассировки соединительных проводников (Orthogonal A* с G1 скруглениями, Lee Maze Wave Router, Manhattan Channel Router, Bézier Splines).

### Особенности:
1. **Многокритериальная оптимизация (Pareto Multi-Objective)**:
   - Минимизация пересечений проводников и компонентов (приоритет 1).
   - Прямолинейные участки с выходом по нормали и G1 сплайновыми скруглениями.
   - Минимизация изгибов (bends) и общей манхэттенской длины (wirelength).
   - Настраиваемые весовые коэффициенты и пресеты оптимизации.
2. **Сквозная совместная оптимизация (Placement + Routing Co-Optimization)**:
   - Итеративная оптимизация расположения узлов и портов с обратной связью по качеству трасс.
3. **Мобильная адаптация**:
   - Полная поддержка сенсорного управления: панорамирование, pinch-to-zoom, tap-to-connect с увеличенными хитбоксами, адаптивные панели и выдвижные ящики.
4. **IEEE 315 Bridge Jumps**:
   - Автоматическая генерация полукруглых мостиков на пересечениях линий.

## Быстрый старт
\`\`\`bash
npm install
npm run dev
\`\`\`

Приложение откроется на порту \`http://localhost:3000\`.

## Сборка для продакшена
\`\`\`bash
npm run build
\`\`\`
`;

  zip.file('README.md', readmeContent);

  // Populate files into the ZIP
  for (const [path, content] of Object.entries(files)) {
    // Clean leading slash
    const relativePath = path.startsWith('/') ? path.slice(1) : path;
    zip.file(relativePath, content);
  }

  // Generate blob and trigger download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'autotrace-lab-full-source.zip';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
