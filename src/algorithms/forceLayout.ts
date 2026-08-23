import { BlockNode, EdgeConnection, AlgorithmStep } from '../types';
import { getPortCoordinates } from './blockGeometry';

/**
 * Force-Directed Layout with Flow Direction Bias & Port Alignment
 * Uses spring forces along edges, repulsive Coulomb forces between blocks,
 * and a directional flow potential (left-to-right).
 */
export function runForceDirectedLayout(
  initialNodes: BlockNode[],
  edges: EdgeConnection[],
  iterations = 120
): { nodes: BlockNode[]; steps: AlgorithmStep[] } {
  const nodes = initialNodes.map(n => ({ ...n }));
  const steps: AlgorithmStep[] = [];

  const kRepulse = 80000;
  const kSpring = 0.05;
  const kFlow = 0.4;
  const desiredDistance = 220;

  steps.push({
    stepIndex: 0,
    title: 'Начало силовой симуляции (Force-Directed Init)',
    description: 'Инициализация векторов сил: отталкивание тел блоков (Кулон) + притяжение связанных портов (Гук) + направленный поток X-гравитации.',
    phase: 'Init',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(edges)),
  });

  const nodeMap = new Map<string, BlockNode>(nodes.map(n => [n.id, n]));

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { fx: number; fy: number }>();
    nodes.forEach(n => forces.set(n.id, { fx: 0, fy: 0 }));

    // 1. Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const u = nodes[i];
        const v = nodes[j];
        const dx = (u.x + u.width / 2) - (v.x + v.width / 2);
        const dy = (u.y + u.height / 2) - (v.y + v.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;

        // Bounding box padding consideration
        const minDist = Math.max(u.width, u.height) / 2 + Math.max(v.width, v.height) / 2 + 40;
        const effectiveDist = Math.max(dist, 10);

        const repForce = (kRepulse / (effectiveDist * effectiveDist)) * (dist < minDist ? 2.5 : 1);
        const fx = (dx / dist) * repForce;
        const fy = (dy / dist) * repForce;

        forces.get(u.id)!.fx += fx;
        forces.get(u.id)!.fy += fy;
        forces.get(v.id)!.fx -= fx;
        forces.get(v.id)!.fy -= fy;
      }
    }

    // 2. Spring attraction along edges & Flow bias (source is left of target)
    edges.forEach(e => {
      const u = nodeMap.get(e.sourceBlockId);
      const v = nodeMap.get(e.targetBlockId);
      if (!u || !v) return;

      const uPortPos = getPortCoordinates(u, e.sourcePortId, true);
      const vPortPos = getPortCoordinates(v, e.targetPortId, false);

      const dx = vPortPos.x - uPortPos.x;
      const dy = vPortPos.y - uPortPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      // Spring displacement
      const displacement = dist - desiredDistance;
      const springForce = displacement * kSpring;

      const fx = (dx / dist) * springForce;
      const fy = (dy / dist) * springForce;

      forces.get(u.id)!.fx += fx;
      forces.get(u.id)!.fy += fy;
      forces.get(v.id)!.fx -= fx;
      forces.get(v.id)!.fy -= fy;

      // Flow bias: encourage u to be to the left of v
      if (u.x + u.width > v.x - 40) {
        const overlapX = (u.x + u.width) - (v.x - 40);
        forces.get(u.id)!.fx -= overlapX * kFlow;
        forces.get(v.id)!.fx += overlapX * kFlow;
      }
    });

    // 3. Apply displacement with cooling (temperature), respecting isPinned
    const temp = Math.max(0.05, 1 - iter / iterations);
    nodes.forEach(n => {
      if (n.isPinned) return; // Strict pinned invariant

      const f = forces.get(n.id)!;
      const moveX = Math.max(-25, Math.min(25, f.fx * 0.1 * temp));
      const moveY = Math.max(-25, Math.min(25, f.fy * 0.1 * temp));

      n.x = Math.max(30, n.x + moveX);
      n.y = Math.max(30, n.y + moveY);
    });

    if (iter === Math.floor(iterations / 2)) {
      steps.push({
        stepIndex: 1,
        title: 'Фаза релаксации силового поля (50% итераций)',
        description: 'Блоки расступаются под действием сил отталкивания, формируя свободные промежутки для трассировки.',
        phase: 'Relaxation',
        nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
        edgesSnapshot: JSON.parse(JSON.stringify(edges)),
      });
    }
  }

  // Final snap & align to positive coordinate bounds
  const minX = Math.min(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));
  nodes.forEach(n => {
    n.x = Math.round((n.x - minX + 60) / 20) * 20;
    n.y = Math.round((n.y - minY + 60) / 20) * 20;
  });

  steps.push({
    stepIndex: 2,
    title: 'Завершение силовой компоновки (Equilibrium)',
    description: 'Система достигла минимума потенциальной энергии. Позиции привязаны к сетке шага 20px.',
    phase: 'Final',
    nodesSnapshot: JSON.parse(JSON.stringify(nodes)),
    edgesSnapshot: JSON.parse(JSON.stringify(edges)),
  });

  return { nodes, steps };
}
