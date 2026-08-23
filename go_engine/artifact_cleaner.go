package main

import "math"

// ObstacleBox represents the bounding box of a block with clearance
type ObstacleBox struct {
	ID   string
	MinX float64
	MaxX float64
	MinY float64
	MaxY float64
}

// CleanOrthogonalArtifacts cleans zig-zags, redundant collinear points, U-turns, and staircases
func CleanOrthogonalArtifacts(
	rawPoints []Point,
	sourcePos *PortCoordinates,
	targetPos *PortCoordinates,
	nodes []BlockNode,
	clearance float64,
	sourceStubLen float64,
	targetStubLen float64,
) []Point {
	if len(rawPoints) <= 1 {
		if sourcePos != nil && targetPos != nil {
			return []Point{{X: sourcePos.X, Y: sourcePos.Y}, {X: targetPos.X, Y: targetPos.Y}}
		}
		return rawPoints
	}

	p0 := rawPoints[0]
	pLast := rawPoints[len(rawPoints)-1]

	sPos := PortCoordinates{
		X:      p0.X,
		Y:      p0.Y,
		Normal: Direction{Dx: 1, Dy: 0},
		Side:   SideRight,
		Port:   Port{ID: "dummy_s", Name: "out", Side: SideRight, Type: "output"},
	}
	if sourcePos != nil {
		sPos = *sourcePos
	}

	tPos := PortCoordinates{
		X:      pLast.X,
		Y:      pLast.Y,
		Normal: Direction{Dx: -1, Dy: 0},
		Side:   SideLeft,
		Port:   Port{ID: "dummy_t", Name: "in", Side: SideLeft, Type: "input"},
	}
	if targetPos != nil {
		tPos = *targetPos
	}

	sStub := sourceStubLen
	if sStub <= 0 {
		sStub = math.Max(12, clearance+4)
	}
	tStub := targetStubLen
	if tStub <= 0 {
		tStub = math.Max(12, clearance+4)
	}

	obstacleBoxes := make([]ObstacleBox, len(nodes))
	for i, n := range nodes {
		obstacleBoxes[i] = ObstacleBox{
			ID:   n.ID,
			MinX: n.X - clearance,
			MaxX: n.X + n.Width + clearance,
			MinY: n.Y - clearance,
			MaxY: n.Y + n.Height + clearance,
		}
	}

	sourceNodeID := ""
	targetNodeID := ""
	for _, n := range nodes {
		for _, p := range n.Inputs {
			if p.ID == sPos.Port.ID {
				sourceNodeID = n.ID
			}
			if p.ID == tPos.Port.ID {
				targetNodeID = n.ID
			}
		}
		for _, p := range n.Outputs {
			if p.ID == sPos.Port.ID {
				sourceNodeID = n.ID
			}
			if p.ID == tPos.Port.ID {
				targetNodeID = n.ID
			}
		}
	}
	var ignoreIDs []string
	if sourceNodeID != "" {
		ignoreIDs = append(ignoreIDs, sourceNodeID)
	}
	if targetNodeID != "" {
		ignoreIDs = append(ignoreIDs, targetNodeID)
	}

	// PASS 0: 0-Bend Direct Facing Ports Check
	if sPos.Normal.Dx == 1 && tPos.Normal.Dx == -1 && math.Abs(sPos.Y-tPos.Y) <= 3 && tPos.X > sPos.X {
		directStart := Point{X: sPos.X, Y: sPos.Y}
		directEnd := Point{X: tPos.X, Y: sPos.Y}
		if !isSegmentBlocked(directStart, directEnd, obstacleBoxes, nodes, ignoreIDs) {
			return []Point{directStart, {X: tPos.X, Y: tPos.Y}}
		}
	}
	if sPos.Normal.Dy == 1 && tPos.Normal.Dy == -1 && math.Abs(sPos.X-tPos.X) <= 3 && tPos.Y > sPos.Y {
		directStart := Point{X: sPos.X, Y: sPos.Y}
		directEnd := Point{X: sPos.X, Y: tPos.Y}
		if !isSegmentBlocked(directStart, directEnd, obstacleBoxes, nodes, ignoreIDs) {
			return []Point{directStart, {X: tPos.X, Y: tPos.Y}}
		}
	}

	// PASS 1: Force normal stubs at both ends
	stubLen := math.Max(16, clearance+6)
	startStub := Point{
		X: sPos.X + float64(sPos.Normal.Dx)*stubLen,
		Y: sPos.Y + float64(sPos.Normal.Dy)*stubLen,
	}
	endStub := Point{
		X: tPos.X + float64(tPos.Normal.Dx)*stubLen,
		Y: tPos.Y + float64(tPos.Normal.Dy)*stubLen,
	}

	points := make([]Point, 0, len(rawPoints)+4)
	points = append(points, Point{X: sPos.X, Y: sPos.Y}, startStub)
	if len(rawPoints) > 2 {
		points = append(points, rawPoints[1:len(rawPoints)-1]...)
	}
	points = append(points, endStub, Point{X: tPos.X, Y: tPos.Y})

	// PASS 2: Redundant Collinear & Zero-Length Merging
	points = mergeCollinearAndZeroLength(points)

	// PASS 3: Eliminate U-turns and short zig-zags
	for pass := 0; pass < 3; pass++ {
		modified := false
		newPts := make([]Point, 0, len(points))
		i := 0
		for i < len(points) {
			if i+3 < len(points) {
				p0 := points[i]
				p1 := points[i+1]
				p2 := points[i+2]
				p3 := points[i+3]

				// Horizontal U-turn check
				if p0.Y == p1.Y && p1.X == p2.X && p2.Y == p3.Y {
					if (p1.X > p0.X && p3.X < p2.X) || (p1.X < p0.X && p3.X > p2.X) {
						bridgeCorner := Point{X: p0.X, Y: p3.Y}
						if !isSegmentBlocked(p0, bridgeCorner, obstacleBoxes, nodes, ignoreIDs) &&
							!isSegmentBlocked(bridgeCorner, p3, obstacleBoxes, nodes, ignoreIDs) {
							newPts = append(newPts, p0, bridgeCorner)
							i += 3
							modified = true
							continue
						}
					}
				}

				// Vertical U-turn check
				if p0.X == p1.X && p1.Y == p2.Y && p2.X == p3.X {
					if (p1.Y > p0.Y && p3.Y < p2.Y) || (p1.Y < p0.Y && p3.Y > p2.Y) {
						bridgeCorner := Point{X: p3.X, Y: p0.Y}
						if !isSegmentBlocked(p0, bridgeCorner, obstacleBoxes, nodes, ignoreIDs) &&
							!isSegmentBlocked(bridgeCorner, p3, obstacleBoxes, nodes, ignoreIDs) {
							newPts = append(newPts, p0, bridgeCorner)
							i += 3
							modified = true
							continue
						}
					}
				}
			}
			newPts = append(newPts, points[i])
			i++
		}
		points = mergeCollinearAndZeroLength(newPts)
		if !modified {
			break
		}
	}

	// PASS 4: Orthogonal Line-of-Sight Shortcut Optimization
	if len(points) > 3 {
		optimized := make([]Point, 0, len(points))
		optimized = append(optimized, points[0])
		curr := 0
		for curr < len(points)-1 {
			furthest := curr + 1
			for next := len(points) - 1; next > curr+1; next-- {
				pA := points[curr]
				pB := points[next]
				// Straight orthogonal line
				if (pA.X == pB.X || pA.Y == pB.Y) && !isSegmentBlocked(pA, pB, obstacleBoxes, nodes, ignoreIDs) {
					furthest = next
					break
				}
				// 1-Bend L-turn
				corner1 := Point{X: pB.X, Y: pA.Y}
				if !isSegmentBlocked(pA, corner1, obstacleBoxes, nodes, ignoreIDs) &&
					!isSegmentBlocked(corner1, pB, obstacleBoxes, nodes, ignoreIDs) {
					optimized = append(optimized, corner1)
					furthest = next
					break
				}
				corner2 := Point{X: pA.X, Y: pB.Y}
				if !isSegmentBlocked(pA, corner2, obstacleBoxes, nodes, ignoreIDs) &&
					!isSegmentBlocked(corner2, pB, obstacleBoxes, nodes, ignoreIDs) {
					optimized = append(optimized, corner2)
					furthest = next
					break
				}
			}
			optimized = append(optimized, points[furthest])
			curr = furthest
		}
		points = mergeCollinearAndZeroLength(optimized)
	}

	// PASS 5: Guarantee strict 90-degree port normals
	if len(points) >= 2 {
		if sPos.Normal.Dx != 0 {
			points[1].Y = sPos.Y
			if sPos.Normal.Dx > 0 && points[1].X < sPos.X+8 {
				points[1].X = sPos.X + sStub
			} else if sPos.Normal.Dx < 0 && points[1].X > sPos.X-8 {
				points[1].X = sPos.X - sStub
			}
		} else if sPos.Normal.Dy != 0 {
			points[1].X = sPos.X
			if sPos.Normal.Dy > 0 && points[1].Y < sPos.Y+8 {
				points[1].Y = sPos.Y + sStub
			} else if sPos.Normal.Dy < 0 && points[1].Y > sPos.Y-8 {
				points[1].Y = sPos.Y - sStub
			}
		}
	}

	if len(points) >= 2 {
		lastIdx := len(points) - 1
		if tPos.Normal.Dx != 0 {
			points[lastIdx-1].Y = tPos.Y
			if tPos.Normal.Dx > 0 && points[lastIdx-1].X < tPos.X+8 {
				points[lastIdx-1].X = tPos.X + tStub
			} else if tPos.Normal.Dx < 0 && points[lastIdx-1].X > tPos.X-8 {
				points[lastIdx-1].X = tPos.X - tStub
			}
		} else if tPos.Normal.Dy != 0 {
			points[lastIdx-1].X = tPos.X
			if tPos.Normal.Dy > 0 && points[lastIdx-1].Y < tPos.Y+8 {
				points[lastIdx-1].Y = tPos.Y + tStub
			} else if tPos.Normal.Dy < 0 && points[lastIdx-1].Y > tPos.Y-8 {
				points[lastIdx-1].Y = tPos.Y - tStub
			}
		}
	}

	return mergeCollinearAndZeroLength(points)
}

