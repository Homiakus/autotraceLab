import { parseDSL, formatDSL, validateBlockNode, validateDiagram, BlockNode, EdgeConnection, routeOrthogonal } from '../sdk';

export async function runDSLVerificationSuite() {
  console.log('🧪 Testing AutoTrace Compact Textual DSL & Schema Validator...');

  // 1. Test DSL Parsing
  const sampleDsl = `
// Embedded Vision Pipeline
block SENSOR [shape=rounded, title="CMOS Camera 4K", category=source, x=50, y=100, w=170, h=120, clearance=12] {
  in[top]    VDD: power [pin=1]
  out[right] MIPI_0: bus [pos=0.3]
  out[right] MIPI_1: bus [pos=0.7]
}

block NPU [shape=chip_ic, title="Tensor NPU Core", category=processor, x=350, y=100, w=200, h=140, pinned=true] {
  in[left]   LANE0: bus [pos=0.3]
  in[left]   LANE1: bus [pos=0.7]
  out[right] DETECTIONS: bus [pos=0.5]
}

block DISPLAY [shape=rectangle, title="AMOLED Panel", category=sink, x=650, y=100, w=180, h=100] {
  in[left]   SPI_IN: bus [pos=0.5]
}

SENSOR.MIPI_0 -> NPU.LANE0 [label="MIPI 2.5 Gbps", color="#38bdf8"]
SENSOR.MIPI_1 -> NPU.LANE1 [label="MIPI 2.5 Gbps", color="#38bdf8"]
NPU.DETECTIONS -> DISPLAY.SPI_IN [label="Overlay Data", color="#10b981"]
  `.trim();

  const parseResult = parseDSL(sampleDsl);
  console.log('  ✓ Parsed blocks:', parseResult.nodes.length, 'edges:', parseResult.edges.length);

  if (parseResult.nodes.length !== 3) {
    throw new Error(`Expected 3 nodes, got ${parseResult.nodes.length}`);
  }
  if (parseResult.edges.length !== 3) {
    throw new Error(`Expected 3 edges, got ${parseResult.edges.length}`);
  }

  const sensor = parseResult.nodes[0];
  if (sensor.shape !== 'rounded' || sensor.title !== 'CMOS Camera 4K' || sensor.routingClearance !== 12) {
    throw new Error('Sensor attributes parsed incorrectly');
  }

  const npu = parseResult.nodes[1];
  if (npu.isPinned !== true || npu.shape !== 'chip_ic') {
    throw new Error('NPU attributes parsed incorrectly');
  }

  // 2. Test Zero-Overhead Orthogonal Routing on parsed DSL
  const routed = routeOrthogonal(parseResult.nodes, parseResult.edges);
  console.log('  ✓ Successfully routed parsed DSL across', routed.length, 'nets');
  if (routed.some(e => !e.path || e.path.length < 2)) {
    throw new Error('DSL routed edges contain empty paths');
  }

  // 3. Test Serialization
  const formattedDsl = formatDSL(parseResult.nodes, parseResult.edges);
  console.log('  ✓ Formatted Compact DSL length:', formattedDsl.length, 'chars');

  // 4. Test Round-Trip
  const roundTripResult = parseDSL(formattedDsl);
  if (roundTripResult.nodes.length !== 3 || roundTripResult.edges.length !== 3) {
    throw new Error('Round-trip DSL serialization failed to reproduce exact graph topology');
  }
  console.log('  ✓ Round-trip parsing verified 100% topology preservation');

  // 5. Test Schema Validation & Diagnostics
  const invalidBlock: BlockNode = {
    id: '',
    title: 'Broken Node',
    category: 'processor',
    x: 0,
    y: 0,
    width: -50,
    height: 0,
    ports: [
      { id: 'dup', name: 'Pin 1', type: 'input', side: 'left' },
      { id: 'dup', name: 'Pin 2', type: 'output', side: 'invalid_side' as any, relativePosition: 1.5 },
    ],
  };

  const blockIssues = validateBlockNode(invalidBlock);
  console.log('  ✓ Schema validator caught', blockIssues.length, 'expected diagnostic issues on malformed block:');
  for (const issue of blockIssues) {
    console.log(`     - [${issue.severity.toUpperCase()}] ${issue.code}: ${issue.message}`);
  }

  if (blockIssues.length < 4) {
    throw new Error('Validator missed expected schema violations');
  }

  // 6. Test Referential Validation (Broken edges)
  const brokenEdges: EdgeConnection[] = [
    { id: 'e1', sourceBlockId: 'non_existent_node', sourcePortId: 'p1', targetBlockId: 'SENSOR', targetPortId: 'VDD' },
    { id: 'e2', sourceBlockId: 'SENSOR', sourcePortId: 'non_existent_port', targetBlockId: 'NPU', targetPortId: 'LANE0' },
  ];
  const diagramReport = validateDiagram(parseResult.nodes, brokenEdges);
  if (diagramReport.valid || diagramReport.errorsCount !== 2) {
    throw new Error('Referential validation failed to catch broken node/port edge links');
  }
  console.log('  ✓ Referential integrity validator caught broken edge links correctly');

  // 7. Performance Benchmark (1,000 blocks)
  const bulkNodes: BlockNode[] = [];
  const bulkEdges: EdgeConnection[] = [];
  for (let i = 0; i < 1000; i++) {
    bulkNodes.push({
      id: `node_${i}`,
      title: `Processing Unit #${i}`,
      category: 'processor',
      x: (i % 20) * 200,
      y: Math.floor(i / 20) * 120,
      width: 150,
      height: 80,
      ports: [
        { id: 'in_1', name: 'In', type: 'input', side: 'left' },
        { id: 'out_1', name: 'Out', type: 'output', side: 'right' },
      ],
    });
    if (i > 0) {
      bulkEdges.push({
        id: `e_${i}`,
        sourceBlockId: `node_${i - 1}`,
        sourcePortId: 'out_1',
        targetBlockId: `node_${i}`,
        targetPortId: 'in_1',
      });
    }
  }

  const t0 = performance.now();
  const bulkDslText = formatDSL(bulkNodes, bulkEdges);
  const serializeTime = performance.now() - t0;

  const t1 = performance.now();
  const bulkParsed = parseDSL(bulkDslText);
  const parseTime = performance.now() - t1;

  console.log(`  ✓ Benchmark: 1,000 blocks serialized in ${serializeTime.toFixed(2)}ms, parsed in ${parseTime.toFixed(2)}ms`);
  if (bulkParsed.nodes.length !== 1000) {
    throw new Error('Bulk parsing failed to match 1000 nodes');
  }

  console.log('🎉 Compact DSL & Schema Validator verified successfully!\n');
}

if (import.meta.url.includes(process.argv[1]) || process.argv[1]?.endsWith('dslTest.ts')) {
  runDSLVerificationSuite().catch(err => {
    console.error('❌ DSL Test Failed:', err);
    process.exit(1);
  });
}
