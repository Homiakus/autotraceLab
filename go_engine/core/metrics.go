package core

import "math"

// CollinearOverlapResult holds collinear overlap metrics.
type CollinearOverlapResult struct {
	TotalOverlapLength float64
	OverlapCount       int
}

// DetectCollinearOverlaps detects coinciding parallel wire segments.
func DetectCollinearOverlaps(edges []EdgeConnection) CollinearOverlapResult {
	type hSeg struct {
		minX, maxX, y float64
		edgeID        string
	}
	type vSeg struct {
		minY, maxY, x float64
		edgeID        string
	}

	hBuckets := make(map[int][]hSeg)
	vBuckets := make(map[int][]vSeg)

	for _, edge := range edges {
		pts := edge.Path
		if len(pts) < 2 {
			continue
		}
		for i := 0; i+1 < len(pts); i++ {
			p1, p2 := pts[i], pts[i+1]
			if math.Abs(p1.Y-p2.Y) < 1.5 {
				keyY := int(math.Round(p1.Y))
				hBuckets[keyY] = append(hBuckets[keyY], hSeg{
					minX:   math.Min(p1.X, p2.X),
					maxX:   math.Max(p1.X, p2.X),
					y:      p1.Y,
					edgeID: edge.ID,
				})
			} else if math.Abs(p1.X-p2.X) < 1.5 {
				keyX := int(math.Round(p1.X))
				vBuckets[keyX] = append(vBuckets[keyX], vSeg{
					minY:   math.Min(p1.Y, p2.Y),
					maxY:   math.Max(p1.Y, p2.Y),
					x:      p1.X,
					edgeID: edge.ID,
				})
			}
		}
	}

	totalOverlapLength := 0.0
	overlapCount := 0

	for _, segs := range hBuckets {
		if len(segs) < 2 {
			continue
		}
		for i := 0; i < len(segs); i++ {
			s1 := segs[i]
			for j := i + 1; j < len(segs); j++ {
				s2 := segs[j]
				if s1.edgeID == s2.edgeID {
					continue
				}
				if math.Abs(s1.y-s2.y) < 1.5 {
					overlapMin := math.Max(s1.minX, s2.minX)
					overlapMax := math.Min(s1.maxX, s2.maxX)
					overlapLen := overlapMax - overlapMin
					if overlapLen > 2.0 {
						totalOverlapLength += overlapLen
						overlapCount++
					}
				}
			}
		}
	}

	for _, segs := range vBuckets {
		if len(segs) < 2 {
			continue
		}
		for i := 0; i < len(segs); i++ {
			s1 := segs[i]
			for j := i + 1; j < len(segs); j++ {
				s2 := segs[j]
				if s1.edgeID == s2.edgeID {
					continue
				}
				if math.Abs(s1.x-s2.x) < 1.5 {
					overlapMin := math.Max(s1.minY, s2.minY)
					overlapMax := math.Min(s1.maxY, s2.maxY)
					overlapLen := overlapMax - overlapMin
					if overlapLen > 2.0 {
						totalOverlapLength += overlapLen
						overlapCount++
					}
				}
			}
		}
	}

	return CollinearOverlapResult{
		TotalOverlapLength: totalOverlapLength,
		OverlapCount:       overlapCount,
	}
}

