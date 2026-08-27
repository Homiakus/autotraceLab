import { BlockNode, Port } from '../types';
import { NamespacedID, ResolvedBlockStyle, ShapeDefinition } from './types';
import { RegistryStore } from './RegistryClient';

export function resolveBlockStyle(node: BlockNode, store: RegistryStore): ResolvedBlockStyle {
  const typeId: NamespacedID = node.semanticType || 'core/block/process';
  const blockType = store.getBlockType(typeId) || store.getBlockType('core/block/process')!;
  const shapeDef: ShapeDefinition =
    store.getShape(blockType.shapeId) ||
    store.getShape('core/shape/rectangle') || {
      id: 'core/shape/rectangle',
      name: 'Rectangle',
      baseShape: 'rectangle',
      status: 'published',
      version: '1.0.0',
    };

  const width = Math.max(node.width || blockType.defaultWidth, blockType.minWidth);
  const height = Math.max(node.height || blockType.defaultHeight, blockType.minHeight);

  let inputs = node.inputs ? [...node.inputs] : [];
  let outputs = node.outputs ? [...node.outputs] : [];

  if (inputs.length === 0 && outputs.length === 0 && blockType.ports?.length > 0) {
    for (const pt of blockType.ports) {
      const p: Port = {
        id: pt.id,
        name: pt.name,
        type: pt.type,
        side: pt.preferredSide || (pt.type === 'input' ? 'left' : 'right'),
        relativePosition: pt.relativePosition,
        color: pt.color,
      };
      if (pt.type === 'input') {
        inputs.push(p);
      } else {
        outputs.push(p);
      }
    }
  }

  return {
    typeId,
    title: node.title,
    shape: shapeDef,
    width,
    height,
    headerColor: blockType.headerColor,
    bodyColor: blockType.bodyColor,
    borderColor: blockType.borderColor,
    inputs,
    outputs,
  };
}
