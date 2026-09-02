import { BlockNode, EdgeConnection, Port, PortSide, PortType, BlockShape, SubcircuitDefinition } from '../types';
import { DiagnosticIssue, DSLParseResult } from './types';
import { validateDiagram } from './validator';

/**
 * Parses bracket attribute string e.g. `[shape=chip_ic, title="STM32", x=100, y=200, pinned=true]`
 */
function parseAttributes(attrStr: string): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};
  if (!attrStr) return result;

  // Regex to match key=value or key="quoted value" or key (boolean flag)
  const regex = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([a-zA-Z0-9_.#-]+)))?/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(attrStr)) !== null) {
    const key = match[1];
    const valQuoted = match[2] ?? match[3];
    const valRaw = match[4];

    if (valQuoted !== undefined) {
      result[key] = valQuoted;
    } else if (valRaw !== undefined) {
      if (valRaw === 'true') result[key] = true;
      else if (valRaw === 'false') result[key] = false;
      else if (!isNaN(Number(valRaw)) && valRaw.trim() !== '') result[key] = Number(valRaw);
      else result[key] = valRaw;
    } else {
      result[key] = true;
    }
  }

  return result;
}

/**
 * Parses AutoTrace Compact Textual DSL into standard BlockNode[] and EdgeConnection[]
 */
