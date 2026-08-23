package main

import (
	"container/heap"
	"math"
	"sort"
)

// AStarNode represents a node in the A* priority queue
type AStarNode struct {
	X         int
	Y         int
	DirX      int
	DirY      int
	GCost     float64
	FCost     float64
	Bends     int
	Crossings int
	Parent    *AStarNode
	Index     int
}

// PriorityQueue implements heap.Interface for *AStarNode
type PriorityQueue []*AStarNode

func (pq PriorityQueue) Len() int           { return len(pq) }
func (pq PriorityQueue) Less(i, j int) bool { return pq[i].FCost < pq[j].FCost }
func (pq PriorityQueue) Swap(i, j int) {
	pq[i], pq[j] = pq[j], pq[i]
	pq[i].Index = i
	pq[j].Index = j
}
func (pq *PriorityQueue) Push(x interface{}) {
	n := len(*pq)
	item := x.(*AStarNode)
	item.Index = n
	*pq = append(*pq, item)
}
func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	item := old[n-1]
	old[n-1] = nil
	item.Index = -1
	*pq = old[0 : n-1]
	return item
}

// Key for visited states: (gridX, gridY, dirX, dirY)
type GridKey struct {
	X    int
	Y    int
	DirX int
	DirY int
}

// GridSegment represents an occupied orthogonal wire segment for channel congestion
type GridSegment struct {
	X1, Y1, X2, Y2 int
}

func normalizeSegment(x1, y1, x2, y2 int) GridSegment {
	if x1 < x2 || (x1 == x2 && y1 < y2) {
		return GridSegment{x1, y1, x2, y2}
	}
	return GridSegment{x2, y2, x1, y1}
}

// GetPortCoordinates computes exact (X, Y) and direction normal for a port
func GetPortCoordinates(node BlockNode, portID string, isOutputHint bool) PortCoordinates {
	return GetPortCoordinatesAccurate(node, portID, isOutputHint)
}

// RouteOrthogonalAStar routes all connections with maximum efficiency
func RouteOrthogonalAStar(nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) []EdgeConnection {
	if len(edges) == 0 {
		return edges
	}

	gridSize := options.GridSize
	if gridSize <= 0 {
		gridSize = 10.0
	}
	clearance := options.ObstacleClearance
	if clearance <= 0 {
		clearance = 15.0
	}
	bendPenalty := options.BendPenalty
	if bendPenalty <= 0 {
		bendPenalty = 35.0
	}
	crossingPenalty := options.CrossingPenalty
	if crossingPenalty <= 0 {
		crossingPenalty = 25.0
	}

	nodeMap := make(map[string]BlockNode, len(nodes))
	for _, n := range nodes {
		nodeMap[n.ID] = n
	}

	// Sort edges: shorter Manhattan distances routed first
	type EdgeWithMeta struct {
		edge        EdgeConnection
		originalIdx int
		manhattan   float64
	}

	edgeList := make([]EdgeWithMeta, len(edges))
	for i, e := range edges {
		sNode, ok1 := nodeMap[e.SourceBlockID]
		tNode, ok2 := nodeMap[e.TargetBlockID]
		var dist float64
		if ok1 && ok2 {
			sPos := GetPortCoordinates(sNode, e.SourcePortID, true)
			tPos := GetPortCoordinates(tNode, e.TargetPortID, false)
			dist = math.Abs(sPos.X-tPos.X) + math.Abs(sPos.Y-tPos.Y)
		}
		edgeList[i] = EdgeWithMeta{edge: e, originalIdx: i, manhattan: dist}
	}

	sort.Slice(edgeList, func(i, j int) bool {
		return edgeList[i].manhattan < edgeList[j].manhattan
	})

	routedSegments := make(map[GridSegment]bool)
	resultEdges := make([]EdgeConnection, len(edges))

	for _, item := range edgeList {
		e := item.edge
		sNode, ok1 := nodeMap[e.SourceBlockID]
		tNode, ok2 := nodeMap[e.TargetBlockID]
		if !ok1 || !ok2 {
			resultEdges[item.originalIdx] = e
			continue
		}

		sPos := GetPortCoordinates(sNode, e.SourcePortID, true)
		tPos := GetPortCoordinates(tNode, e.TargetPortID, false)

		rawPath := routeSingleNet(sPos, tPos, nodes, routedSegments, gridSize, clearance, bendPenalty, crossingPenalty, sNode.ID, tNode.ID)

		var finalPath []Point
		if options.ArtifactCleaning {
			sStub := options.PortExitOffset
			tStub := options.PortExitOffset
			finalPath = CleanOrthogonalArtifacts(rawPath, &sPos, &tPos, nodes, clearance, sStub, tStub)
		} else {
			finalPath = rawPath
		}

		bends := 0
		length := 0.0
		for idx := 0; idx < len(finalPath)-1; idx++ {
			pA := finalPath[idx]
			pB := finalPath[idx+1]
			segLen := math.Hypot(pB.X-pA.X, pB.Y-pA.Y)
			length += segLen

			if idx > 0 {
				pPrev := finalPath[idx-1]
				dir1X := pA.X - pPrev.X
				dir1Y := pA.Y - pPrev.Y
				dir2X := pB.X - pA.X
				dir2Y := pB.Y - pA.Y
				if (dir1X != 0 && dir2Y != 0) || (dir1Y != 0 && dir2X != 0) {
					bends++
				}
			}

			// Mark grid segments
			gX1 := int(math.Round(pA.X / gridSize))
			gY1 := int(math.Round(pA.Y / gridSize))
			gX2 := int(math.Round(pB.X / gridSize))
			gY2 := int(math.Round(pB.Y / gridSize))

			if gX1 != gX2 && gY1 == gY2 {
				step := 1
				if gX2 < gX1 {
					step = -1
				}
				for x := gX1; x != gX2; x += step {
					seg := normalizeSegment(x, gY1, x+step, gY1)
					routedSegments[seg] = true
				}
			} else if gY1 != gY2 && gX1 == gX2 {
				step := 1
				if gY2 < gY1 {
					step = -1
				}
				for y := gY1; y != gY2; y += step {
					seg := normalizeSegment(gX1, y, gX1, y+step)
					routedSegments[seg] = true
				}
			}
		}

		e.Path = finalPath
		e.Bends = bends
		e.Length = length
		resultEdges[item.originalIdx] = e
	}

	return resultEdges
}

