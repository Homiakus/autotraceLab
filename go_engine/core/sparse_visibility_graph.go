package core

import (
	"container/heap"
	"math"
	"sort"
)

// VisibilityVertex represents an orthogonal routing waypoint.
type VisibilityVertex struct {
	ID        int
	Pos       Point
	Neighbors []int // neighbor vertex IDs
}

// SparseVisibilityGraph models the obstacle-free orthogonal roadmap.
type SparseVisibilityGraph struct {
	Vertices []VisibilityVertex
	Index    *SceneSpatialIndex
}

// BuildSparseVisibilityGraph extracts key clearance corners, channel midlines, and connects visible pairs.
func BuildSparseVisibilityGraph(nodes []BlockNode, clearance float64) *SparseVisibilityGraph {
	if clearance <= 0 {
		clearance = 12.0
	}
	idx := NewSceneSpatialIndex(nodes, clearance)

	vertexMap := make(map[Point]int)
	var vertices []VisibilityVertex

	addVertex := func(p Point) int {
		// Snap to integer or 0.5px
		pt := Point{X: math.Round(p.X*2) / 2, Y: math.Round(p.Y*2) / 2}
		if vid, ok := vertexMap[pt]; ok {
			return vid
		}
		vid := len(vertices)
		vertices = append(vertices, VisibilityVertex{
			ID:  vid,
			Pos: pt,
		})
		vertexMap[pt] = vid
		return vid
	}

	// 1. Generate clearance corner vertices for each block
	for _, n := range nodes {
		minX, maxX := n.X-clearance, n.X+n.Width+clearance
		minY, maxY := n.Y-clearance, n.Y+n.Height+clearance

		addVertex(Point{X: minX, Y: minY})
		addVertex(Point{X: maxX, Y: minY})
		addVertex(Point{X: minX, Y: maxY})
		addVertex(Point{X: maxX, Y: maxY})

		// Also midpoints of obstacle faces
		addVertex(Point{X: (minX + maxX) / 2, Y: minY})
		addVertex(Point{X: (minX + maxX) / 2, Y: maxY})
		addVertex(Point{X: minX, Y: (minY + maxY) / 2})
		addVertex(Point{X: maxX, Y: (minY + maxY) / 2})
	}

	// 2. Add channel midline coordinates between pairs of obstacles
	for i := 0; i < len(nodes); i++ {
		for j := i + 1; j < len(nodes); j++ {
			u, v := nodes[i], nodes[j]
			midX := (u.X + u.Width + v.X) / 2
			midY := (u.Y + u.Height + v.Y) / 2

			// Horizontal channel line
			if math.Abs(u.X-v.X) > 40 {
				addVertex(Point{X: midX, Y: (u.Y + v.Y) / 2})
			}
			// Vertical channel line
			if math.Abs(u.Y-v.Y) > 40 {
				addVertex(Point{X: (u.X + v.X) / 2, Y: midY})
			}
		}
	}

	// 3. Connect orthogonal visible lines (shared X or shared Y)
	// Group vertices by X and by Y for O(N log N) sweep
	byX := make(map[float64][]int)
	byY := make(map[float64][]int)

	for i, v := range vertices {
		byX[v.Pos.X] = append(byX[v.Pos.X], i)
		byY[v.Pos.Y] = append(byY[v.Pos.Y], i)
	}

	// Sort and connect adjacent collinear vertices if unblocked
	for _, vids := range byX {
		sort.Slice(vids, func(a, b int) bool {
			return vertices[vids[a]].Pos.Y < vertices[vids[b]].Pos.Y
		})
		for k := 0; k < len(vids)-1; k++ {
			v1 := vids[k]
			v2 := vids[k+1]
			p1, p2 := vertices[v1].Pos, vertices[v2].Pos
			if !idx.IsSegmentBlocked(p1, p2, "", "") {
				vertices[v1].Neighbors = append(vertices[v1].Neighbors, v2)
				vertices[v2].Neighbors = append(vertices[v2].Neighbors, v1)
			}
		}
	}

	for _, vids := range byY {
		sort.Slice(vids, func(a, b int) bool {
			return vertices[vids[a]].Pos.X < vertices[vids[b]].Pos.X
		})
		for k := 0; k < len(vids)-1; k++ {
			v1 := vids[k]
			v2 := vids[k+1]
			p1, p2 := vertices[v1].Pos, vertices[v2].Pos
			if !idx.IsSegmentBlocked(p1, p2, "", "") {
				vertices[v1].Neighbors = append(vertices[v1].Neighbors, v2)
				vertices[v2].Neighbors = append(vertices[v2].Neighbors, v1)
			}
		}
	}

	return &SparseVisibilityGraph{
		Vertices: vertices,
		Index:    idx,
	}
}

