package main

import (
	"math"
)

type CollinearOverlapResult struct {
	TotalOverlapLength float64
	OverlapCount       int
}

// DetectCollinearOverlaps detects shared line segments between different wires (rule/2.md §46; rule/3.md §35)
func DetectCollinearOverlaps(edges []EdgeConnection) CollinearOverlapResult {
	totalLen := 0.0
	count := 0

	type Segment struct {
		EdgeID string
		P1     Point
		P2     Point
	}

	var segments []Segment
	for _, e := range edges {
		for i := 0; i < len(e.Path)-1; i++ {
			p1 := e.Path[i]
			p2 := e.Path[i+1]
			// normalize orientation
			if p1.X > p2.X || (math.Abs(p1.X-p2.X) < 0.001 && p1.Y > p2.Y) {
				p1, p2 = p2, p1
			}
			segments = append(segments, Segment{
				EdgeID: e.ID,
				P1:     p1,
				P2:     p2,
			})
		}
	}

	for i := 0; i < len(segments); i++ {
		for j := i + 1; j < len(segments); j++ {
			s1 := segments[i]
			s2 := segments[j]
			if s1.EdgeID == s2.EdgeID {
				continue
			}

			s1Horiz := math.Abs(s1.P1.Y-s1.P2.Y) < 0.001
			s2Horiz := math.Abs(s2.P1.Y-s2.P2.Y) < 0.001

			// Both horizontal
			if s1Horiz && s2Horiz && math.Abs(s1.P1.Y-s2.P1.Y) < 1.0 {
				overlapStart := math.Max(s1.P1.X, s2.P1.X)
				overlapEnd := math.Min(s1.P2.X, s2.P2.X)
				if overlapEnd > overlapStart+1.0 {
					totalLen += overlapEnd - overlapStart
					count++
				}
			}

			// Both vertical
			s1Vert := math.Abs(s1.P1.X-s1.P2.X) < 0.001
			s2Vert := math.Abs(s2.P1.X-s2.P2.X) < 0.001

			if s1Vert && s2Vert && math.Abs(s1.P1.X-s2.P1.X) < 1.0 {
				overlapStart := math.Max(s1.P1.Y, s2.P1.Y)
				overlapEnd := math.Min(s1.P2.Y, s2.P2.Y)
				if overlapEnd > overlapStart+1.0 {
					totalLen += overlapEnd - overlapStart
					count++
				}
			}
		}
	}

	return CollinearOverlapResult{
		TotalOverlapLength: totalLen,
		OverlapCount:       count,
	}
}