// CalculateDetailedMetrics computes the full canonical 9-component QualityVector and BenchmarkMetrics.
func CalculateDetailedMetrics(
	nodes []BlockNode,
	edges []EdgeConnection,
	layoutName, routingName string,
	execTimeMs float64,
	options *RoutingOptions,
) BenchmarkMetrics {
	nodeMap := make(map[string]BlockNode, len(nodes))
	for _, n := range nodes {
		nodeMap[n.ID] = n
	}

	// 1. Block-to-block overlaps
	blockOverlapCount := 0
	for i := 0; i < len(nodes); i++ {
		for j := i + 1; j < len(nodes); j++ {
			u, v := nodes[i], nodes[j]
			if !(u.X+u.Width <= v.X || v.X+v.Width <= u.X || u.Y+u.Height <= v.Y || v.Y+v.Height <= u.Y) {
				blockOverlapCount++
			}
		}
	}

	// 2. Wire length, bends, crossings, straight edges
	totalWirelength := 0.0
	bendCount := 0
	straightWiresCount := 0
	minTheoreticalWirelength := 0.0
	cleanPortExits := 0
	portMisalignmentSum := 0.0

	for _, e := range edges {
		pts := e.Path
		if len(pts) >= 2 {
			l := pathLength(pts)
			totalWirelength += l
			b := countBends(pts)
			bendCount += b
			if b == 0 {
				straightWiresCount++
			}

			sNode, okS := nodeMap[e.SourceBlockID]
			tNode, okT := nodeMap[e.TargetBlockID]
			if okS && okT {
				sPos := GetPortCoordinates(sNode, e.SourcePortID, true)
				tPos := GetPortCoordinates(tNode, e.TargetPortID, false)
				minTheoreticalWirelength += math.Abs(tPos.X-sPos.X) + math.Abs(tPos.Y-sPos.Y)

				if sPos.Side == SideRight && tPos.Side == SideLeft {
					portMisalignmentSum += math.Abs(sPos.Y - tPos.Y)
				} else if sPos.Side == SideBottom && tPos.Side == SideTop {
					portMisalignmentSum += math.Abs(sPos.X - tPos.X)
				}
			}

			startDx := pts[1].X - pts[0].X
			startDy := pts[1].Y - pts[0].Y
			if (math.Abs(startDx) > 0 && math.Abs(startDy) < 1) || (math.Abs(startDy) > 0 && math.Abs(startDx) < 1) {
				cleanPortExits++
			}
		}
	}

	crossingsCount := countCrossings(edges)
	portAlignmentScore := 100
	if len(edges) > 0 {
		portAlignmentScore = int(math.Round(float64(cleanPortExits) / float64(len(edges)) * 100.0))
	}
	straightRatio := 1.0
	if len(edges) > 0 {
		straightRatio = float64(straightWiresCount) / float64(len(edges))
	}

	// 3. Collinear Overlaps & Labels
	collinearRes := DetectCollinearOverlaps(edges)
	totalOverlapLength := collinearRes.TotalOverlapLength
	collinearOverlapCount := collinearRes.OverlapCount

	labelClearance := 8.0
	if options != nil && options.ObstacleClearance > 0 {
		labelClearance = options.ObstacleClearance
	}
	labelMap := ComputeOptimizedLabels(nodes, edges, nil, labelClearance)

	totalLabels := 0
	labelsOnArrow := 0
	labelCollisions := 0

	for _, e := range edges {
		if e.Label != "" {
			totalLabels++
			if pos, ok := labelMap[e.ID]; ok {
				if pos.IsOnArrow {
					labelsOnArrow++
				}
				if !pos.IsCollisionFree {
					labelCollisions++
				}
			}
		}
	}

	labelsOnArrowPercentage := 100
	if totalLabels > 0 {
		labelsOnArrowPercentage = int(math.Round(float64(labelsOnArrow) / float64(totalLabels) * 100.0))
	}

	// 4. Area & Density
	minX := 1e9
	maxX := -1e9
	minY := 1e9
	maxY := -1e9
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
	if minX == 1e9 {
		minX, maxX, minY, maxY = 0, 500, 0, 300
		totalBlockArea = 100000.0
	}

	diagramWidth := math.Max(10.0, maxX-minX)
	diagramHeight := math.Max(10.0, maxY-minY)
	diagramArea := diagramWidth * diagramHeight

	areaRatio := 1.0
	if totalBlockArea > 0 {
		areaRatio = diagramArea / totalBlockArea
	}
	actualDensity := 0.5
	if diagramArea > 0 {
		actualDensity = totalBlockArea / diagramArea
	}

	graphDensity := 1.0
	if len(nodes) > 0 {
		graphDensity = float64(len(edges)) / float64(len(nodes))
	}
	targetDensity := math.Max(0.3, math.Min(0.65, 0.65-0.06*graphDensity))
	densityDeviation := math.Abs(actualDensity - targetDensity)
	voidRatio := math.Max(0.0, (diagramArea-totalBlockArea)/diagramArea)

	targetAspect := 1.8
	actualAspect := diagramWidth / diagramHeight
	aspectPenalty := math.Abs(math.Log(actualAspect / targetAspect))

	normalizedWirelength := 0.0
	if minTheoreticalWirelength > 0 {
		normalizedWirelength = math.Max(0.0, (totalWirelength/minTheoreticalWirelength)-1.0)
	}

	hardViolations := blockOverlapCount + collinearOverlapCount + labelCollisions

	// 5. Composite Pareto Score
	weights := DefaultOptimizationWeights()
	if options != nil && (options.Weights.CrossingWeight > 0 || options.Weights.StraightnessWeight > 0) {
		weights = options.Weights
	}

	offArrowPenalty := float64(totalLabels-labelsOnArrow) * 40.0
	collinearPenalty := totalOverlapLength*2.0 + float64(collinearOverlapCount)*25.0
	hardViolationPenalty := float64(hardViolations) * 100.0

	penalties := (weights.CrossingWeight/100.0)*(float64(crossingsCount)*20.0) +
		(weights.ClearanceWeight/100.0)*(float64(blockOverlapCount)*30.0) +
		(weights.StraightnessWeight/100.0)*((1.0-straightRatio)*20.0) +
		(weights.BendWeight/100.0)*(float64(bendCount)*1.5) +
		(weights.WirelengthWeight/100.0)*(normalizedWirelength*15.0) +
		offArrowPenalty +
		collinearPenalty +
		hardViolationPenalty

	compositeScore := math.Max(5.0, math.Min(100.0, math.Round(100.0-penalties)))

	qualityVector := QualityVector{
		HardViolations:          hardViolations,
		Crossings:               crossingsCount,
		CollinearOverlapCount:   collinearOverlapCount,
		CollinearOverlapLength:  totalOverlapLength,
		CongestionOverflow:      0,
		Bends:                   bendCount,
		StraightWiresCount:      straightWiresCount,
		StraightEdgeRatio:       straightRatio,
		PortMisalignmentScore:   math.Round(portMisalignmentSum),
		PortAlignmentScore:      float64(portAlignmentScore),
		AreaRatio:               math.Round(areaRatio*100.0) / 100.0,
		DensityDeviation:        math.Round(densityDeviation*100.0) / 100.0,
		VoidRatio:               math.Round(voidRatio*100.0) / 100.0,
		AspectPenalty:           math.Round(aspectPenalty*100.0) / 100.0,
		NormalizedWirelength:    math.Round(normalizedWirelength*100.0) / 100.0,
		LabelCollisions:         labelCollisions,
		LabelsOnArrowPercentage: float64(labelsOnArrowPercentage),
		CompositeScore:          compositeScore,
	}

	labelRatio := 1.0
	if totalLabels > 0 {
		labelRatio = float64(labelsOnArrow) / float64(totalLabels)
	}

	return BenchmarkMetrics{
		TotalWirelength:        math.Round(totalWirelength),
		BendCount:              bendCount,
		CrossingsCount:         crossingsCount,
		CollinearOverlapCount:  collinearOverlapCount,
		CollinearOverlapLength: totalOverlapLength,
		LabelsOnArrowCount:     labelsOnArrow,
		TotalLabelsCount:       totalLabels,
		LabelsOnArrowRatio:     labelRatio,
		LabelCollisionCount:    labelCollisions,
		ExecutionTimeMs:        math.Round(execTimeMs*100.0) / 100.0,
		CompositeScore:         compositeScore,
		LayoutAlgorithm:        layoutName,
		RoutingAlgorithm:       routingName,
		QualityVector:          qualityVector,
	}
}