type sparseAStarItem struct {
	vertexID int
	cost     float64
	priority float64
	index    int
}

type sparsePQ []*sparseAStarItem

func (pq sparsePQ) Len() int           { return len(pq) }
func (pq sparsePQ) Less(i, j int) bool { return pq[i].priority < pq[j].priority }
func (pq sparsePQ) Swap(i, j int)      { pq[i], pq[j] = pq[j], pq[i]; pq[i].index = i; pq[j].index = j }
func (pq *sparsePQ) Push(x any) {
	n := len(*pq)
	item := x.(*sparseAStarItem)
	item.index = n
	*pq = append(*pq, item)
}
func (pq *sparsePQ) Pop() any {
	old := *pq
	n := len(old)
	item := old[n-1]
	old[n-1] = nil
	item.index = -1
	*pq = old[0 : n-1]
	return item
}

// RouteSparseVisibilityGraph routes between start and end using Sparse A*.
func (svg *SparseVisibilityGraph) Route(start, end Point, srcBlockID, tgtBlockID string) []Point {
	// Temporarily inject start and end into graph
	startVID := len(svg.Vertices)
	svg.Vertices = append(svg.Vertices, VisibilityVertex{ID: startVID, Pos: start})
	endVID := len(svg.Vertices)
	svg.Vertices = append(svg.Vertices, VisibilityVertex{ID: endVID, Pos: end})

	defer func() {
		svg.Vertices = svg.Vertices[:startVID]
	}()

	// Connect start and end to visible orthogonal vertices
	for i := 0; i < startVID; i++ {
		v := &svg.Vertices[i]
		if math.Abs(start.X-v.Pos.X) < 1.0 || math.Abs(start.Y-v.Pos.Y) < 1.0 {
			if !svg.Index.IsSegmentBlocked(start, v.Pos, srcBlockID, tgtBlockID) {
				svg.Vertices[startVID].Neighbors = append(svg.Vertices[startVID].Neighbors, i)
				v.Neighbors = append(v.Neighbors, startVID)
			}
		}
		if math.Abs(end.X-v.Pos.X) < 1.0 || math.Abs(end.Y-v.Pos.Y) < 1.0 {
			if !svg.Index.IsSegmentBlocked(end, v.Pos, srcBlockID, tgtBlockID) {
				svg.Vertices[endVID].Neighbors = append(svg.Vertices[endVID].Neighbors, i)
				v.Neighbors = append(v.Neighbors, endVID)
			}
		}
	}

	// Run A*
	dist := make(map[int]float64)
	parent := make(map[int]int)
	dist[startVID] = 0.0

	pq := &sparsePQ{}
	heap.Init(pq)
	heap.Push(pq, &sparseAStarItem{
		vertexID: startVID,
		cost:     0,
		priority: math.Hypot(end.X-start.X, end.Y-start.Y),
	})

	found := false
	for pq.Len() > 0 {
		curr := heap.Pop(pq).(*sparseAStarItem)
		u := curr.vertexID

		if u == endVID {
			found = true
			break
		}

		if curr.cost > dist[u] {
			continue
		}

		for _, v := range svg.Vertices[u].Neighbors {
			edgeLen := math.Hypot(svg.Vertices[u].Pos.X-svg.Vertices[v].Pos.X, svg.Vertices[u].Pos.Y-svg.Vertices[v].Pos.Y)
			newCost := dist[u] + edgeLen

			if d, ok := dist[v]; !ok || newCost < d {
				dist[v] = newCost
				parent[v] = u
				h := math.Hypot(end.X-svg.Vertices[v].Pos.X, end.Y-svg.Vertices[v].Pos.Y)
				heap.Push(pq, &sparseAStarItem{
					vertexID: v,
					cost:     newCost,
					priority: newCost + h,
				})
			}
		}
	}

	if !found {
		return nil
	}

	// Reconstruct path
	var path []Point
	curr := endVID
	for curr != startVID {
		path = append(path, svg.Vertices[curr].Pos)
		curr = parent[curr]
	}
	path = append(path, svg.Vertices[startVID].Pos)

	// Reverse
	for i, j := 0, len(path)-1; i < j; i, j = i+1, j-1 {
		path[i], path[j] = path[j], path[i]
	}

	return path
}
