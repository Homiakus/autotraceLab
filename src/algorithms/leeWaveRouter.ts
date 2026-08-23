import { BlockNode, EdgeConnection, Point, RoutingOptions } from '../types';
import { getPortCoordinates, simplifyOrthogonalPath, computeAdaptivePortStub } from './orthogonalAStarRouter';
import { cleanOrthogonalArtifacts } from './wireArtifactCleaner';

export interface LeeDebugWave {
  x: number;
  y: number;
  val: number;
  type: 'wall' | 'wave' | 'path' | 'start' | 'end';
}

/**
 * Lee's Wave Propagation Maze Router (Алгоритм Ли / Волновой трассировщик)
 * Explores concentric BFS wavefronts and backtracks to find the optimal shortest path on grid.
 */
export function routeLeeWave(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  options: RoutingOptions
): { edges: EdgeConnection[]; debugWaveCells: LeeDebugWave[] } {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const gridSize = Math.max(12, options.gridSize || 16);
  const clearance = options.obstacleClearance || 12;
  const isAdaptive = options.adaptivePortExitOffset !== false;
  const baseStub = options.portExitOffset || 20;

  // Grid bounds
  const minX = Math.min(...nodes.map(n => n.x)) - 80;
  const maxX = Math.max(...nodes.map(n => n.x + n.width)) + 80;
  const minY = Math.min(...nodes.map(n => n.y)) - 80;
  const maxY = Math.max(...nodes.map(n => n.y + n.height)) + 80;

  const cols = Math.ceil((maxX - minX) / gridSize);
  const rows = Math.ceil((maxY - minY) / gridSize);

  // Obstacle grid (-1 = empty, -2 = obstacle)
  const baseGrid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(-1));

  // Mark block obstacles
  nodes.forEach(node => {
    const nMinC = Math.max(0, Math.floor((node.x - clearance - minX) / gridSize));
    const nMaxC = Math.min(cols - 1, Math.ceil((node.x + node.width + clearance - minX) / gridSize));
    const nMinR = Math.max(0, Math.floor((node.y - clearance - minY) / gridSize));
    const nMaxR = Math.min(rows - 1, Math.ceil((node.y + node.height + clearance - minY) / gridSize));

    for (let r = nMinR; r <= nMaxR; r++) {
      for (let c = nMinC; c <= nMaxC; c++) {
        baseGrid[r][c] = -2; // Obstacle wall
      }
    }
  });

  const allDebugCells: LeeDebugWave[] = [];

  const routedEdges = edges.map((edge, edgeIdx) => {
    const sourceNode = nodeMap.get(edge.sourceBlockId);
    const targetNode = nodeMap.get(edge.targetBlockId);
    if (!sourceNode || !targetNode) return edge;

    const sourcePos = getPortCoordinates(sourceNode, edge.sourcePortId, true);
    const targetPos = getPortCoordinates(targetNode, edge.targetPortId, false);

    const sourceStub = computeAdaptivePortStub(
      sourcePos,
      targetPos,
      sourceNode,
      targetNode,
      nodes,
      baseStub,
      isAdaptive
    );

    const targetStub = computeAdaptivePortStub(
      targetPos,
      sourcePos,
      targetNode,
      sourceNode,
      nodes,
      baseStub,
      isAdaptive
    );

    const startX = sourcePos.x + sourcePos.normal.dx * sourceStub;
    const startY = sourcePos.y + sourcePos.normal.dy * sourceStub;
    const endX = targetPos.x + targetPos.normal.dx * targetStub;
    const endY = targetPos.y + targetPos.normal.dy * targetStub;

    const startC = Math.max(0, Math.min(cols - 1, Math.round((startX - minX) / gridSize)));
    const startR = Math.max(0, Math.min(rows - 1, Math.round((startY - minY) / gridSize)));
    const endC = Math.max(0, Math.min(cols - 1, Math.round((endX - minX) / gridSize)));
    const endR = Math.max(0, Math.min(rows - 1, Math.round((endY - minY) / gridSize)));

    // Clone base grid for wave propagation
    const grid: number[][] = baseGrid.map(row => [...row]);

    // Clear start and end cells
    grid[startR][startC] = 0;
    if (grid[endR][endC] === -2) grid[endR][endC] = -1;

    // Queue for BFS with O(1) dequeue
    const queue: [number, number][] = [[startR, startC]];
    let head = 0;
    let reached = false;

    const dR = [0, 0, 1, -1];
    const dC = [1, -1, 0, 0];

    while (head < queue.length) {
      const [r, c] = queue[head++];
      const currentDist = grid[r][c];

      if (r === endR && c === endC) {
        reached = true;
        break;
      }

      for (let d = 0; d < 4; d++) {
        const nr = r + dR[d];
        const nc = c + dC[d];

        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          if (grid[nr][nc] === -1) {
            grid[nr][nc] = currentDist + 1;
            queue.push([nr, nc]);

            // Sample debug cells for visual effect (first 2 edges)
            if (edgeIdx < 2 && (currentDist + 1) % 2 === 0 && allDebugCells.length < 240) {
              allDebugCells.push({
                x: minX + nc * gridSize,
                y: minY + nr * gridSize,
                val: currentDist + 1,
                type: 'wave',
              });
            }
          }
        }
      }
    }

    // Backtrack from end to start
    const gridPath: Point[] = [];
    if (reached) {
      let currR = endR;
      let currC = endC;
      gridPath.push({ x: minX + currC * gridSize, y: minY + currR * gridSize });

      while (currR !== startR || currC !== startC) {
        let bestNeighborR = currR;
        let bestNeighborC = currC;
        let minVal = grid[currR][currC];

        for (let d = 0; d < 4; d++) {
          const nr = currR + dR[d];
          const nc = currC + dC[d];

          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const val = grid[nr][nc];
            if (val >= 0 && val < minVal) {
              minVal = val;
              bestNeighborR = nr;
              bestNeighborC = nc;
            }
          }
        }

        if (bestNeighborR === currR && bestNeighborC === currC) {
          break;
        }

        currR = bestNeighborR;
        currC = bestNeighborC;
        gridPath.unshift({ x: minX + currC * gridSize, y: minY + currR * gridSize });
      }
    }

    let fullPath: Point[] = [];
    if (gridPath.length > 0) {
      fullPath = [
        { x: sourcePos.x, y: sourcePos.y },
        { x: startX, y: startY },
        ...gridPath,
        { x: endX, y: endY },
        { x: targetPos.x, y: targetPos.y },
      ];
    } else {
      const midX = (sourcePos.x + targetPos.x) / 2;
      fullPath = [
        { x: sourcePos.x, y: sourcePos.y },
        { x: startX, y: startY },
        { x: midX, y: startY },
        { x: midX, y: endY },
        { x: endX, y: endY },
        { x: targetPos.x, y: targetPos.y },
      ];
    }

    const simplified = simplifyOrthogonalPath(fullPath);
    const cleaned = cleanOrthogonalArtifacts(
      simplified,
      sourcePos,
      targetPos,
      nodes,
      options.obstacleClearance || 12,
      sourceStub,
      targetStub
    );

    return {
      ...edge,
      path: cleaned,
    };
  });

  return { edges: routedEdges, debugWaveCells: allDebugCells };
}