func routeSingleNet(
	sPos, tPos PortCoordinates,
	nodes []BlockNode,
	routedSegments map[GridSegment]bool,
	gridSize, clearance, bendPenalty, crossingPenalty float64,
	sourceNodeID, targetNodeID string,
) []Point {
	// Check direct 0-bend path
	if sPos.Normal.Dx == 1 && tPos.Normal.Dx == -1 && math.Abs(sPos.Y-tPos.Y) < 0.001 && tPos.X > sPos.X {
		boxes := make([]ObstacleBox, len(nodes))
		for i, n := range nodes {
			boxes[i] = ObstacleBox{
				ID:   n.ID,
				MinX: n.X - clearance,
				MaxX: n.X + n.Width + clearance,
				MinY: n.Y - clearance,
				MaxY: n.Y + n.Height + clearance,
			}
		}
		if !isSegmentBlocked(Point{X: sPos.X, Y: sPos.Y}, Point{X: tPos.X, Y: tPos.Y}, boxes, nodes, []string{sourceNodeID, targetNodeID}) {
			return []Point{{X: sPos.X, Y: sPos.Y}, {X: tPos.X, Y: tPos.Y}}
		}
	}

	// Grid coords
	startGX := int(math.Round(sPos.X / gridSize))
	startGY := int(math.Round(sPos.Y / gridSize))
	targetGX := int(math.Round(tPos.X / gridSize))
	targetGY := int(math.Round(tPos.Y / gridSize))

	// Normal exit/entry grid points
	stubCells := int(math.Max(2, math.Round((clearance+10)/gridSize)))
	srcExitGX := startGX + sPos.Normal.Dx*stubCells
	srcExitGY := startGY + sPos.Normal.Dy*stubCells
	tgtEntryGX := targetGX + tPos.Normal.Dx*stubCells
	tgtEntryGY := targetGY + tPos.Normal.Dy*stubCells

	// Grid bounding box with generous padding
	minGX, maxGX := startGX, targetGX
	if targetGX < minGX {
		minGX, maxGX = targetGX, startGX
	}
	minGY, maxGY := startGY, targetGY
	if targetGY < minGY {
		minGY, maxGY = targetGY, startGY
	}

	for _, n := range nodes {
		nGMinX := int(math.Floor((n.X - clearance) / gridSize))
		nGMaxX := int(math.Ceil((n.X + n.Width + clearance) / gridSize))
		nGMinY := int(math.Floor((n.Y - clearance) / gridSize))
		nGMaxY := int(math.Ceil((n.Y + n.Height + clearance) / gridSize))
		if nGMinX < minGX {
			minGX = nGMinX
		}
		if nGMaxX > maxGX {
			maxGX = nGMaxX
		}
		if nGMinY < minGY {
			minGY = nGMinY
		}
		if nGMaxY > maxGY {
			maxGY = nGMaxY
		}
	}
	pad := 15
	minGX -= pad
	maxGX += pad
	minGY -= pad
	maxGY += pad

	// Blocked cells grid
	isCellBlocked := func(gx, gy int) bool {
		px := float64(gx) * gridSize
		py := float64(gy) * gridSize
		for _, n := range nodes {
			if n.ID == sourceNodeID || n.ID == targetNodeID {
				// Only strict body blocked
				if px > n.X+2 && px < n.X+n.Width-2 && py > n.Y+2 && py < n.Y+n.Height-2 {
					return true
				}
				continue
			}
			if px >= n.X-clearance && px <= n.X+n.Width+clearance &&
				py >= n.Y-clearance && py <= n.Y+n.Height+clearance {
				return true
			}
		}
		return false
	}

	pq := make(PriorityQueue, 0, 500)
	heap.Init(&pq)

	gScore := make(map[GridKey]float64)

	heuristic := func(gx, gy int) float64 {
		return (math.Abs(float64(gx-tgtEntryGX)) + math.Abs(float64(gy-tgtEntryGY))) * gridSize
	}

	startNode := &AStarNode{
		X:      srcExitGX,
		Y:      srcExitGY,
		DirX:   sPos.Normal.Dx,
		DirY:   sPos.Normal.Dy,
		GCost:  0,
		FCost:  heuristic(srcExitGX, srcExitGY),
		Parent: nil,
	}
	heap.Push(&pq, startNode)
	gScore[GridKey{srcExitGX, srcExitGY, sPos.Normal.Dx, sPos.Normal.Dy}] = 0

	directions := [4]Direction{
		{Dx: 1, Dy: 0},
		{Dx: -1, Dy: 0},
		{Dx: 0, Dy: 1},
		{Dx: 0, Dy: -1},
	}

	closedSet := make(map[GridKey]bool)
	var bestGoal *AStarNode
	maxExpansions := 20000
	expansions := 0

	for pq.Len() > 0 && expansions < maxExpansions {
		expansions++
		curr := heap.Pop(&pq).(*AStarNode)

		currKey := GridKey{curr.X, curr.Y, curr.DirX, curr.DirY}
		if closedSet[currKey] {
			continue
		}
		closedSet[currKey] = true

		if curr.X == tgtEntryGX && curr.Y == tgtEntryGY {
			bestGoal = curr
			break
		}

		for _, d := range directions {
			// No direct 180° backwards
			if d.Dx == -curr.DirX && d.Dy == -curr.DirY && (curr.DirX != 0 || curr.DirY != 0) {
				continue
			}

			nextX := curr.X + d.Dx
			nextY := curr.Y + d.Dy

			if nextX < minGX || nextX > maxGX || nextY < minGY || nextY > maxGY {
				continue
			}

			if isCellBlocked(nextX, nextY) {
				continue
			}

			isBend := (curr.DirX != 0 || curr.DirY != 0) && (d.Dx != curr.DirX || d.Dy != curr.DirY)
			moveCost := gridSize
			if isBend {
				moveCost += bendPenalty
			}

			// Check crossing with other wires
			seg := normalizeSegment(curr.X, curr.Y, nextX, nextY)
			if routedSegments[seg] {
				moveCost += crossingPenalty * 5.0
			}

			newG := curr.GCost + moveCost
			k := GridKey{nextX, nextY, d.Dx, d.Dy}

			if oldG, exists := gScore[k]; !exists || newG < oldG {
				gScore[k] = newG
				neighbor := &AStarNode{
					X:      nextX,
					Y:      nextY,
					DirX:   d.Dx,
					DirY:   d.Dy,
					GCost:  newG,
					FCost:  newG + heuristic(nextX, nextY),
					Parent: curr,
				}
				heap.Push(&pq, neighbor)
			}
		}
	}

	// Reconstruct path
	var path []Point
	path = append(path, Point{X: sPos.X, Y: sPos.Y})
	path = append(path, Point{X: float64(srcExitGX) * gridSize, Y: float64(srcExitGY) * gridSize})

	if bestGoal != nil {
		var midPoints []Point
		curr := bestGoal
		for curr != nil && (curr.X != srcExitGX || curr.Y != srcExitGY) {
			midPoints = append(midPoints, Point{
				X: float64(curr.X) * gridSize,
				Y: float64(curr.Y) * gridSize,
			})
			curr = curr.Parent
		}
		// reverse midPoints
		for i := len(midPoints) - 1; i >= 0; i-- {
			path = append(path, midPoints[i])
		}
	} else {
		// Fallback Manhattan bridge
		path = append(path, Point{
			X: float64(srcExitGX) * gridSize,
			Y: float64(tgtEntryGY) * gridSize,
		})
		path = append(path, Point{
			X: float64(tgtEntryGX) * gridSize,
			Y: float64(tgtEntryGY) * gridSize,
		})
	}

	path = append(path, Point{X: float64(tgtEntryGX) * gridSize, Y: float64(tgtEntryGY) * gridSize})
	path = append(path, Point{X: tPos.X, Y: tPos.Y})

	return mergeCollinearAndZeroLength(path)
}
