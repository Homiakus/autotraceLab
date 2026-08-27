package core

import (
	"math"
)

// LeeDebugWave represents a cell snapshot during Lee wave expansion.
type LeeDebugWave struct {
	X    int    `json:"x"`
	Y    int    `json:"y"`
	Val  int    `json:"val"`
	Type string `json:"type"` // "wall" | "wave" | "path" | "start" | "end"
}

// RouteManhattanChannel routes wires using L/Z/C orthogonal channel corridors.
func RouteManhattanChannel(nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) []EdgeConnection {
	if len(edges) == 0 {
		return append([]EdgeConnection(nil), edges...)
	}

	nodeMap := make(map[string]BlockNode, len(nodes))
	for _, n := range nodes {
		nodeMap[n.ID] = n
	}

	baseStub := options.PortExitOffset
	if baseStub <= 0 {
		baseStub = 20.0
	}
	channelSpacing := options.ChannelSpacing
	if channelSpacing <= 0 {
		channelSpacing = 16.0
	}
	channelStep := math.Max(8.0, channelSpacing)

	result := make([]EdgeConnection, len(edges))

	for edgeIdx, edge := range edges {
		sourceNode, okS := nodeMap[edge.SourceBlockID]
		targetNode, okT := nodeMap[edge.TargetBlockID]
		if !okS || !okT {
			result[edgeIdx] = edge
			continue
		}

		sourcePos := GetPortCoordinates(sourceNode, edge.SourcePortID, true)
		targetPos := GetPortCoordinates(targetNode, edge.TargetPortID, false)

		nudge := (float64(edgeIdx%6) - 2.5) * (channelStep * 0.75)
		sourceStub := math.Max(18.0, baseStub)
		targetStub := math.Max(18.0, baseStub)

		pStart := Point{X: sourcePos.X, Y: sourcePos.Y}
		pEnd := Point{X: targetPos.X, Y: targetPos.Y}

		stubStart := Point{
			X: sourcePos.X + float64(sourcePos.Normal.Dx)*sourceStub,
			Y: sourcePos.Y + float64(sourcePos.Normal.Dy)*sourceStub,
		}
		stubEnd := Point{
			X: targetPos.X + float64(targetPos.Normal.Dx)*targetStub,
			Y: targetPos.Y + float64(targetPos.Normal.Dy)*targetStub,
		}

		points := []Point{pStart, stubStart}

		minX := math.Min(stubStart.X, stubEnd.X)
		maxX := math.Max(stubStart.X, stubEnd.X)
		minY := math.Min(stubStart.Y, stubEnd.Y)
		maxY := math.Max(stubStart.Y, stubEnd.Y)

		var interveningBlocks []BlockNode
		for _, n := range nodes {
			if n.ID == sourceNode.ID || n.ID == targetNode.ID {
				continue
			}
			nRight := n.X + n.Width
			nBottom := n.Y + n.Height
			if n.X < maxX && nRight > minX && n.Y < maxY && nBottom > minY {
				interveningBlocks = append(interveningBlocks, n)
			}
		}

		if len(interveningBlocks) > 0 {
			blockMinY := interveningBlocks[0].Y
			blockMaxY := interveningBlocks[0].Y + interveningBlocks[0].Height
			for _, n := range interveningBlocks[1:] {
				if n.Y < blockMinY {
					blockMinY = n.Y
				}
				if n.Y+n.Height > blockMaxY {
					blockMaxY = n.Y + n.Height
				}
			}
			obsClearance := options.ObstacleClearance
			if obsClearance <= 0 {
				obsClearance = 16.0
			}
			bypassAboveY := blockMinY - obsClearance - 16.0 + nudge
			bypassBelowY := blockMaxY + obsClearance + 16.0 + nudge

			chosenY := bypassAboveY
			if math.Abs(stubStart.Y-bypassAboveY) > math.Abs(stubStart.Y-bypassBelowY) {
				chosenY = bypassBelowY
			}

			points = append(points, Point{X: stubStart.X, Y: chosenY})
			points = append(points, Point{X: stubEnd.X, Y: chosenY})
		} else {
			if sourcePos.Normal.Dx == 1 && targetPos.Normal.Dx == -1 {
				if stubEnd.X >= stubStart.X {
					midX := math.Round((stubStart.X+stubEnd.X)/2.0) + nudge
					points = append(points, Point{X: midX, Y: stubStart.Y})
					points = append(points, Point{X: midX, Y: stubEnd.Y})
				} else {
					routeAbove := (sourcePos.Y+targetPos.Y)/2.0 < 400.0
					clearanceY := math.Max(sourceNode.Y+sourceNode.Height, targetNode.Y+targetNode.Height) + 40.0 + nudge
					if routeAbove {
						clearanceY = math.Min(sourceNode.Y, targetNode.Y) - 40.0 + nudge
					}
					points = append(points, Point{X: stubStart.X, Y: clearanceY})
					points = append(points, Point{X: stubEnd.X, Y: clearanceY})
				}
			} else if sourcePos.Normal.Dy != 0 && targetPos.Normal.Dy != 0 {
				midY := math.Round((stubStart.Y+stubEnd.Y)/2.0) + nudge
				points = append(points, Point{X: stubStart.X, Y: midY})
				points = append(points, Point{X: stubEnd.X, Y: midY})
			} else {
				if sourcePos.Normal.Dx != 0 {
					points = append(points, Point{X: stubEnd.X, Y: stubStart.Y})
				} else {
					points = append(points, Point{X: stubStart.X, Y: stubEnd.Y})
				}
			}
		}

		points = append(points, stubEnd, pEnd)

		cleaned := points
		if BoolVal(options.ArtifactCleaning, true) {
			cleaned = CleanOrthogonalArtifacts(
				points,
				&sourcePos,
				&targetPos,
				nodes,
				options.ObstacleClearance,
				sourceStub,
				targetStub,
			)
		}

		edge.Path = cleaned
		edge.Bends = countBends(cleaned)
		edge.Length = pathLength(cleaned)
		result[edgeIdx] = edge
	}

	return result
}

