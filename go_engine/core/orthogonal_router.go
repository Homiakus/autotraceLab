package core

import (
	"container/heap"
	"context"
	"math"
)

func getDirCode(dx, dy int) int {
	if dx == 1 {
		return 0
	}
	if dx == -1 {
		return 1
	}
	if dy == 1 {
		return 2
	}
	if dy == -1 {
		return 3
	}
	return 4
}

type coordKey struct {
	X int
	Y int
}

type stateKey struct {
	X   int
	Y   int
	Dir int
}

type segmentKey struct {
	P1 coordKey
	P2 coordKey
}

func makeSegmentKey(gx1, gy1, gx2, gy2 int) segmentKey {
	c1 := coordKey{X: gx1, Y: gy1}
	c2 := coordKey{X: gx2, Y: gy2}
	if c1.X < c2.X || (c1.X == c2.X && c1.Y < c2.Y) {
		return segmentKey{P1: c1, P2: c2}
	}
	return segmentKey{P1: c2, P2: c1}
}

type astarNode struct {
	x, y   int
	dirX   int
	dirY   int
	g, f   float64
	parent *astarNode
	index  int
}

type astarQueue []*astarNode

func (q astarQueue) Len() int { return len(q) }
func (q astarQueue) Less(i, j int) bool {
	if q[i].f == q[j].f {
		return q[i].g < q[j].g
	}
	return q[i].f < q[j].f
}
func (q astarQueue) Swap(i, j int) {
	q[i], q[j] = q[j], q[i]
	q[i].index = i
	q[j].index = j
}
func (q *astarQueue) Push(v any) {
	item := v.(*astarNode)
	item.index = len(*q)
	*q = append(*q, item)
}
func (q *astarQueue) Pop() any {
	old := *q
	n := len(old)
	item := old[n-1]
	old[n-1] = nil
	*q = old[:n-1]
	return item
}

func GetPortCoordinates(node BlockNode, portID string, outputHint bool) PortCoordinates {
	return GetPortCoordinatesAccurate(node, portID, outputHint)
}

// RouteOrthogonalAStar implements production Orthogonal A* Router with 4-way normal vectors.
func RouteOrthogonalAStar(nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) []EdgeConnection {
	res, _ := RouteOrthogonalAStarWithContext(context.Background(), nodes, edges, options)
	return res
}