func mergeCollinearAndZeroLength(pts []Point) []Point {
	if len(pts) <= 1 {
		return pts
	}
	// Deduplicate identical adjacent points
	dedup := make([]Point, 0, len(pts))
	for _, p := range pts {
		if len(dedup) == 0 {
			dedup = append(dedup, p)
		} else {
			last := dedup[len(dedup)-1]
			if math.Abs(last.X-p.X) > 0.001 || math.Abs(last.Y-p.Y) > 0.001 {
				dedup = append(dedup, p)
			}
		}
	}
	if len(dedup) <= 2 {
		return dedup
	}

	res := make([]Point, 0, len(dedup))
	res = append(res, dedup[0])

	for i := 1; i < len(dedup)-1; i++ {
		prev := res[len(res)-1]
		curr := dedup[i]
		next := dedup[i+1]

		isHoriz := math.Abs(prev.Y-curr.Y) < 0.001 && math.Abs(curr.Y-next.Y) < 0.001
		isVert := math.Abs(prev.X-curr.X) < 0.001 && math.Abs(curr.X-next.X) < 0.001

		if !isHoriz && !isVert {
			res = append(res, curr)
		}
	}
	res = append(res, dedup[len(dedup)-1])
	return res
}

func isSegmentBlocked(p1, p2 Point, boxes []ObstacleBox, nodes []BlockNode, ignoreIDs []string) bool {
	minX := math.Min(p1.X, p2.X)
	maxX := math.Max(p1.X, p2.X)
	minY := math.Min(p1.Y, p2.Y)
	maxY := math.Max(p1.Y, p2.Y)

	for _, box := range boxes {
		ignored := false
		for _, id := range ignoreIDs {
			if box.ID == id {
				ignored = true
				break
			}
		}
		if ignored {
			continue
		}

		if maxX > box.MinX && minX < box.MaxX && maxY > box.MinY && minY < box.MaxY {
			return true
		}
	}
	return false
}
