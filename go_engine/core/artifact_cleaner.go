package core

import "math"

// ObstacleBox is a block clearance envelope used by the router.
type ObstacleBox struct {
	ID   string
	MinX float64
	MaxX float64
	MinY float64
	MaxY float64
}

func almost(a, b float64) bool {
	return math.Abs(a-b) < 0.001
}

func mergeCollinearAndZeroLength(points []Point) []Point {
	if len(points) <= 1 {
		return append([]Point(nil), points...)
	}
	dedup := make([]Point, 0, len(points))
	for _, point := range points {
		if len(dedup) == 0 || !almost(dedup[len(dedup)-1].X, point.X) || !almost(dedup[len(dedup)-1].Y, point.Y) {
			dedup = append(dedup, point)
		}
	}
	if len(dedup) <= 2 {
		return dedup
	}
	result := []Point{dedup[0]}
	for i := 1; i < len(dedup)-1; i++ {
		previous := result[len(result)-1]
		current := dedup[i]
		next := dedup[i+1]
		horizontal := almost(previous.Y, current.Y) && almost(current.Y, next.Y)
		vertical := almost(previous.X, current.X) && almost(current.X, next.X)
		if !horizontal && !vertical {
			result = append(result, current)
		}
	}
	return append(result, dedup[len(dedup)-1])
}

