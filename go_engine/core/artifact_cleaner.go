package core

import "math"

// ObstacleBox is a block clearance envelope used by the router.
type ObstacleBox struct {
	ID string
	MinX float64
	MaxX float64
	MinY float64
	MaxY float64
}

// CleanOrthogonalArtifacts removes duplicate and collinear route points and
// preserves orthogonal source/target stubs. This is the first extracted core
// implementation; parity tests guard it against the legacy package.
func CleanOrthogonalArtifacts(raw []Point, source, target *PortCoordinates, nodes []BlockNode, clearance, sourceStub, targetStub float64) []Point {
	if len(raw) < 2 {
		return append([]Point(nil), raw...)
	}
	points := mergeCollinearAndZeroLength(raw)
	if source == nil || target == nil || len(points) < 2 {
		return points
	}
	if sourceStub <= 0 { sourceStub = math.Max(12, clearance+4) }
	if targetStub <= 0 { targetStub = math.Max(12, clearance+4) }
	points[0] = Point{X: source.X, Y: source.Y}
	points[len(points)-1] = Point{X: target.X, Y: target.Y}
	if len(points) == 2 {
		if source.Normal.Dx != 0 && target.Normal.Dx != 0 && almost(source.Y, target.Y) {
			return points
		}
		if source.Normal.Dy != 0 && target.Normal.Dy != 0 && almost(source.X, target.X) {
			return points
		}
	}
	start := Point{X: source.X + float64(source.Normal.Dx)*sourceStub, Y: source.Y + float64(source.Normal.Dy)*sourceStub}
	end := Point{X: target.X + float64(target.Normal.Dx)*targetStub, Y: target.Y + float64(target.Normal.Dy)*targetStub}
	middle := append([]Point{points[0], start}, points[1:len(points)-1]...)
	middle = append(middle, end, points[len(points)-1])
	return mergeCollinearAndZeroLength(middle)
}

func almost(a, b float64) bool { return math.Abs(a-b) < 0.001 }

func mergeCollinearAndZeroLength(points []Point) []Point {
	if len(points) <= 1 { return append([]Point(nil), points...) }
	dedup := make([]Point, 0, len(points))
	for _, point := range points {
		if len(dedup) == 0 || !almost(dedup[len(dedup)-1].X, point.X) || !almost(dedup[len(dedup)-1].Y, point.Y) {
			dedup = append(dedup, point)
		}
	}
	if len(dedup) <= 2 { return dedup }
	result := []Point{dedup[0]}
	for i := 1; i < len(dedup)-1; i++ {
		previous := result[len(result)-1]
		current := dedup[i]
		next := dedup[i+1]
		horizontal := almost(previous.Y, current.Y) && almost(current.Y, next.Y)
		vertical := almost(previous.X, current.X) && almost(current.X, next.X)
		if !horizontal && !vertical { result = append(result, current) }
	}
	return append(result, dedup[len(dedup)-1])
}
