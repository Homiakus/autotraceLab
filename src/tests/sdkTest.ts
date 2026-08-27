import { AutoTraceClient, createAutoTraceClient, renderEdgeToSvgPath } from '../sdk';
import { BlockNode, EdgeConnection, DEFAULT_ROUTING_OPTIONS } from '../types';

async function runSDKVerificationTest() {
  console.log('🧪 Testing AutoTrace TypeScript SDK as a pluggable library...');

  const client = createAutoTraceClient();
  const hello = await client.engine.hello();
  console.log('  ✓ Client hello successful:', hello.service, `(${hello.engine})`);

  const nodes: BlockNode[] = [
    {
      id: 'src',
      title: 'Source Block',
      category: 'processor',
      x: 50,
      y: 100,
      width: 100,
      height: 60,
      inputs: [],
      outputs: [{ id: 'p_out', name: 'Out', type: 'output', side: 'right' }],
    },
    {
      id: 'tgt',
      title: 'Target Block',
      category: 'processor',
      x: 350,
      y: 120,
      width: 100,
      height: 60,
      inputs: [{ id: 'p_in', name: 'In', type: 'input', side: 'left' }],
      outputs: [],
    },
  ];

  const edges: EdgeConnection[] = [
    {
      id: 'e1',
      sourceBlockId: 'src',
      sourcePortId: 'p_out',
      targetBlockId: 'tgt',
      targetPortId: 'p_in',
    },
  ];

  const layout = await client.engine.layout({
    graphId: 'sdk-test',
    nodes,
    edges,
    options: DEFAULT_ROUTING_OPTIONS,
  });

  console.log('  ✓ Layout calculated:', layout.edges.length, 'edges, duration:', layout.durationMs.toFixed(2), 'ms');

  if (layout.edges.length !== 1 || !layout.edges[0].path || layout.edges[0].path.length < 2) {
    throw new Error('SDK layout returned invalid edge path');
  }

  // Test SVG Path generation
  const svgPath = renderEdgeToSvgPath(layout.edges[0], layout.edges, {
    smoothCorners: true,
    cornerRadius: 8.0,
    enableBridges: true,
  });

  console.log('  ✓ SVG Path generated:', svgPath);
  if (!svgPath.startsWith('M')) {
    throw new Error(`Invalid SVG path: ${svgPath}`);
  }

  client.destroy();
  console.log('🎉 SDK verification passed completely!');
}

runSDKVerificationTest().catch((err) => {
  console.error('❌ SDK verification failed:', err);
  process.exit(1);
});