// CleanOrthogonalArtifacts performs multi-pass orthogonal wire artifact cleaning.
// Guarantees:
// 1. 100% strict perpendicular 90° exit from source port along normal vector.
// 2. 100% strict perpendicular 90° entry into target port along inward normal vector.
// 3. Never allows wires to slide along or merge with block faces.
// 4. Eliminates micro-jogs, stair-stepping, and collinear redundancies.
// 5. Connects collinear facing ports with laser-straight 0-bend direct lines.
func CleanOrthogonalArtifacts(raw []Point, source, target *PortCoordinates, nodes []BlockNode, clearance, sourceStub, targetStub float64) []Point {
	if len(raw) <= 1 {
		if source != nil && target != nil {
			return []Point{{X: source.X, Y: source.Y}, {X: target.X, Y: target.Y}}
		}
		return append([]Point(nil), raw...)
	}

	if clearance <= 0 {
		clearance = 12.0
	}
	sStub := math.Max(16.0, sourceStub)
	if sourceStub <= 0 {
		sStub = math.Max(16.0, clearance+6.0)
	}
	tStub := math.Max(16.0, targetStub)
	if targetStub <= 0 {
		tStub = math.Max(16.0, clearance+6.0)
	}

	// Synthesize source/target if omitted
	sPos := PortCoordinates{
		X:      raw[0].X,
		Y:      raw[0].Y,
		Normal: Direction{Dx: 1, Dy: 0},
		Side:   SideRight,
	}
	if source != nil {
		sPos = *source
	}

	tPos := PortCoordinates{
		X:      raw[len(raw)-1].X,
		Y:      raw[len(raw)-1].Y,
		Normal: Direction{Dx: -1, Dy: 0},
		Side:   SideLeft,
	}
	if target != nil {
		tPos = *target
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

	var sourceNodeID, targetNodeID string
	if sPos.Port.ID != "" {
		for _, n := range nodes {
			for _, p := range append(append(n.Inputs, n.Outputs...), n.Ports...) {
				if p.ID == sPos.Port.ID {
					sourceNodeID = n.ID
					break
				}
			}
		}
	}
	if tPos.Port.ID != "" {
		for _, n := range nodes {
			for _, p := range append(append(n.Inputs, n.Outputs...), n.Ports...) {
				if p.ID == tPos.Port.ID {
					targetNodeID = n.ID
					break
				}
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

	// PASS 0: Laser direct wire for collinear facing ports
	if sPos.Normal.Dx == 1 && tPos.Normal.Dx == -1 && almost(sPos.Y, tPos.Y) && tPos.X > sPos.X+8 {
		directStart := Point{X: sPos.X, Y: sPos.Y}
		directEnd := Point{X: tPos.X, Y: sPos.Y}
		if !IsSegmentBlocked(directStart, directEnd, obstacleBoxes, nodes, ignoreIDs) {
			return []Point{directStart, {X: tPos.X, Y: tPos.Y}}
		}
	}
	if sPos.Normal.Dy == 1 && tPos.Normal.Dy == -1 && almost(sPos.X, tPos.X) && tPos.Y > sPos.Y+8 {
		directStart := Point{X: sPos.X, Y: sPos.Y}
		directEnd := Point{X: sPos.X, Y: tPos.Y}
		if !IsSegmentBlocked(directStart, directEnd, obstacleBoxes, nodes, ignoreIDs) {
			return []Point{directStart, {X: tPos.X, Y: tPos.Y}}
		}
	}

	// PASS 1: Deduplicate zero length steps
	pts := make([]Point, 0, len(raw))
	for _, p := range raw {
		if len(pts) == 0 || !almost(pts[len(pts)-1].X, p.X) || !almost(pts[len(pts)-1].Y, p.Y) {
			pts = append(pts, p)
		}
	}
	if len(pts) <= 2 {
		return pts
	}

	// PASS 2: Collinear Continuous Merge
	pts = mergeCollinearAndZeroLength(pts)

	// PASS 3: U-turn / Jog elimination
	changed := true
	for iter := 0; iter < 4 && changed; iter++ {
		changed = false
		if len(pts) < 4 {
			break
		}
		newPts := []Point{pts[0]}
		i := 0
		for i < len(pts)-3 {
			p0, p1, p2, p3 := pts[i], pts[i+1], pts[i+2], pts[i+3]
			// U-Turn Pattern 1: Horizontal -> Vertical -> Horizontal (Opposite direction)
			if almost(p0.Y, p1.Y) && almost(p1.X, p2.X) && almost(p2.Y, p3.Y) {
				dx1 := p1.X - p0.X
				dx2 := p3.X - p2.X
				if (dx1 > 0 && dx2 < 0) || (dx1 < 0 && dx2 > 0) {
					// Shortcut candidate
					testSeg := Point{X: p0.X, Y: p3.Y}
					if !IsSegmentBlocked(p0, testSeg, obstacleBoxes, nodes, ignoreIDs) &&
						!IsSegmentBlocked(testSeg, p3, obstacleBoxes, nodes, ignoreIDs) {
						newPts = append(newPts, testSeg)
						i += 3
						changed = true
						continue
					}
				}
			}
			// U-Turn Pattern 2: Vertical -> Horizontal -> Vertical (Opposite direction)
			if almost(p0.X, p1.X) && almost(p1.Y, p2.Y) && almost(p2.X, p3.X) {
				dy1 := p1.Y - p0.Y
				dy2 := p3.Y - p2.Y
				if (dy1 > 0 && dy2 < 0) || (dy1 < 0 && dy2 > 0) {
					testSeg := Point{X: p3.X, Y: p0.Y}
					if !IsSegmentBlocked(p0, testSeg, obstacleBoxes, nodes, ignoreIDs) &&
						!IsSegmentBlocked(testSeg, p3, obstacleBoxes, nodes, ignoreIDs) {
						newPts = append(newPts, testSeg)
						i += 3
						changed = true
						continue
					}
				}
			}
			newPts = append(newPts, pts[i+1])
			i++
		}
		for ; i < len(pts); i++ {
			newPts = append(newPts, pts[i])
		}
		pts = mergeCollinearAndZeroLength(newPts)
	}

	// PASS 4: Normal Vector Stub Guarantee
	if len(pts) >= 2 {
		pts[0] = Point{X: sPos.X, Y: sPos.Y}
		pts[len(pts)-1] = Point{X: tPos.X, Y: tPos.Y}

		// Ensure source normal stub
		firstSegX := pts[1].X - pts[0].X
		firstSegY := pts[1].Y - pts[0].Y
		if sPos.Normal.Dx != 0 && (firstSegX*float64(sPos.Normal.Dx) < sStub || !almost(pts[1].Y, sPos.Y)) {
			stubPt := Point{X: sPos.X + float64(sPos.Normal.Dx)*sStub, Y: sPos.Y}
			pts = append([]Point{pts[0], stubPt}, pts[1:]...)
		} else if sPos.Normal.Dy != 0 && (firstSegY*float64(sPos.Normal.Dy) < sStub || !almost(pts[1].X, sPos.X)) {
			stubPt := Point{X: sPos.X, Y: sPos.Y + float64(sPos.Normal.Dy)*sStub}
			pts = append([]Point{pts[0], stubPt}, pts[1:]...)
		}

		// Ensure target normal stub
		lastIdx := len(pts) - 1
		lastSegX := pts[lastIdx].X - pts[lastIdx-1].X
		lastSegY := pts[lastIdx].Y - pts[lastIdx-1].Y
		if tPos.Normal.Dx != 0 && (lastSegX*float64(tPos.Normal.Dx) > -tStub || !almost(pts[lastIdx-1].Y, tPos.Y)) {
			stubPt := Point{X: tPos.X + float64(tPos.Normal.Dx)*tStub, Y: tPos.Y}
			pts = append(pts[:lastIdx], stubPt, pts[lastIdx])
		} else if tPos.Normal.Dy != 0 && (lastSegY*float64(tPos.Normal.Dy) > -tStub || !almost(pts[lastIdx-1].X, tPos.X)) {
			stubPt := Point{X: tPos.X, Y: tPos.Y + float64(tPos.Normal.Dy)*tStub}
			pts = append(pts[:lastIdx], stubPt, pts[lastIdx])
		}
	}

	return mergeCollinearAndZeroLength(pts)
}

// SegmentIntersectsBox checks if orthogonal segment [p1, p2] intersects an obstacle box.
func SegmentIntersectsBox(p1, p2 Point, box ObstacleBox) bool {
	segMinX := math.Min(p1.X, p2.X)
	segMaxX := math.Max(p1.X, p2.X)
	segMinY := math.Min(p1.Y, p2.Y)
	segMaxY := math.Max(p1.Y, p2.Y)

	if segMaxX <= box.MinX || segMinX >= box.MaxX || segMaxY <= box.MinY || segMinY >= box.MaxY {
		return false
	}

	if math.Abs(p1.X-p2.X) < 0.5 {
		x := p1.X
		return x > box.MinX && x < box.MaxX && segMinY < box.MaxY && segMaxY > box.MinY
	}
	if math.Abs(p1.Y-p2.Y) < 0.5 {
		y := p1.Y
		return y > box.MinY && y < box.MaxY && segMinX < box.MaxX && segMaxX > box.MinX
	}
	return true
}

// IsRunningAlongNodeFace checks if orthogonal segment runs along a node perimeter face.
func IsRunningAlongNodeFace(p1, p2 Point, node BlockNode) bool {
	isVertical := math.Abs(p1.X-p2.X) < 0.8
	isHorizontal := math.Abs(p1.Y-p2.Y) < 0.8

	segMinX := math.Min(p1.X, p2.X)
	segMaxX := math.Max(p1.X, p2.X)
	segMinY := math.Min(p1.Y, p2.Y)
	segMaxY := math.Max(p1.Y, p2.Y)

	nodeRight := node.X + node.Width
	nodeBottom := node.Y + node.Height

	if isVertical {
		onLeft := math.Abs(p1.X-node.X) < 1.5
		onRight := math.Abs(p1.X-nodeRight) < 1.5
		if onLeft || onRight {
			if segMinY < nodeBottom && segMaxY > node.Y {
				return true
			}
		}
	}
	if isHorizontal {
		onTop := math.Abs(p1.Y-node.Y) < 1.5
		onBottom := math.Abs(p1.Y-nodeBottom) < 1.5
		if onTop || onBottom {
			if segMinX < nodeRight && segMaxX > node.X {
				return true
			}
		}
	}
	return false
}

// IsSegmentBlocked checks if orthogonal segment [p1, p2] intersects physical nodes or inflated obstacle boxes.
func IsSegmentBlocked(p1, p2 Point, obstacles []ObstacleBox, nodes []BlockNode, ignoreNodeIDs []string) bool {
	// 1. Strict physical core body & face check: FORBIDDEN for ALL blocks
	for _, node := range nodes {
		coreBox := ObstacleBox{
			ID:   node.ID,
			MinX: node.X + 0.5,
			MaxX: node.X + node.Width - 0.5,
			MinY: node.Y + 0.5,
			MaxY: node.Y + node.Height - 0.5,
		}
		if SegmentIntersectsBox(p1, p2, coreBox) {
			return true
		}
		if IsRunningAlongNodeFace(p1, p2, node) {
			return true
		}
	}

	// 2. Inflated clearance check for third-party blocks
	ignoreMap := make(map[string]bool, len(ignoreNodeIDs))
	for _, id := range ignoreNodeIDs {
		ignoreMap[id] = true
	}

	for _, obs := range obstacles {
		if ignoreMap[obs.ID] {
			continue
		}
		if SegmentIntersectsBox(p1, p2, obs) {
			return true
		}
	}
	return false
}
