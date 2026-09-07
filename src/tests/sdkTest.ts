import { AutoTraceClient, createAutoTraceClient, renderEdgeToSvgPath, getSceneBounds } from '../sdk';
import { BlockNode, EdgeConnection, DEFAULT_ROUTING_OPTIONS } from '../types';

async function runSDKVerificationTest() {
  console.log('🧪 Testing AutoTrace TypeScript SDK as a stateful, embeddable library...');

  const client = createAutoTraceClient({
    defaultOptions: {
      gridSize: 12,
      obstacleClearance: 14,
    },
  });

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

  // 1. Test stateless async routing
  const layout = await client.route(nodes, edges);
  console.log('  ✓ Layout calculated:', layout.edges.length, 'edges, duration:', layout.durationMs.toFixed(2), 'ms');

  if (layout.edges.length !== 1 || !layout.edges[0].path || layout.edges[0].path.length < 2) {
    throw new Error('SDK layout returned invalid edge path');
  }

  // 1b. Test pure synchronous routing with zero async overhead
  const { routeOrthogonal } = await import('../sdk');
  const syncRouted = routeOrthogonal(nodes, edges);
  if (syncRouted.length !== 1 || !syncRouted[0].path || syncRouted[0].path.length < 2) {
    throw new Error('routeOrthogonal synchronous routing failed');
  }
  console.log('  ✓ Pure synchronous routeOrthogonal verified: 0ms async overhead');

  // 2. Test bounds helper
  const bounds = getSceneBounds(nodes);
  console.log('  ✓ Scene bounds computed:', bounds);
  if (bounds.width !== 400 || bounds.height !== 80) {
    throw new Error(`Unexpected bounds calculation: ${JSON.stringify(bounds)}`);
  }

  // 3. Test stateful SceneSession lifecycle
  console.log('  ✓ Testing SceneSession stateful lifecycle...');
  const session = await client.openScene({
    id: 'test-session-1',
    nodes,
    edges,
  });

  if (session.revision !== 1) {
    throw new Error(`Expected initial revision 1, got ${session.revision}`);
  }

  let notifiedRevision = 0;
  const unsubscribe = session.subscribe((snapshot) => {
    notifiedRevision = snapshot.revision;
  });

  // Patch session
  const patchRes = await session.patch({
    nodes: {
      upsert: [
        {
          id: 'tgt',
          title: 'Target Block Moved',
          category: 'processor',
          x: 400,
          y: 180,
          width: 100,
          height: 60,
          inputs: [{ id: 'p_in', name: 'In', type: 'input', side: 'left' }],
          outputs: [],
        },
      ],
    },
  });

  if (patchRes.revision !== 2 || (session.revision as number) !== 2 || notifiedRevision !== 2) {
    throw new Error(`Reactive subscription / revision mismatch: rev=${session.revision}, notified=${notifiedRevision}`);
  }

  unsubscribe();

  // Test SVG Path generation from session
  const svgPaths = session.toSvgPaths({ smoothCorners: true, cornerRadius: 8.0, enableBridges: true });
  console.log('  ✓ SVG Paths generated from session:', svgPaths.length);
  if (svgPaths.length !== 1 || !svgPaths[0].d.startsWith('M')) {
    throw new Error(`Invalid SVG paths from session: ${JSON.stringify(svgPaths)}`);
  }

  // 4. Test snapshot & persistence
  const snap = await session.snapshot();
  if (snap.revision !== 2 || snap.nodes.length !== 2) {
    throw new Error(`Snapshot mismatch: rev=${snap.revision}`);
  }

  const persisted = await client.loadPersistedSession('test-session-1');
  if (!persisted || persisted.revision !== 2) {
    throw new Error('Persisted session failed to load from storage adapter');
  }
  console.log('  ✓ Storage adapter roundtrip verified');

  // 5. Test close
  const closed = await session.close();
  if (!closed) {
    throw new Error('Failed to close session');
  }
  console.log('  ✓ Session closed cleanly');

  await client.destroy();

  // 6. Test DiagramBuilder fluent API & SVG rendering
  console.log('  ✓ Testing DiagramBuilder fluent API...');
  const { DiagramBuilder, routeSimpleGraph, renderDiagramSvg, THEME_DARK, THEME_BLUEPRINT } = await import('../sdk');

  const builder = new DiagramBuilder('presentation', 'blueprint')
    .setTitle('Circuit 101')
    .addNode({ id: 'sensor', title: 'Pressure Sensor', x: 50, y: 50, shape: 'circle' })
    .addNode({ id: 'mcu', title: 'STM32F4', x: 280, y: 50, shape: 'chip_ic' })
    .connect('sensor', 'mcu', { label: 'SPI Bus', color: '#38bdf8' });

  const builderResult = builder.route();
  if (builderResult.nodes.length !== 2 || builderResult.edges.length !== 1) {
    throw new Error('DiagramBuilder route returned unexpected counts');
  }
  const svgOutput = builderResult.toSvg();
  if (!svgOutput.includes('<svg') || !svgOutput.includes('SPI Bus') || !svgOutput.includes('Pressure Sensor')) {
    throw new Error('DiagramBuilder toSvg failed to produce valid SVG markup');
  }
  console.log('  ✓ DiagramBuilder produced valid styled SVG with custom theme');

  // 7. Test routeSimpleGraph shortcut
  console.log('  ✓ Testing routeSimpleGraph shortcut...');
  const simpleResult = routeSimpleGraph({
    title: 'Pipeline',
    nodes: [
      { id: 'input', title: 'Input Stream' },
      { id: 'filter', title: 'Kalman Filter' },
      { id: 'output', title: 'Display' },
    ],
    edges: [
      { from: 'input', to: 'filter', label: 'Raw' },
      { from: 'filter', to: 'output', label: 'Filtered' },
    ],
    options: 'workflow',
    theme: 'dark',
    autoLayout: 'sugiyama',
  });

  if (simpleResult.nodes.length !== 3 || simpleResult.edges.length !== 2) {
    throw new Error('routeSimpleGraph returned invalid nodes or edges');
  }
  const simpleSvg = simpleResult.toSvg();
  if (!simpleSvg.includes('Kalman Filter') || !simpleSvg.includes('Filtered')) {
    throw new Error('routeSimpleGraph toSvg missing nodes or labels');
  }
  console.log('  ✓ routeSimpleGraph shortcut with autoLayout verified');

  console.log('🎉 SDK verification passed completely!');
}

runSDKVerificationTest().catch((err) => {
  console.error('❌ SDK verification failed:', err);
  process.exit(1);
});
