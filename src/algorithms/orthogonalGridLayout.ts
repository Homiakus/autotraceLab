import { BlockNode, EdgeConnection, AlgorithmStep } from '../types';

/**
 * Orthogonal Grid / Matrix Layout
 * Places nodes in a discrete grid matrix aligning row and column channels.
 */
export function runOrthogonalGridLayout(
  initialNodes: BlockNode[],
  edges: EdgeConnection[]
): { nodes: BlockNode[]; steps: AlgorithmStep[] } {
  const nodes = initialNodes.map(n => ({ ...n }));
  const steps: AlgorithmStep[] = [];

  steps.push({
    stepIndex: 0,
    title: 'Инициализация ортогональной сетки (Grid Slots Init)',
    description: 'Определение размеров дискретных слотов сетки и анализ графа смежности.',
    phase: 'Init',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(edges)),
  });

  // Calculate in/out degrees
  const inDeg = new Map<string, number>();
  const outDeg = new Map<string, number>();
  nodes.forEach(n => {
    inDeg.set(n.id, 0);
    outDeg.set(n.id, 0);
  });
  edges.forEach(e => {
    outDeg.set(e.sourceBlockId, (outDeg.get(e.sourceBlockId) || 0) + 1);
    inDeg.set(e.targetBlockId, (inDeg.get(e.targetBlockId) || 0) + 1);
  });

  // Sort nodes by topological flow (inDeg vs outDeg)
  const sorted = [...nodes].sort((a, b) => {
    const scoreA = (inDeg.get(a.id) || 0) * 10 - (outDeg.get(a.id) || 0);
    const scoreB = (inDeg.get(b.id) || 0) * 10 - (outDeg.get(b.id) || 0);
    return scoreA - scoreB;
  });

  const cols = Math.max(2, Math.ceil(Math.sqrt(nodes.length * 1.5)));
  const cellWidth = 240;
  const cellHeight = 160;
  const originX = 80;
  const originY = 80;

  sorted.forEach((node, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    node.x = originX + col * cellWidth;
    node.y = originY + row * cellHeight;
  });

  steps.push({
    stepIndex: 1,
    title: 'Размещение в матричные ячейки (Matrix Assignment)',
    description: `Узлы равномерно разнесены по ортогональной матрице ${cols}x${Math.ceil(nodes.length / cols)} с сохранением прямых манхэттенских каналов.`,
    phase: 'Final',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(edges)),
  });

  return { nodes, steps };
}
