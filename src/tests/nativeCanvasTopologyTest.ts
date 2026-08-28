import { distancePointToRect, nearestBlockToPoint, ScreenRectLike } from '../nativeCanvasTopology';

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertClose(actual: number, expected: number, message: string): void {
  if (Math.abs(actual - expected) > 1e-9) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

const rect: ScreenRectLike = { id: 'a', left: 10, top: 20, right: 110, bottom: 80 };
assertClose(distancePointToRect({ x: 50, y: 40 }, rect), 0, 'point inside rect');
assertClose(distancePointToRect({ x: 120, y: 40 }, rect), 10, 'horizontal distance');
assertClose(distancePointToRect({ x: 110, y: 95 }, rect), 15, 'vertical distance');
assertClose(distancePointToRect({ x: 116, y: 88 }, rect), 10, 'diagonal distance');

const blocks: ScreenRectLike[] = [
  { id: 'left', left: 0, top: 0, right: 100, bottom: 80 },
  { id: 'right', left: 200, top: 0, right: 300, bottom: 80 },
];

const left = nearestBlockToPoint({ x: 105, y: 40 }, blocks, 20);
assert(left?.id === 'left', 'endpoint near left block should resolve left');
assertClose(left?.distance ?? -1, 5, 'left endpoint distance');

const right = nearestBlockToPoint({ x: 195, y: 40 }, blocks, 20);
assert(right?.id === 'right', 'endpoint near right block should resolve right');

const none = nearestBlockToPoint({ x: 150, y: 200 }, blocks, 20);
assert(none === null, 'distant point must not be force-matched');

console.log('nativeCanvasTopologyTest: OK');