export function parseDSL(sourceText: string): DSLParseResult {
  const nodes: BlockNode[] = [];
  const edges: EdgeConnection[] = [];
  const issues: DiagnosticIssue[] = [];

  // Remove multi-line comments
  const cleanSource = sourceText.replace(/\/\*[\s\S]*?\*\//g, '');
  const lines = cleanSource.split(/\r?\n/);

  let currentBlock: BlockNode | null = null;
  let currentBlockPorts: Port[] = [];
  let blockLineStart = 0;
  let autoEdgeCounter = 1;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineNum = lineIdx + 1;
    let line = lines[lineIdx].trim();

    // Strip line comments
    if (line.startsWith('//') || line.startsWith('#')) {
      continue;
    }
    const commentIdx = line.indexOf('//');
    if (commentIdx !== -1) {
      line = line.substring(0, commentIdx).trim();
    }

    if (!line) continue;

    // Check Block Header: `block MCU [attributes...] {`
    const blockMatch = line.match(/^block\s+([a-zA-Z0-9_-]+)(?:\s*\[(.*?)\])?\s*\{?$/i);
    if (blockMatch) {
      if (currentBlock) {
        issues.push({
          code: 'ERR_UNCLOSED_BLOCK',
          message: `Block "${currentBlock.id}" was not closed before starting "${blockMatch[1]}".`,
          severity: 'error',
          line: lineNum,
          targetKind: 'syntax',
        });
        currentBlock.ports = currentBlockPorts;
        nodes.push(currentBlock);
      }

      const blockId = blockMatch[1];
      const attrs = parseAttributes(blockMatch[2] || '');

      currentBlock = {
        id: blockId,
        title: (attrs.title as string) || blockId,
        subtitle: (attrs.subtitle as string) || undefined,
        category: (attrs.category as any) || 'processor',
        semanticType: (attrs.type as string) || undefined,
        shape: (attrs.shape as BlockShape) || 'rectangle',
        x: typeof attrs.x === 'number' ? attrs.x : 0,
        y: typeof attrs.y === 'number' ? attrs.y : 0,
        width: typeof attrs.w === 'number' ? attrs.w : typeof attrs.width === 'number' ? attrs.width : 160,
        height: typeof attrs.h === 'number' ? attrs.h : typeof attrs.height === 'number' ? attrs.height : 90,
        color: (attrs.color as string) || undefined,
        routingClearance: typeof attrs.clearance === 'number' ? attrs.clearance : undefined,
        isPinned: attrs.pinned === true,
        autoSize: attrs.autoSize !== false,
      };
      currentBlockPorts = [];
      blockLineStart = lineNum;
      continue;
    }

    // Check Block Closing: `}`
    if (line === '}' || line.startsWith('}')) {
      if (currentBlock) {
        currentBlock.ports = currentBlockPorts;
        nodes.push(currentBlock);
        currentBlock = null;
        currentBlockPorts = [];
      } else {
        issues.push({
          code: 'ERR_UNMATCHED_BRACE',
          message: 'Unexpected closing brace "}" without an open block.',
          severity: 'error',
          line: lineNum,
          targetKind: 'syntax',
        });
      }
      continue;
    }

    // Inside Block: Parse Ports
    // Syntax: `in[top] VDD: power [pin=1]` or `out[right] TX: signal` or `in CLK`
    if (currentBlock) {
      const portMatch = line.match(/^(in|out|inout|passive)(?:\[(left|right|top|bottom)\])?\s+([a-zA-Z0-9_-]+)(?:\s*:\s*([a-zA-Z0-9_-]+))?(?:\s*\[(.*?)\])?$/i);
      if (portMatch) {
        const rawType = portMatch[1].toLowerCase();
        const rawSide = portMatch[2]?.toLowerCase() as PortSide | undefined;
        const portId = portMatch[3];
        const dataType = portMatch[4];
        const portAttrs = parseAttributes(portMatch[5] || '');

        const type: PortType = rawType === 'in' ? 'input' : rawType === 'out' ? 'output' : (rawType as PortType);
        const side: PortSide = rawSide || (type === 'output' ? 'right' : 'left');

        const port: Port = {
          id: portId,
          name: (portAttrs.name as string) || portId,
          type,
          side,
          dataType: dataType || (portAttrs.dataType as string) || undefined,
          relativePosition: typeof portAttrs.pos === 'number' ? portAttrs.pos : typeof portAttrs.relativePosition === 'number' ? portAttrs.relativePosition : undefined,
          customOffset: typeof portAttrs.offset === 'number' ? portAttrs.offset : undefined,
          pinNumber: typeof portAttrs.pin === 'number' ? portAttrs.pin : undefined,
          groupId: (portAttrs.group as string) || undefined,
          color: (portAttrs.color as string) || undefined,
        };

        currentBlockPorts.push(port);
        continue;
      } else {
        issues.push({
          code: 'WARN_INVALID_PORT_SYNTAX',
          message: `Unrecognized port declaration in block "${currentBlock.id}": "${line}"`,
          severity: 'warning',
          line: lineNum,
          targetKind: 'syntax',
        });
        continue;
      }
    }

    // Outside Block: Parse Connections / Edges
    // Syntax: `MCU.TX -> SENSOR.DATA [label="SPI", color="#38bdf8"]`
    const edgeMatch = line.match(/^([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)\s*(->|<-|--)\s*([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)(?:\s*\[(.*?)\])?$/);
    if (edgeMatch) {
      const isReverse = edgeMatch[3] === '<-';
      const srcBlock = isReverse ? edgeMatch[4] : edgeMatch[1];
      const srcPort = isReverse ? edgeMatch[5] : edgeMatch[2];
      const tgtBlock = isReverse ? edgeMatch[1] : edgeMatch[4];
      const tgtPort = isReverse ? edgeMatch[2] : edgeMatch[5];
      const edgeAttrs = parseAttributes(edgeMatch[6] || '');

      const edgeId = (edgeAttrs.id as string) || `e_${srcBlock}_${srcPort}_to_${tgtBlock}_${tgtPort}_${autoEdgeCounter++}`;
      const edge: EdgeConnection = {
        id: edgeId,
        sourceBlockId: srcBlock,
        sourcePortId: srcPort,
        targetBlockId: tgtBlock,
        targetPortId: tgtPort,
        label: (edgeAttrs.label as string) || undefined,
        color: (edgeAttrs.color as string) || undefined,
        dataType: (edgeAttrs.dataType as string) || undefined,
      };

      edges.push(edge);
      continue;
    }

    // Unknown statement
    issues.push({
      code: 'WARN_UNKNOWN_STATEMENT',
      message: `Unrecognized DSL statement: "${line}"`,
      severity: 'warning',
      line: lineNum,
      targetKind: 'syntax',
    });
  }

  // Close trailing unclosed block if file ended
  if (currentBlock) {
    currentBlock.ports = currentBlockPorts;
    nodes.push(currentBlock);
  }

  // Run validation
  const validationReport = validateDiagram(nodes, edges);
  issues.push(...validationReport.issues);

  return {
    nodes,
    edges,
    issues,
  };
}