// CalculateBenchmarkMetrics preserves backward compatibility with earlier callers.
func CalculateBenchmarkMetrics(nodes []BlockNode, edges []EdgeConnection, durationMs float64, layoutAlgo, routingAlgo string) BenchmarkMetrics {
	opts := DefaultRoutingOptions()
	return CalculateDetailedMetrics(nodes, edges, layoutAlgo, routingAlgo, durationMs, &opts)
}

func countCrossings(edges []EdgeConnection) int {
	type segment struct {
		edge string
		a, b Point
	}
	var segments []segment
	for _, edge := range edges {
		for i := 0; i+1 < len(edge.Path); i++ {
			segments = append(segments, segment{edge: edge.ID, a: edge.Path[i], b: edge.Path[i+1]})
		}
	}
	count := 0
	for i := 0; i < len(segments); i++ {
		for j := i + 1; j < len(segments); j++ {
			a, b := segments[i], segments[j]
			if a.edge == b.edge {
				continue
			}
			ah := almost(a.a.Y, a.b.Y)
			av := almost(a.a.X, a.b.X)
			bh := almost(b.a.Y, b.b.Y)
			bv := almost(b.a.X, b.b.X)
			if ah && bv {
				if betweenStrict(b.a.X, a.a.X, a.b.X) && betweenStrict(a.a.Y, b.a.Y, b.b.Y) {
					count++
				}
			} else if av && bh {
				if betweenStrict(a.a.X, b.a.X, b.b.X) && betweenStrict(b.a.Y, a.a.Y, a.b.Y) {
					count++
				}
			}
		}
	}
	return count
}

func betweenStrict(v, a, b float64) bool {
	min, max := math.Min(a, b), math.Max(a, b)
	return v > min+2.0 && v < max-2.0
}
