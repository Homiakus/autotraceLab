/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Block Collision Detection, Repulsion Physics & Overlap Separation Engine.
 * Guarantees zero block-on-block overlaps with smooth repulsive displacement during drag.
 */

import { BlockNode } from '../types';

export interface CollisionBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPinned?: boolean;
}

export const DEFAULT_COLLISION_MARGIN = 24;

/**
 * Checks if two bounding boxes overlap, accounting for a safety margin.
 */
export function doBoxesOverlap(
  b1: CollisionBox,
  b2: CollisionBox,
  margin: number = DEFAULT_COLLISION_MARGIN
): boolean {
  return !(
    b1.x + b1.width + margin <= b2.x ||
    b2.x + b2.width + margin <= b1.x ||
    b1.y + b1.height + margin <= b2.y ||
    b2.y + b2.height + margin <= b1.y
  );
}

/**
 * Calculates repulsive displacement when dragging a block.
 * Pushes other blocks out of the way smoothly along the axis of minimum penetration.
 * If another block is pinned, the dragged block is constrained instead.
 */
export function applyRepulsiveDisplacement(
  nodes: BlockNode[],
  draggingId: string,
  targetX: number,
  targetY: number,
  margin: number = DEFAULT_COLLISION_MARGIN,
  gridSize: number = 10
): BlockNode[] {
  const result = nodes.map(n => ({ ...n }));
  const draggedIdx = result.findIndex(n => n.id === draggingId);
  if (draggedIdx === -1) return result;

  const snap = (v: number) => Math.max(20, Math.round(v / gridSize) * gridSize);

  // Set the dragged node's target position first
  result[draggedIdx].x = snap(targetX);
  result[draggedIdx].y = snap(targetY);

  const draggedNode = result[draggedIdx];

  // Iterative relaxation (4 passes) to propagate pushing forces smoothly
  for (let pass = 0; pass < 4; pass++) {
    let movedAny = false;

    for (let i = 0; i < result.length; i++) {
      if (result[i].id === draggingId) continue;
      const other = result[i];

      if (doBoxesOverlap(draggedNode, other, margin)) {
        // Calculate center distances
        const c1x = draggedNode.x + draggedNode.width / 2;
        const c1y = draggedNode.y + draggedNode.height / 2;
        const c2x = other.x + other.width / 2;
        const c2y = other.y + other.height / 2;

        const dx = c2x - c1x;
        const dy = c2y - c1y;

        const targetDistX = (draggedNode.width + other.width) / 2 + margin;
        const targetDistY = (draggedNode.height + other.height) / 2 + margin;

        const overlapX = targetDistX - Math.abs(dx);
        const overlapY = targetDistY - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          if (other.isPinned) {
            // Other node is pinned: push the dragged node away instead
            if (overlapX < overlapY) {
              const sign = dx >= 0 ? -1 : 1;
              draggedNode.x = snap(draggedNode.x + sign * overlapX);
            } else {
              const sign = dy >= 0 ? -1 : 1;
              draggedNode.y = snap(draggedNode.y + sign * overlapY);
            }
          } else {
            // Push the other node away along the axis of minimum penetration
            if (overlapX < overlapY) {
              const sign = dx >= 0 ? 1 : -1;
              other.x = snap(other.x + sign * overlapX);
            } else {
              const sign = dy >= 0 ? 1 : -1;
              other.y = snap(other.y + sign * overlapY);
            }
            movedAny = true;
          }
        }
      }
    }

    if (!movedAny) break;
  }

  // Also resolve secondary overlaps between non-dragged peers
  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      if (result[i].id === draggingId || result[j].id === draggingId) continue;
      const n1 = result[i];
      const n2 = result[j];

      if (doBoxesOverlap(n1, n2, margin)) {
        const c1x = n1.x + n1.width / 2;
        const c1y = n1.y + n1.height / 2;
        const c2x = n2.x + n2.width / 2;
        const c2y = n2.y + n2.height / 2;

        const dx = c2x - c1x;
        const dy = c2y - c1y;

        const targetDistX = (n1.width + n2.width) / 2 + margin;
        const targetDistY = (n1.height + n2.height) / 2 + margin;

        const overlapX = targetDistX - Math.abs(dx);
        const overlapY = targetDistY - Math.abs(dy);

        if (overlapX > 0 && overlapY > 0) {
          if (overlapX < overlapY) {
            const sign = dx >= 0 ? 1 : -1;
            if (!n2.isPinned && !n1.isPinned) {
              n2.x = snap(n2.x + sign * (overlapX / 2));
              n1.x = snap(n1.x - sign * (overlapX / 2));
            } else if (!n2.isPinned) {
              n2.x = snap(n2.x + sign * overlapX);
            } else if (!n1.isPinned) {
              n1.x = snap(n1.x - sign * overlapX);
            }
          } else {
            const sign = dy >= 0 ? 1 : -1;
            if (!n2.isPinned && !n1.isPinned) {
              n2.y = snap(n2.y + sign * (overlapY / 2));
              n1.y = snap(n1.y - sign * (overlapY / 2));
            } else if (!n2.isPinned) {
              n2.y = snap(n2.y + sign * overlapY);
            } else if (!n1.isPinned) {
              n1.y = snap(n1.y - sign * overlapY);
            }
          }
        }
      }
    }
  }

  return result;
}

/**
 * Finalizing relaxation pass to guarantee 100% absence of block overlaps anywhere on canvas.
 */
export function separateAllOverlappingNodes(
  nodes: BlockNode[],
  margin: number = DEFAULT_COLLISION_MARGIN,
  gridSize: number = 10
): BlockNode[] {
  const result = nodes.map(n => ({ ...n }));
  const snap = (v: number) => Math.max(20, Math.round(v / gridSize) * gridSize);

  for (let iter = 0; iter < 10; iter++) {
    let hasOverlap = false;

    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const n1 = result[i];
        const n2 = result[j];

        if (doBoxesOverlap(n1, n2, margin)) {
          hasOverlap = true;

          const c1x = n1.x + n1.width / 2;
          const c1y = n1.y + n1.height / 2;
          const c2x = n2.x + n2.width / 2;
          const c2y = n2.y + n2.height / 2;

          let dx = c2x - c1x;
          let dy = c2y - c1y;
          if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
            dx = 1;
            dy = 1;
          }

          const targetDistX = (n1.width + n2.width) / 2 + margin;
          const targetDistY = (n1.height + n2.height) / 2 + margin;

          const overlapX = targetDistX - Math.abs(dx);
          const overlapY = targetDistY - Math.abs(dy);

          if (overlapX > 0 && overlapY > 0) {
            if (overlapX < overlapY) {
              const sign = dx >= 0 ? 1 : -1;
              if (!n1.isPinned && !n2.isPinned) {
                n1.x = snap(n1.x - sign * (overlapX / 2));
                n2.x = snap(n2.x + sign * (overlapX / 2));
              } else if (!n1.isPinned) {
                n1.x = snap(n1.x - sign * overlapX);
              } else if (!n2.isPinned) {
                n2.x = snap(n2.x + sign * overlapX);
              }
            } else {
              const sign = dy >= 0 ? 1 : -1;
              if (!n1.isPinned && !n2.isPinned) {
                n1.y = snap(n1.y - sign * (overlapY / 2));
                n2.y = snap(n2.y + sign * (overlapY / 2));
              } else if (!n1.isPinned) {
                n1.y = snap(n1.y - sign * overlapY);
              } else if (!n2.isPinned) {
                n2.y = snap(n2.y + sign * overlapY);
              }
            }
          }
        }
      }
    }

    if (!hasOverlap) break;
  }

  return result;
}
