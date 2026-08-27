package core

import (
	"math"
)

// SpatialObstacle represents an indexed obstacle bounding box with clearance.
type SpatialObstacle struct {
	ID       string
	MinX     float64
	MaxX     float64
	MinY     float64
	MaxY     float64
	IsActive bool
}

// SceneSpatialIndex provides fast 2D spatial queries for obstacles.
type SceneSpatialIndex struct {
	obstacles []SpatialObstacle
	gridSize  float64
	cellMap   map[int64][]int // hashed spatial grid bucket -> obstacle indices
}

// NewSceneSpatialIndex constructs an indexed spatial lookup structure.
func NewSceneSpatialIndex(nodes []BlockNode, clearance float64) *SceneSpatialIndex {
	if clearance <= 0 {
		clearance = 12.0
	}
	cellSize := 100.0
	idx := &SceneSpatialIndex{
		obstacles: make([]SpatialObstacle, len(nodes)),
		gridSize:  cellSize,
		cellMap:   make(map[int64][]int, len(nodes)*4),
	}

	for i, n := range nodes {
		obs := SpatialObstacle{
			ID:       n.ID,
			MinX:     n.X - clearance,
			MaxX:     n.X + n.Width + clearance,
			MinY:     n.Y - clearance,
			MaxY:     n.Y + n.Height + clearance,
			IsActive: true,
		}
		idx.obstacles[i] = obs

		// Insert into spatial grid cells
		minCellX := int(math.Floor(obs.MinX / cellSize))
		maxCellX := int(math.Floor(obs.MaxX / cellSize))
		minCellY := int(math.Floor(obs.MinY / cellSize))
		maxCellY := int(math.Floor(obs.MaxY / cellSize))

		for cx := minCellX; cx <= maxCellX; cx++ {
			for cy := minCellY; cy <= maxCellY; cy++ {
				key := spatialCellKey(cx, cy)
				idx.cellMap[key] = append(idx.cellMap[key], i)
			}
		}
	}

	return idx
}

func spatialCellKey(cx, cy int) int64 {
	return (int64(cx) << 32) | (int64(cy) & 0xFFFFFFFF)
}

// IsPointBlocked checks if a 2D point collides with any indexed obstacle (excluding source/target blocks).
func (idx *SceneSpatialIndex) IsPointBlocked(p Point, excludeID1, excludeID2 string) bool {
	cx := int(math.Floor(p.X / idx.gridSize))
	cy := int(math.Floor(p.Y / idx.gridSize))
	key := spatialCellKey(cx, cy)

	candidateIndices, ok := idx.cellMap[key]
	if !ok {
		return false
	}

	for _, obsIdx := range candidateIndices {
		obs := idx.obstacles[obsIdx]
		if !obs.IsActive || obs.ID == excludeID1 || obs.ID == excludeID2 {
			continue
		}
		if p.X >= obs.MinX && p.X <= obs.MaxX && p.Y >= obs.MinY && p.Y <= obs.MaxY {
			return true
		}
	}
	return false
}

// IsSegmentBlocked checks if an orthogonal line segment intersects any obstacle envelope.
func (idx *SceneSpatialIndex) IsSegmentBlocked(p1, p2 Point, excludeID1, excludeID2 string) bool {
	segMinX := math.Min(p1.X, p2.X)
	segMaxX := math.Max(p1.X, p2.X)
	segMinY := math.Min(p1.Y, p2.Y)
	segMaxY := math.Max(p1.Y, p2.Y)

	minCellX := int(math.Floor(segMinX / idx.gridSize))
	maxCellX := int(math.Floor(segMaxX / idx.gridSize))
	minCellY := int(math.Floor(segMinY / idx.gridSize))
	maxCellY := int(math.Floor(segMaxY / idx.gridSize))

	visited := make(map[int]bool)

	for cx := minCellX; cx <= maxCellX; cx++ {
		for cy := minCellY; cy <= maxCellY; cy++ {
			key := spatialCellKey(cx, cy)
			for _, obsIdx := range idx.cellMap[key] {
				if visited[obsIdx] {
					continue
				}
				visited[obsIdx] = true

				obs := idx.obstacles[obsIdx]
				if !obs.IsActive || obs.ID == excludeID1 || obs.ID == excludeID2 {
					continue
				}

				// Check AABB overlap between segment and obstacle envelope
				if segMaxX >= obs.MinX && segMinX <= obs.MaxX && segMaxY >= obs.MinY && segMinY <= obs.MaxY {
					return true
				}
			}
		}
	}

	return false
}