// RouteOrthogonalAStarWithContext executes A* routing with context cancellation check on internal iterations.
func RouteOrthogonalAStarWithContext(ctx context.Context, nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) ([]EdgeConnection, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if len(edges) == 0 {
		return append([]EdgeConnection(nil), edges...), nil
	}

	nodeMap := make(map[string]BlockNode, len(nodes))
	for _, node := range nodes {
		nodeMap[node.ID] = node
	}

	gridSize := options.GridSize
	if gridSize < 6 {
		gridSize = 10
	}
	if gridSize > 20 {
		gridSize = 20
	}

	weights := options.Weights
	if weights.CrossingWeight == 0 && weights.StraightnessWeight == 0 {
		weights = DefaultOptimizationWeights()
	}

	clearanceScale := weights.ClearanceWeight / 80.0
	obsClearance := options.ObstacleClearance
	if obsClearance <= 0 {
		obsClearance = 16.0
	}
	clearance := math.Max(8.0, obsClearance*clearanceScale)

	bendPenaltyOpt := options.BendPenalty
	if bendPenaltyOpt <= 0 {
		bendPenaltyOpt = 35.0
	}
	bendCost := bendPenaltyOpt * (weights.BendWeight / 25.0)

	crossingPenaltyFactor := weights.CrossingWeight*0.8 + 15.0
	straightBonusFactor := (weights.StraightnessWeight / 100.0) * 12.0
	stepBaseCost := math.Max(2.0, gridSize*(weights.WirelengthWeight/40.0+0.5))

	channelSpacing := options.ChannelSpacing
	if channelSpacing <= 0 {
		channelSpacing = 16.0
	}

	minX := 1e9
	maxX := -1e9
	minY := 1e9
	maxY := -1e9

	for _, n := range nodes {
		if n.X < minX {
			minX = n.X
		}
		if n.X+n.Width > maxX {
			maxX = n.X + n.Width
		}
		if n.Y < minY {
			minY = n.Y
		}
		if n.Y+n.Height > maxY {
			maxY = n.Y + n.Height
		}
	}
	if minX == 1e9 {
		minX, maxX, minY, maxY = 0, 1000, 0, 1000
	}
	minX -= 200
	maxX += 200
	minY -= 200
	maxY += 200

	routedGridUsage := make(map[coordKey]int)
	routedGridSegments := make(map[segmentKey]bool)
	wireProximityMap := make(map[coordKey]int)

	obstacles := make([]ObstacleBox, len(nodes))
	for i, n := range nodes {
		nodeClearance := clearance
		if n.RoutingClearance != nil && *n.RoutingClearance > 0 {
			nodeClearance = *n.RoutingClearance * clearanceScale
		}
		obstacles[i] = ObstacleBox{
			ID:   n.ID,
			MinX: n.X - nodeClearance,
			MaxX: n.X + n.Width + nodeClearance,
			MinY: n.Y - nodeClearance,
			MaxY: n.Y + n.Height + nodeClearance,
		}
	}

	const spatialCell = 128.0
	spatialGrid := make(map[coordKey][]ObstacleBox)
	for _, obs := range obstacles {
		cellMinX := int(math.Floor(obs.MinX / spatialCell))
		cellMaxX := int(math.Floor(obs.MaxX / spatialCell))
		cellMinY := int(math.Floor(obs.MinY / spatialCell))
		cellMaxY := int(math.Floor(obs.MaxY / spatialCell))

		for cx := cellMinX; cx <= cellMaxX; cx++ {
			for cy := cellMinY; cy <= cellMaxY; cy++ {
				cKey := coordKey{X: cx, Y: cy}
				spatialGrid[cKey] = append(spatialGrid[cKey], obs)
			}
		}
	}

	edgesOnSourceFace := make(map[string][]string)
	edgesOnTargetFace := make(map[string][]string)
	for _, edge := range edges {
		sNode, okS := nodeMap[edge.SourceBlockID]
		tNode, okT := nodeMap[edge.TargetBlockID]
		if okS {
			sPos := GetPortCoordinates(sNode, edge.SourcePortID, true)
			sKey := sNode.ID + "-" + string(sPos.Side)
			edgesOnSourceFace[sKey] = append(edgesOnSourceFace[sKey], edge.ID)
		}
		if okT {
			tPos := GetPortCoordinates(tNode, edge.TargetPortID, false)
			tKey := tNode.ID + "-" + string(tPos.Side)
			edgesOnTargetFace[tKey] = append(edgesOnTargetFace[tKey], edge.ID)
		}
	}

	isInsideObstacle := func(px, py float64, allowNodeA, allowNodeB string) bool {
		cx := int(math.Floor(px / spatialCell))
		cy := int(math.Floor(py / spatialCell))
		cKey := coordKey{X: cx, Y: cy}
		bucket := spatialGrid[cKey]
		if len(bucket) == 0 {
			return false
		}

		for _, obs := range bucket {
			node := nodeMap[obs.ID]
			// 1. Strict Physical Node Core Body Check
			if px >= node.X && px <= node.X+node.Width && py >= node.Y && py <= node.Y+node.Height {
				return true
			}
			// 2. Clearance Buffer Check for third-party blocks
			if obs.ID != allowNodeA && obs.ID != allowNodeB {
				if px >= obs.MinX && px <= obs.MaxX && py >= obs.MinY && py <= obs.MaxY {
					return true
				}
			}
		}
		return false
	}

	dirs := []struct {
		dx, dy, code int
	}{
		{dx: 1, dy: 0, code: 0},
		{dx: -1, dy: 0, code: 1},
		{dx: 0, dy: 1, code: 2},
		{dx: 0, dy: -1, code: 3},
	}

	result := make([]EdgeConnection, len(edges))
	for edgeIdx, edge := range edges {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		sourceNode, okS := nodeMap[edge.SourceBlockID]
		targetNode, okT := nodeMap[edge.TargetBlockID]
		if !okS || !okT {
			result[edgeIdx] = edge
			continue
		}

		sourcePos := GetPortCoordinates(sourceNode, edge.SourcePortID, true)
		targetPos := GetPortCoordinates(targetNode, edge.TargetPortID, false)

		baseStub := options.PortExitOffset
		if baseStub <= 0 {
			baseStub = 20.0
		}
		sourceStub := math.Max(18.0, baseStub)
		targetStub := math.Max(18.0, baseStub)

		srcFaceKey := sourceNode.ID + "-" + string(sourcePos.Side)
		srcList := edgesOnSourceFace[srcFaceKey]
		if len(srcList) > 1 {
			srcIdx := 0
			for idx, eid := range srcList {
				if eid == edge.ID {
					srcIdx = idx
					break
				}
			}
			staggerDelta := 10.0
			sourceStub += (float64(srcIdx) - float64(len(srcList)-1)/2.0) * staggerDelta
			sourceStub = math.Max(16.0, math.Round(sourceStub))
		}

		tgtFaceKey := targetNode.ID + "-" + string(targetPos.Side)
		tgtList := edgesOnTargetFace[tgtFaceKey]
		if len(tgtList) > 1 {
			tgtIdx := 0
			for idx, eid := range tgtList {
				if eid == edge.ID {
					tgtIdx = idx
					break
				}
			}
			staggerDelta := 10.0
			targetStub += (float64(tgtIdx) - float64(len(tgtList)-1)/2.0) * staggerDelta
			targetStub = math.Max(16.0, math.Round(targetStub))
		}

		startPoint := Point{
			X: sourcePos.X + float64(sourcePos.Normal.Dx)*sourceStub,
			Y: sourcePos.Y + float64(sourcePos.Normal.Dy)*sourceStub,
		}
		endPoint := Point{
			X: targetPos.X + float64(targetPos.Normal.Dx)*targetStub,
			Y: targetPos.Y + float64(targetPos.Normal.Dy)*targetStub,
		}

		snapStartX := math.Round(startPoint.X/gridSize) * gridSize
		snapStartY := math.Round(startPoint.Y/gridSize) * gridSize
		snapEndX := math.Round(endPoint.X/gridSize) * gridSize
		snapEndY := math.Round(endPoint.Y/gridSize) * gridSize

		initialDirX := sourcePos.Normal.Dx
		initialDirY := sourcePos.Normal.Dy
		initialDirCode := getDirCode(initialDirX, initialDirY)

		openHeap := astarQueue{}
		heap.Init(&openHeap)
		closedSet := make(map[stateKey]bool)
		bestG := make(map[stateKey]float64)

		startGx := int(snapStartX / gridSize)
		startGy := int(snapStartY / gridSize)
		startNodeKey := stateKey{X: startGx, Y: startGy, Dir: initialDirCode}

		hStart := math.Abs(snapEndX-snapStartX) + math.Abs(snapEndY-snapStartY)
		startNode := &astarNode{
			x:    int(snapStartX),
			y:    int(snapStartY),
			dirX: initialDirX,
			dirY: initialDirY,
			g:    0,
			f:    hStart,
		}
		heap.Push(&openHeap, startNode)
		bestG[startNodeKey] = 0

		var finalNode *astarNode
		iterations := 0
		maxIterations := 15000

		for openHeap.Len() > 0 && iterations < maxIterations {
			iterations++
			if iterations%128 == 0 {
				select {
				case <-ctx.Done():
					return nil, ctx.Err()
				default:
				}
			}

			current := heap.Pop(&openHeap).(*astarNode)

			distToEnd := math.Abs(float64(current.x)-snapEndX) + math.Abs(float64(current.y)-snapEndY)
			if distToEnd <= gridSize {
				finalNode = current
				break
			}

			currGx := current.x / int(gridSize)
			currGy := current.y / int(gridSize)
			currDirCode := getDirCode(current.dirX, current.dirY)
			stKey := stateKey{X: currGx, Y: currGy, Dir: currDirCode}

			if closedSet[stKey] {
				continue
			}
			closedSet[stKey] = true

			for _, d := range dirs {
				// Prevent 180-degree immediate reversal
				if d.dx == -current.dirX && d.dy == -current.dirY && (current.dirX != 0 || current.dirY != 0) {
					continue
				}

				nx := float64(current.x + d.dx*int(gridSize))
				ny := float64(current.y + d.dy*int(gridSize))

				if nx < minX || nx > maxX || ny < minY || ny > maxY {
					continue
				}
				if isInsideObstacle(nx, ny, sourceNode.ID, targetNode.ID) {
					continue
				}

				nextGx := int(nx / gridSize)
				nextGy := int(ny / gridSize)

				segKey := makeSegmentKey(currGx, currGy, nextGx, nextGy)
				if routedGridSegments[segKey] {
					// Strictly prohibited shared wire segment
					continue
				}

				isBend := (current.dirX != 0 || current.dirY != 0) && (d.dx != current.dirX || d.dy != current.dirY)
				cKey := coordKey{X: nextGx, Y: nextGy}
				cellUsage := float64(routedGridUsage[cKey])
				proximityPenalty := float64(wireProximityMap[cKey])

				alignsWithTargetApproach := (targetPos.Normal.Dx == -1 && d.dx == 1) ||
					(targetPos.Normal.Dx == 1 && d.dx == -1) ||
					(targetPos.Normal.Dy == -1 && d.dy == 1) ||
					(targetPos.Normal.Dy == 1 && d.dy == -1)

				isContinuingStraight := !isBend && (current.dirX != 0 || current.dirY != 0)

				stepCost := stepBaseCost
				if isBend {
					stepCost += bendCost
				}
				if isContinuingStraight {
					stepCost -= straightBonusFactor
				}
				stepCost += cellUsage * crossingPenaltyFactor
				stepCost += proximityPenalty * 10.0
				if alignsWithTargetApproach {
					stepCost -= 8.0
				}

				newG := current.g + math.Max(1.0, stepCost)
				neighborKey := stateKey{X: nextGx, Y: nextGy, Dir: d.code}

				if prevBestG, ok := bestG[neighborKey]; ok && newG >= prevBestG {
					continue
				}
				bestG[neighborKey] = newG

				h := math.Abs(snapEndX-nx) + math.Abs(snapEndY-ny)
				neighbor := &astarNode{
					x:      int(nx),
					y:      int(ny),
					dirX:   d.dx,
					dirY:   d.dy,
					g:      newG,
					f:      newG + h,
					parent: current,
				}
				heap.Push(&openHeap, neighbor)
			}
		}

		var rawPoints []Point
		if finalNode != nil {
			curr := finalNode
			for curr != nil {
				rawPoints = append([]Point{{X: float64(curr.x), Y: float64(curr.y)}}, rawPoints...)
				currGx := curr.x / int(gridSize)
				currGy := curr.y / int(gridSize)
				cKey := coordKey{X: currGx, Y: currGy}
				routedGridUsage[cKey]++

				if curr.parent != nil {
					parentGx := curr.parent.x / int(gridSize)
					parentGy := curr.parent.y / int(gridSize)
					segKey := makeSegmentKey(parentGx, parentGy, currGx, currGy)
					routedGridSegments[segKey] = true
				}

				proxRadius := int(math.Ceil(channelSpacing / gridSize))
				for dx := -proxRadius; dx <= proxRadius; dx++ {
					for dy := -proxRadius; dy <= proxRadius; dy++ {
						if dx == 0 && dy == 0 {
							continue
						}
						pxKey := coordKey{X: currGx + dx, Y: currGy + dy}
						wireProximityMap[pxKey]++
					}
				}

				curr = curr.parent
			}
		}

		var fullPath []Point
		if len(rawPoints) > 0 {
			fullPath = append([]Point{{X: sourcePos.X, Y: sourcePos.Y}, startPoint}, rawPoints...)
			fullPath = append(fullPath, endPoint, Point{X: targetPos.X, Y: targetPos.Y})
		} else {
			fullPath = []Point{
				{X: sourcePos.X, Y: sourcePos.Y},
				startPoint,
				{X: startPoint.X, Y: endPoint.Y},
				endPoint,
				{X: targetPos.X, Y: targetPos.Y},
			}
		}

		cleaned := fullPath
		if BoolVal(options.ArtifactCleaning, true) {
			cleaned = CleanOrthogonalArtifacts(
				fullPath,
				&sourcePos,
				&targetPos,
				nodes,
				clearance,
				sourceStub,
				targetStub,
			)
		}

		edge.Path = cleaned
		edge.Bends = countBends(cleaned)
		edge.Length = pathLength(cleaned)
		result[edgeIdx] = edge
	}

	return result, nil
}

func minmax(a, b int) (int, int) {
	if a < b {
		return a, b
	}
	return b, a
}

func pathLength(path []Point) float64 {
	total := 0.0
	for i := 0; i+1 < len(path); i++ {
		total += math.Hypot(path[i+1].X-path[i].X, path[i+1].Y-path[i].Y)
	}
	return total
}

func countBends(path []Point) int {
	bends := 0
	for i := 1; i+1 < len(path); i++ {
		a, b, c := path[i-1], path[i], path[i+1]
		if (!almost(a.X, b.X) && !almost(b.X, c.X)) || (!almost(a.Y, b.Y) && !almost(b.Y, c.Y)) {
			bends++
		} else if (almost(a.X, b.X) && almost(b.Y, c.Y)) || (almost(a.Y, b.Y) && almost(b.X, c.X)) {
			bends++
		}
	}
	return bends
}
