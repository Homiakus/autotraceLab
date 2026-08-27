export interface SpatialAABB {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface SpatialItem<T> {
  id: string;
  data: T;
  bounds: SpatialAABB;
}

/**
 * High-performance 2D Spatial Hash Grid for O(1) average-time collision detection,
 * range querying, and intersection tests on schematics up to 100,000+ elements.
 */
export class SpatialHashGrid<T> {
  private cellSize: number;
  private grid: Map<string, SpatialItem<T>[]>;
  private itemMap: Map<string, SpatialItem<T>>;

  constructor(cellSize: number = 200) {
    this.cellSize = cellSize;
    this.grid = new Map();
    this.itemMap = new Map();
  }

  private hashCoords(cx: number, cy: number): string {
    return `${cx}:${cy}`;
  }

  public clear(): void {
    this.grid.clear();
    this.itemMap.clear();
  }

  public insert(id: string, data: T, bounds: SpatialAABB): void {
    if (this.itemMap.has(id)) {
      this.remove(id);
    }

    const item: SpatialItem<T> = { id, data, bounds };
    this.itemMap.set(id, item);

    const minCx = Math.floor(bounds.minX / this.cellSize);
    const maxCx = Math.floor(bounds.maxX / this.cellSize);
    const minCy = Math.floor(bounds.minY / this.cellSize);
    const maxCy = Math.floor(bounds.maxY / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.hashCoords(cx, cy);
        let list = this.grid.get(key);
        if (!list) {
          list = [];
          this.grid.set(key, list);
        }
        list.push(item);
      }
    }
  }

  public remove(id: string): void {
    const item = this.itemMap.get(id);
    if (!item) return;

    const bounds = item.bounds;
    const minCx = Math.floor(bounds.minX / this.cellSize);
    const maxCx = Math.floor(bounds.maxX / this.cellSize);
    const minCy = Math.floor(bounds.minY / this.cellSize);
    const maxCy = Math.floor(bounds.maxY / this.cellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.hashCoords(cx, cy);
        const list = this.grid.get(key);
        if (list) {
          const idx = list.findIndex(it => it.id === id);
          if (idx !== -1) {
            list.splice(idx, 1);
          }
          if (list.length === 0) {
            this.grid.delete(key);
          }
        }
      }
    }

    this.itemMap.delete(id);
  }

  /**
   * Queries all unique items that overlap the query AABB range.
   */
  public queryRange(queryBounds: SpatialAABB): T[] {
    const minCx = Math.floor(queryBounds.minX / this.cellSize);
    const maxCx = Math.floor(queryBounds.maxX / this.cellSize);
    const minCy = Math.floor(queryBounds.minY / this.cellSize);
    const maxCy = Math.floor(queryBounds.maxY / this.cellSize);

    const visitedIds = new Set<string>();
    const results: T[] = [];

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.hashCoords(cx, cy);
        const list = this.grid.get(key);
        if (!list) continue;

        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          if (visitedIds.has(item.id)) continue;

          // Check AABB overlap
          const b = item.bounds;
          if (
            b.maxX >= queryBounds.minX &&
            b.minX <= queryBounds.maxX &&
            b.maxY >= queryBounds.minY &&
            b.minY <= queryBounds.maxY
          ) {
            visitedIds.add(item.id);
            results.push(item.data);
          }
        }
      }
    }

    return results;
  }

  /**
   * Queries all unique items at a specific point.
   */
  public queryPoint(x: number, y: number): T[] {
    return this.queryRange({ minX: x, maxX: x, minY: y, maxY: y });
  }

  public size(): number {
    return this.itemMap.size;
  }
}
