import { BlockNode, EdgeConnection } from '../types';
import { InvalidationClass } from './types';

export function classifyBlockChange(before: BlockNode, after: BlockNode): InvalidationClass {
  // 1. Geometric position / dimensions change -> routing geometry reroute
  if (Math.abs(before.x - after.x) > 0.001 || Math.abs(before.y - after.y) > 0.001) {
    return 'routing_geometry';
  }
  if (Math.abs(before.width - after.width) > 0.001 || Math.abs(before.height - after.height) > 0.001) {
    return 'routing_geometry';
  }
  if (before.shape !== after.shape) {
    return 'routing_geometry';
  }

  // 2. Port modifications
  const bInputs = before.inputs || [];
  const aInputs = after.inputs || [];
  const bOutputs = before.outputs || [];
  const aOutputs = after.outputs || [];

  if (bInputs.length !== aInputs.length || bOutputs.length !== aOutputs.length) {
    return 'routing_geometry';
  }

  for (let i = 0; i < bInputs.length; i++) {
    if (
      bInputs[i].id !== aInputs[i].id ||
      bInputs[i].side !== aInputs[i].side ||
      bInputs[i].relativePosition !== aInputs[i].relativePosition
    ) {
      return 'routing_geometry';
    }
  }

  for (let i = 0; i < bOutputs.length; i++) {
    if (
      bOutputs[i].id !== aOutputs[i].id ||
      bOutputs[i].side !== aOutputs[i].side ||
      bOutputs[i].relativePosition !== aOutputs[i].relativePosition
    ) {
      return 'routing_geometry';
    }
  }

  // 3. Render-only modifications (title, label, color)
  if (before.title !== after.title) {
    return 'render';
  }

  return 'semantic';
}

export function classifyEdgeChange(before: EdgeConnection, after: EdgeConnection): InvalidationClass {
  if (
    before.sourceBlockId !== after.sourceBlockId ||
    before.sourcePortId !== after.sourcePortId ||
    before.targetBlockId !== after.targetBlockId ||
    before.targetPortId !== after.targetPortId
  ) {
    return 'routing_geometry';
  }

  if (before.label !== after.label) {
    return 'render';
  }

  return 'semantic';
}