// CalculateBenchmarkMetrics computes benchmark metrics and QualityVector
func CalculateBenchmarkMetrics(
	nodes []BlockNode,
	edges []EdgeConnection,
	durationMs float64,
	layoutAlgo string,
	routingAlgo string,
) BenchmarkMetrics {
	totalWirelength := 0.0
	totalBends := 0
	straightCount := 0

	for _, e := range edges {
		if len(e.Path) == 2 {
			straightCount++
		}
		for i := 0; i < len(e.Path)-1; i++ {
			p1 := e.Path[i]
			p2 := e.Path[i+1]
			totalWirelength += math.Hypot(p2.X-p1.X, p2.Y-p1.Y)
			if i > 0 {
				p0 := e.Path[i-1]
				dir1X := p1.X - p0.X
				dir1Y := p1.Y - p0.Y
				dir2X := p2.X - p1.X
				dir2Y := p2.Y - p1.Y
				if (dir1X != 0 && dir2Y != 0) || (dir1Y != 0 && dir2X != 0) {
					totalBends++
				}
			}
		}
	}

	// Calculate crossings
	crossings := 0
	type LineSeg struct {
		EdgeID string
		P1, P2 Point
	}
	var segs []LineSeg
	for _, e := range edges {
		for i := 0; i < len(e.Path)-1; i++ {
			segs = append(segs, LineSeg{EdgeID: e.ID, P1: e.Path[i], P2: e.Path[i+1]})
		}
	}

	for i := 0; i < len(segs); i++ {
		for j := i + 1; j < len(segs); j++ {
			s1 := segs[i]
			s2 := segs[j]
			if s1.EdgeID == s2.EdgeID {
				continue
			}
			// One horizontal, one vertical
			s1Horiz := math.Abs(s1.P1.Y-s1.P2.Y) < 0.001
			s2Vert := math.Abs(s2.P1.X-s2.P2.X) < 0.001
			s1Vert := math.Abs(s1.P1.X-s1.P2.X) < 0.001
			s2Horiz := math.Abs(s2.P1.Y-s2.P2.Y) < 0.001

			if s1Horiz && s2Vert {
				hMinX := math.Min(s1.P1.X, s1.P2.X)
				hMaxX := math.Max(s1.P1.X, s1.P2.X)
				vMinY := math.Min(s2.P1.Y, s2.P2.Y)
				vMaxY := math.Max(s2.P1.Y, s2.P2.Y)
				hY := s1.P1.Y
				vX := s2.P1.X
				if vX > hMinX+2 && vX < hMaxX-2 && hY > vMinY+2 && hY < vMaxY-2 {
					crossings++
				}
			} else if s1Vert && s2Horiz {
				hMinX := math.Min(s2.P1.X, s2.P2.X)
				hMaxX := math.Max(s2.P1.X, s2.P2.X)
				vMinY := math.Min(s1.P1.Y, s1.P2.Y)
				vMaxY := math.Max(s1.P1.Y, s1.P2.Y)
				hY := s2.P1.Y
				vX := s1.P1.X
				if vX > hMinX+2 && vX < hMaxX-2 && hY > vMinY+2 && hY < vMaxY-2 {
					crossings++
				}
			}
		}
	}

	collinearRes := DetectCollinearOverlaps(edges)
	labelsMap := ComputeOptimizedLabels(nodes, edges, nil, 6.0)

	onArrowCount := 0
	collisionCount := 0
	for _, l := range labelsMap {
		if l.IsOnArrow {
			onArrowCount++
		}
		if !l.IsCollisionFree {
			collisionCount++
		}
	}

	labelRatio := 1.0
	if len(edges) > 0 {
		labelRatio = float64(onArrowCount) / float64(len(edges))
	}

	// Compactness & Area
	minX := math.Inf(1)
	maxX := math.Inf(-1)
	minY := math.Inf(1)
	maxY := math.Inf(-1)
	totalBlockArea := 0.0

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
		totalBlockArea += n.Width * n.Height
	}

	if math.IsInf(minX, 0) {
		minX = 0
		maxX = 500
		minY = 0
		maxY = 300
		totalBlockArea = 100000
	}

	dWidth := math.Max(10, maxX-minX)
	dHeight := math.Max(10, maxY-minY)
	dArea := dWidth * dHeight
	areaRatio := 1.0
	if totalBlockArea > 0 {
		areaRatio = dArea / totalBlockArea
	}

	hardViolations := collinearRes.OverlapCount + collisionCount

	// Composite Pareto score (0% to 100%) (rule/3.md §52, §96)
	normWire := totalWirelength / math.Max(1.0, float64(len(edges)*200))
	score := 100.0 - (float64(totalBends)*4.0 + float64(crossings)*8.0 + collinearRes.TotalOverlapLength*0.1 + (1.0-labelRatio)*40.0 + (normWire-1.0)*5.0 + float64(hardViolations)*50.0)
	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}

	qualityVector := QualityVector{
		HardViolations:          hardViolations,
		Crossings:               crossings,
		CollinearOverlapCount:   collinearRes.OverlapCount,
		CollinearOverlapLength:  collinearRes.TotalOverlapLength,
		CongestionOverflow:      0,
		Bends:                   totalBends,
		StraightWiresCount:      straightCount,
		StraightEdgeRatio:       float64(straightCount) / math.Max(1.0, float64(len(edges))),
		PortAlignmentScore:      100.0,
		AreaRatio:               math.Round(areaRatio*100) / 100,
		NormalizedWirelength:    math.Round(normWire*100) / 100,
		LabelCollisions:         collisionCount,
		LabelsOnArrowPercentage: math.Round(labelRatio * 100),
		CompositeScore:          math.Round(score*10) / 10,
	}

	return BenchmarkMetrics{
		TotalWirelength:        math.Round(totalWirelength*10) / 10,
		BendCount:              totalBends,
		CrossingsCount:         crossings,
		CollinearOverlapCount:  collinearRes.OverlapCount,
		CollinearOverlapLength: collinearRes.TotalOverlapLength,
		LabelsOnArrowCount:     onArrowCount,
		TotalLabelsCount:       len(edges),
		LabelsOnArrowRatio:     labelRatio,
		LabelCollisionCount:    collisionCount,
		ExecutionTimeMs:        math.Round(durationMs*100) / 100,
		CompositeScore:         math.Round(score*10) / 10,
		LayoutAlgorithm:        layoutAlgo,
		RoutingAlgorithm:       routingAlgo,
		QualityVector:          qualityVector,
	}
}