// RouteLeeWave routes wires using Lee's concentric wave expansion maze router.
func RouteLeeWave(nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) ([]EdgeConnection, []LeeDebugWave) {
	if len(edges) == 0 {
		return append([]EdgeConnection(nil), edges...), nil
	}

	nodeMap := make(map[string]BlockNode, len(nodes))
	for _, n := range nodes {
		nodeMap[n.ID] = n
	}

	gridSize := options.GridSize
	if gridSize < 12 {
		gridSize = 16
	}
	clearance := options.ObstacleClearance
	if clearance <= 0 {
		clearance = 12.0
	}
	baseStub := options.PortExitOffset
	if baseStub <= 0 {
		baseStub = 20.0
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
	minX -= 80
	maxX += 80
	minY -= 80
	maxY += 80

	cols := int(math.Ceil((maxX - minX) / gridSize))
	rows := int(math.Ceil((maxY - minY) / gridSize))

	baseGrid := make([][]int, rows)
	for r := range baseGrid {
		baseGrid[r] = make([]int, cols)
		for c := range baseGrid[r] {
			baseGrid[r][c] = -1 // empty
		}
	}

	for _, node := range nodes {
		nMinC := int(math.Max(0, math.Floor((node.X-clearance-minX)/gridSize)))
		nMaxC := int(math.Min(float64(cols-1), math.Ceil((node.X+node.Width+clearance-minX)/gridSize)))
		nMinR := int(math.Max(0, math.Floor((node.Y-clearance-minY)/gridSize)))
		nMaxR := int(math.Min(float64(rows-1), math.Ceil((node.Y+node.Height+clearance-minY)/gridSize)))

		for r := nMinR; r <= nMaxR; r++ {
			for c := nMinC; c <= nMaxC; c++ {
				baseGrid[r][c] = -2 // Obstacle
			}
		}
	}

	var allDebugCells []LeeDebugWave
	result := make([]EdgeConnection, len(edges))

	dirs := [][2]int{{0, 1}, {0, -1}, {1, 0}, {-1, 0}}

	for edgeIdx, edge := range edges {
		sourceNode, okS := nodeMap[edge.SourceBlockID]
		targetNode, okT := nodeMap[edge.TargetBlockID]
		if !okS || !okT {
			result[edgeIdx] = edge
			continue
		}

		sourcePos := GetPortCoordinates(sourceNode, edge.SourcePortID, true)
		targetPos := GetPortCoordinates(targetNode, edge.TargetPortID, false)

		sourceStub := math.Max(18.0, baseStub)
		targetStub := math.Max(18.0, baseStub)

		startX := sourcePos.X + float64(sourcePos.Normal.Dx)*sourceStub
		startY := sourcePos.Y + float64(sourcePos.Normal.Dy)*sourceStub
		endX := targetPos.X + float64(targetPos.Normal.Dx)*targetStub
		endY := targetPos.Y + float64(targetPos.Normal.Dy)*targetStub

		startC := int(math.Max(0, math.Min(float64(cols-1), math.Round((startX-minX)/gridSize))))
		startR := int(math.Max(0, math.Min(float64(rows-1), math.Round((startY-minY)/gridSize))))
		endC := int(math.Max(0, math.Min(float64(cols-1), math.Round((endX-minX)/gridSize))))
		endR := int(math.Max(0, math.Min(float64(rows-1), math.Round((endY-minY)/gridSize))))

		grid := make([][]int, rows)
		for r := range grid {
			grid[r] = append([]int(nil), baseGrid[r]...)
		}
		grid[startR][startC] = 0
		if grid[endR][endC] == -2 {
			grid[endR][endC] = -1
		}

		type queueItem struct {
			r, c, val int
		}
		queue := []queueItem{{r: startR, c: startC, val: 0}}
		found := false

		for len(queue) > 0 {
			curr := queue[0]
			queue = queue[1:]

			if curr.r == endR && curr.c == endC {
				found = true
				break
			}

			for _, d := range dirs {
				nr, nc := curr.r+d[0], curr.c+d[1]
				if nr >= 0 && nr < rows && nc >= 0 && nc < cols {
					if grid[nr][nc] == -1 {
						grid[nr][nc] = curr.val + 1
						queue = append(queue, queueItem{r: nr, c: nc, val: curr.val + 1})
					}
				}
			}
		}

		var rawPoints []Point
		if found {
			currR, currC := endR, endC
			for !(currR == startR && currC == startC) {
				rawPoints = append([]Point{{
					X: minX + float64(currC)*gridSize,
					Y: minY + float64(currR)*gridSize,
				}}, rawPoints...)

				minVal := grid[currR][currC]
				nextR, nextC := currR, currC

				for _, d := range dirs {
					nr, nc := currR+d[0], currC+d[1]
					if nr >= 0 && nr < rows && nc >= 0 && nc < cols {
						if grid[nr][nc] >= 0 && grid[nr][nc] < minVal {
							minVal = grid[nr][nc]
							nextR, nextC = nr, nc
						}
					}
				}
				if nextR == currR && nextC == currC {
					break
				}
				currR, currC = nextR, nextC
			}
			rawPoints = append([]Point{{
				X: minX + float64(startC)*gridSize,
				Y: minY + float64(startR)*gridSize,
			}}, rawPoints...)
		}

		var fullPath []Point
		if len(rawPoints) > 0 {
			fullPath = append([]Point{
				{X: sourcePos.X, Y: sourcePos.Y},
				{X: startX, Y: startY},
			}, rawPoints...)
			fullPath = append(fullPath, Point{X: endX, Y: endY}, Point{X: targetPos.X, Y: targetPos.Y})
		} else {
			fullPath = []Point{
				{X: sourcePos.X, Y: sourcePos.Y},
				{X: startX, Y: startY},
				{X: startX, Y: endY},
				{X: endX, Y: endY},
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

	return result, allDebugCells
}

// SampleCubicBezier discretizes a cubic Bézier curve between p0 and p3 with control points p1, p2.
func SampleCubicBezier(p0, p1, p2, p3 Point, samples int) []Point {
	if samples < 2 {
		samples = 2
	}
	pts := make([]Point, samples+1)
	for i := 0; i <= samples; i++ {
		t := float64(i) / float64(samples)
		invT := 1.0 - t
		t2 := t * t
		invT2 := invT * invT

		x := invT2*invT*p0.X + 3*invT2*t*p1.X + 3*invT*t2*p2.X + t2*t*p3.X
		y := invT2*invT*p0.Y + 3*invT2*t*p1.Y + 3*invT*t2*p2.Y + t2*t*p3.Y

		pts[i] = Point{X: math.Round(x*100) / 100, Y: math.Round(y*100) / 100}
	}
	return pts
}

// RouteSmoothSplines routes wires using G^1 tangent-continuous cubic Bézier splines.
func RouteSmoothSplines(nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) []EdgeConnection {
	if len(edges) == 0 {
		return append([]EdgeConnection(nil), edges...)
	}

	nodeMap := make(map[string]BlockNode, len(nodes))
	for _, n := range nodes {
		nodeMap[n.ID] = n
	}

	baseStub := options.PortExitOffset
	if baseStub <= 0 {
		baseStub = 24.0
	}
	g1Weight := options.Weights.G1SplineWeight
	if g1Weight <= 0 {
		g1Weight = 65.0
	}

	result := make([]EdgeConnection, len(edges))

	for edgeIdx, edge := range edges {
		sourceNode, okS := nodeMap[edge.SourceBlockID]
		targetNode, okT := nodeMap[edge.TargetBlockID]
		if !okS || !okT {
			result[edgeIdx] = edge
			continue
		}

		sourcePos := GetPortCoordinates(sourceNode, edge.SourcePortID, true)
		targetPos := GetPortCoordinates(targetNode, edge.TargetPortID, false)

		sourceStub := math.Max(18.0, baseStub)
		targetStub := math.Max(18.0, baseStub)

		stubStart := Point{
			X: sourcePos.X + float64(sourcePos.Normal.Dx)*sourceStub,
			Y: sourcePos.Y + float64(sourcePos.Normal.Dy)*sourceStub,
		}
		stubEnd := Point{
			X: targetPos.X + float64(targetPos.Normal.Dx)*targetStub,
			Y: targetPos.Y + float64(targetPos.Normal.Dy)*targetStub,
		}

		if math.Abs(stubStart.Y-stubEnd.Y) < 2 && sourcePos.Normal.Dx == 1 && targetPos.Normal.Dx == -1 {
			path := []Point{
				{X: sourcePos.X, Y: sourcePos.Y},
				{X: targetPos.X, Y: targetPos.Y},
			}
			edge.Path = path
			edge.Bends = 0
			edge.Length = pathLength(path)
			result[edgeIdx] = edge
			continue
		}

		dx := stubEnd.X - stubStart.X
		dy := stubEnd.Y - stubStart.Y

		points := []Point{{X: sourcePos.X, Y: sourcePos.Y}, stubStart}

		if sourcePos.Normal.Dx == 1 && targetPos.Normal.Dx == -1 && dx > 20 {
			midX := stubStart.X + dx*0.5
			handleDist := math.Min(math.Abs(dx)*0.4, (g1Weight/100.0)*80.0+20.0)

			cp1 := Point{X: midX - handleDist*0.5, Y: stubStart.Y}
			cp2 := Point{X: midX + handleDist*0.5, Y: stubEnd.Y}

			curve := SampleCubicBezier(stubStart, cp1, cp2, stubEnd, 16)
			if len(curve) > 2 {
				points = append(points, curve[1:len(curve)-1]...)
			}
		} else {
			dist := math.Hypot(dx, dy)
			handleDist := math.Max(20.0, math.Min(dist*0.35, 100.0)) * (g1Weight / 70.0)

			cp1 := Point{
				X: stubStart.X + float64(sourcePos.Normal.Dx)*handleDist,
				Y: stubStart.Y + float64(sourcePos.Normal.Dy)*handleDist,
			}
			cp2 := Point{
				X: stubEnd.X + float64(targetPos.Normal.Dx)*handleDist,
				Y: stubEnd.Y + float64(targetPos.Normal.Dy)*handleDist,
			}

			curve := SampleCubicBezier(stubStart, cp1, cp2, stubEnd, 16)
			if len(curve) > 2 {
				points = append(points, curve[1:len(curve)-1]...)
			}
		}

		points = append(points, stubEnd, Point{X: targetPos.X, Y: targetPos.Y})

		edge.Path = points
		edge.Bends = countBends(points)
		edge.Length = pathLength(points)
		result[edgeIdx] = edge
	}

	return result
}
