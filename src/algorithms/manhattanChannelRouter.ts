import { BlockNode, EdgeConnection, Point, RoutingOptions } from '../types';
import { getPortCoordinates, simplifyOrthogonalPath, computeAdaptivePortStub } from './orthogonalAStarRouter';
import { cleanOrthogonalArtifacts } from './wireArtifactCleaner';

/**
 * Fast Manhattan Channel / Corridor Router
 * Uses L-shape, Z-shape, and C-shape channel corridors respecting 4-way normal vectors.
 */
export function routeManhattanChannel(
  nodes: BlockNode[],
  edges: EdgeConnection[],
  options: RoutingOptions
): EdgeConnection[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const isAdaptive = options.adaptivePortExitOffset !== false;
  const baseStub = options.portExitOffset || 20;

  // Pre-calculate edge distribution per face for port lane staggering
  const edgesOnSourceFace = new Map<string, string[]>();
  const edgesOnTargetFace = new Map<string, string[]>();

  edges.forEach(e => {
    const sNode = nodeMap.get(e.sourceBlockId);
    const tNode = nodeMap.get(e.targetBlockId);
    if (sNode) {
      const sPos = getPortCoordinates(sNode, e.sourcePortId, true);
      const key = `${sNode.id}-${sPos.side}`;
      if (!edgesOnSourceFace.has(key)) edgesOnSourceFace.set(key, []);
      edgesOnSourceFace.get(key)!.push(e.id);
    }
    if (tNode) {
      const tPos = getPortCoordinates(tNode, e.targetPortId, false);
      const key = `${tNode.id}-${tPos.side}`;
      if (!edgesOnTargetFace.has(key)) edgesOnTargetFace.set(key, []);
      edgesOnTargetFace.get(key)!.push(e.id);
    }
  });

  return edges.map((edge, edgeIdx) => {
    const sourceNode = nodeMap.get(edge.sourceBlockId);
    const targetNode = nodeMap.get(edge.targetBlockId);
    if (!sourceNode || !targetNode) return edge;

    const sourcePos = getPortCoordinates(sourceNode, edge.sourcePortId, true);
    const targetPos = getPortCoordinates(targetNode, edge.targetPortId, false);

    const channelSpacing = options.minWireDistance || options.channelSpacing || 16;
    const channelStep = Math.max(8, channelSpacing);
    const nudge = ((edgeIdx % 6) - 2.5) * (channelStep * 0.75);

    const srcFaceKey = `${sourceNode.id}-${sourcePos.side}`;
    const srcEdgeList = edgesOnSourceFace.get(srcFaceKey) || [];
    const srcIdx = srcEdgeList.indexOf(edge.id);

    const tgtFaceKey = `${targetNode.id}-${targetPos.side}`;
    const tgtEdgeList = edgesOnTargetFace.get(tgtFaceKey) || [];
    const tgtIdx = tgtEdgeList.indexOf(edge.id);

    const sourceStub = computeAdaptivePortStub(
      sourcePos,
      targetPos,
      sourceNode,
      targetNode,
      nodes,
      baseStub,
      isAdaptive,
      srcIdx >= 0 ? srcIdx : 0,
      Math.max(1, srcEdgeList.length)
    );

    const targetStub = computeAdaptivePortStub(
      targetPos,
      sourcePos,
      targetNode,
      sourceNode,
      nodes,
      baseStub,
      isAdaptive,
      tgtIdx >= 0 ? tgtIdx : 0,
      Math.max(1, tgtEdgeList.length)
    );

    const pStart: Point = { x: sourcePos.x, y: sourcePos.y };
    const pEnd: Point = { x: targetPos.x, y: targetPos.y };

    // Strict 90° normal stubs directly perpendicular to block faces with adaptive lengths
    const stubStart: Point = {
      x: sourcePos.x + sourcePos.normal.dx * sourceStub,
      y: sourcePos.y + sourcePos.normal.dy * sourceStub,
    };

    const stubEnd: Point = {
      x: targetPos.x + targetPos.normal.dx * targetStub,
      y: targetPos.y + targetPos.normal.dy * targetStub,
    };

    let points: Point[] = [pStart, stubStart];

    // Check if intermediate segment collides with any obstacles
    const minX = Math.min(stubStart.x, stubEnd.x);
    const maxX = Math.max(stubStart.x, stubEnd.x);
    const minY = Math.min(stubStart.y, stubEnd.y);
    const maxY = Math.max(stubStart.y, stubEnd.y);

    const interveningBlocks = nodes.filter(n => {
      if (n.id === sourceNode.id || n.id === targetNode.id) return false;
      const nRight = n.x + n.width;
      const nBottom = n.y + n.height;
      return n.x < maxX && nRight > minX && n.y < maxY && nBottom > minY;
    });

    if (interveningBlocks.length > 0) {
      // Route around obstacles via clearance channel
      const blockMinY = Math.min(...interveningBlocks.map(n => n.y));
      const blockMaxY = Math.max(...interveningBlocks.map(n => n.y + n.height));
      const bypassAboveY = blockMinY - (options.obstacleClearance || 16) - 16 + nudge;
      const bypassBelowY = blockMaxY + (options.obstacleClearance || 16) + 16 + nudge;

      const chosenY = Math.abs(stubStart.y - bypassAboveY) <= Math.abs(stubStart.y - bypassBelowY)
        ? bypassAboveY
        : bypassBelowY;

      points.push({ x: stubStart.x, y: chosenY });
      points.push({ x: stubEnd.x, y: chosenY });
    } else {
      // Standard horizontal flow (Source exits right, Target enters left)
      if (sourcePos.normal.dx === 1 && targetPos.normal.dx === -1) {
        if (stubEnd.x >= stubStart.x) {
          // Forward Z-route
          const midX = Math.round((stubStart.x + stubEnd.x) / 2) + nudge;
          points.push({ x: midX, y: stubStart.y });
          points.push({ x: midX, y: stubEnd.y });
        } else {
          // Backward loop around top or bottom
          const routeAbove = (sourcePos.y + targetPos.y) / 2 < 400;
          const clearanceY = routeAbove
            ? Math.min(sourceNode.y, targetNode.y) - 40 + nudge
            : Math.max(sourceNode.y + sourceNode.height, targetNode.y + targetNode.height) + 40 + nudge;

          points.push({ x: stubStart.x, y: clearanceY });
          points.push({ x: stubEnd.x, y: clearanceY });
        }
      } else if (sourcePos.normal.dy !== 0 && targetPos.normal.dy !== 0) {
        // Both vertical
        const midY = Math.round((stubStart.y + stubEnd.y) / 2) + nudge;
        points.push({ x: stubStart.x, y: midY });
        points.push({ x: stubEnd.x, y: midY });
      } else {
        // Mixed orthogonal corridor
        if (sourcePos.normal.dx !== 0) {
          points.push({ x: stubEnd.x, y: stubStart.y });
        } else {
          points.push({ x: stubStart.x, y: stubEnd.y });
        }
      }
    }

    points.push(stubEnd);
    points.push(pEnd);

    const simplified = simplifyOrthogonalPath(points);
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
}
