package main

import (
	"math"
	"time"
)

// CalculateNLPOptimalityBreakdown computes multi-objective cost breakdown
func CalculateNLPOptimalityBreakdown(
	nodes []BlockNode,
	edges []EdgeConnection,
	params NLPOptimizationParams,
) NLPCostBreakdown {
	nodeMap := make(map[string]BlockNode, len(nodes))
	for _, n := range nodes {
		nodeMap[n.ID] = n
	}

	wWire := params.WirelengthWeight
	if wWire == 0 {
		wWire = 100.0
	}
	wVar := params.WirelengthVarianceWeight
	if wVar == 0 {
		wVar = 60.0
	}
	wRep := params.BlockRepulsionWeight
	if wRep == 0 {
		wRep = 100.0
	}
	wProx := params.WireSpacingWeight
	if wProx == 0 {
		wProx = 80.0
	}
	wAlign := params.PortAlignmentWeight
	if wAlign == 0 {
		wAlign = 70.0
	}

	totalWirelength := 0.0
	wireLengths := make([]float64, 0, len(edges))
	portAlignmentCost := 0.0

	for _, e := range edges {
		sNode, ok1 := nodeMap[e.SourceBlockID]
		tNode, ok2 := nodeMap[e.TargetBlockID]
		if ok1 && ok2 {
			sPos := GetPortCoordinates(sNode, e.SourcePortID, true)
			tPos := GetPortCoordinates(tNode, e.TargetPortID, false)
			manhattan := math.Abs(sPos.X-tPos.X) + math.Abs(sPos.Y-tPos.Y)
			totalWirelength += manhattan
			wireLengths = append(wireLengths, manhattan)

			// Alignment cost: ports on horizontal/vertical lines
			dx := math.Abs(sPos.X - tPos.X)
			dy := math.Abs(sPos.Y - tPos.Y)
			if sPos.Normal.Dx != 0 && tPos.Normal.Dx != 0 {
				portAlignmentCost += dy * 2.0
			} else if sPos.Normal.Dy != 0 && tPos.Normal.Dy != 0 {
				portAlignmentCost += dx * 2.0
			}
		}
	}

	// Variance cost
	wireVarianceCost := 0.0
	if len(wireLengths) > 1 {
		meanLen := totalWirelength / float64(len(wireLengths))
		sumSq := 0.0
		for _, l := range wireLengths {
			diff := l - meanLen
			sumSq += diff * diff
		}
		wireVarianceCost = math.Sqrt(sumSq / float64(len(wireLengths)))
	}

	// Repulsion cost between blocks
	repulsionCost := 0.0
	minClearance := params.OptimalBlockDistance
	if minClearance <= 0 {
		minClearance = 180.0
	}

	for i := 0; i < len(nodes); i++ {
		for j := i + 1; j < len(nodes); j++ {
			nA := nodes[i]
			nB := nodes[j]

			cAX := nA.X + nA.Width/2.0
			cAY := nA.Y + nA.Height/2.0
			cBX := nB.X + nB.Width/2.0
			cBY := nB.Y + nB.Height/2.0

			dx := math.Abs(cAX - cBX)
			dy := math.Abs(cAY - cBY)
			minReqX := (nA.Width+nB.Width)/2.0 + 40.0
			minReqY := (nA.Height+nB.Height)/2.0 + 40.0

			overlapX := minReqX - dx
			overlapY := minReqY - dy

			if overlapX > 0 && overlapY > 0 {
				// Severe overlap penalty
				repulsionCost += overlapX * overlapY * 50.0
			} else {
				dist := math.Hypot(cAX-cBX, cAY-cBY)
				if dist < minClearance {
					repulsionCost += (minClearance - dist) * 10.0
				}
			}
		}
	}

	// Wire proximity / channel clearance
	wireProximityCost := 0.0
	targetWireDist := params.OptimalWireDistance
	if targetWireDist <= 0 {
		targetWireDist = 20.0
	}

	collinearRes := DetectCollinearOverlaps(edges)
	collinearPenalty := collinearRes.TotalOverlapLength*10000.0 + float64(collinearRes.OverlapCount)*50000.0

	labelsMap := ComputeOptimizedLabels(nodes, edges, nil, 6.0)
	onArrowCount := 0
	labelOffArrowPenalty := 0.0
	for _, l := range labelsMap {
		if l.IsOnArrow {
			onArrowCount++
		} else {
			labelOffArrowPenalty += MaxLabelOffArrowPenalty
		}
	}

	labelRatio := 1.0
	if len(edges) > 0 {
		labelRatio = float64(onArrowCount) / float64(len(edges))
	}

	overallCost := (totalWirelength * wWire / 100.0) +
		(wireVarianceCost * wVar / 100.0) +
		(repulsionCost * wRep / 100.0) +
		(wireProximityCost * wProx / 100.0) +
		(portAlignmentCost * wAlign / 100.0) +
		collinearPenalty +
		labelOffArrowPenalty

	return NLPCostBreakdown{
		OverallCostValue:        overallCost,
		WirelengthCost:          totalWirelength * wWire / 100.0,
		WireVarianceCost:        wireVarianceCost * wVar / 100.0,
		RepulsionCost:           repulsionCost * wRep / 100.0,
		WireProximityCost:       wireProximityCost * wProx / 100.0,
		PortAlignmentCost:       portAlignmentCost * wAlign / 100.0,
		CollinearOverlapPenalty: collinearPenalty,
		LabelOffArrowPenalty:    labelOffArrowPenalty,
		TotalWirelength:         totalWirelength,
		CollinearOverlapCount:   collinearRes.OverlapCount,
		CollinearOverlapLength:  collinearRes.TotalOverlapLength,
		LabelsOnArrowRatio:      labelRatio,
		GradientMagnitudeNorm:   0,
	}
}

// RunNLPOptimization executes analytical multi-objective gradient descent on block placement
func RunNLPOptimization(
	nodes []BlockNode,
	edges []EdgeConnection,
	routingOpts RoutingOptions,
	params NLPOptimizationParams,
) NLPOptimizationResult {
	startTime := time.Now()

	// Deep copy nodes
	optNodes := make([]BlockNode, len(nodes))
	for i, n := range nodes {
		optNodes[i] = n
	}

	iterations := params.Iterations
	if iterations <= 0 {
		iterations = 15
	}
	lr := params.LearningRate
	if lr <= 0 {
		lr = 0.08
	}

	initialBreakdown := CalculateNLPOptimalityBreakdown(optNodes, edges, params)
	var history []NLPCostBreakdown
	history = append(history, initialBreakdown)

	// Velocity map for momentum gradient descent
	velX := make(map[string]float64)
	velY := make(map[string]float64)
	momentum := 0.75

	for iter := 0; iter < iterations; iter++ {
		nodeMap := make(map[string]BlockNode, len(optNodes))
		for _, n := range optNodes {
			nodeMap[n.ID] = n
		}

		gradX := make(map[string]float64)
		gradY := make(map[string]float64)

		// 1. Spring forces along edges (Wirelength + Port Alignment)
		for _, e := range edges {
			sNode, ok1 := nodeMap[e.SourceBlockID]
			tNode, ok2 := nodeMap[e.TargetBlockID]
			if !ok1 || !ok2 {
				continue
			}

			sPos := GetPortCoordinates(sNode, e.SourcePortID, true)
			tPos := GetPortCoordinates(tNode, e.TargetPortID, false)

			dx := tPos.X - sPos.X
			dy := tPos.Y - sPos.Y
			dist := math.Hypot(dx, dy)
			if dist < 0.001 {
				continue
			}

			// Spring force towards optimal distance
			targetDist := params.OptimalBlockDistance
			if targetDist <= 0 {
				targetDist = 160.0
			}
			force := (dist - targetDist) * 0.15

			fx := (dx / dist) * force
			fy := (dy / dist) * force

			// Port alignment pull
			if sPos.Normal.Dx != 0 && tPos.Normal.Dx != 0 {
				fy += (tPos.Y - sPos.Y) * 0.2
			} else if sPos.Normal.Dy != 0 && tPos.Normal.Dy != 0 {
				fx += (tPos.X - sPos.X) * 0.2
			}

			if !sNode.IsPinned || !params.FreezePinnedNodes {
				gradX[sNode.ID] += fx
				gradY[sNode.ID] += fy
			}
			if !tNode.IsPinned || !params.FreezePinnedNodes {
				gradX[tNode.ID] -= fx
				gradY[tNode.ID] -= fy
			}
		}

		// 2. Block-to-block repulsion forces
		for i := 0; i < len(optNodes); i++ {
			for j := i + 1; j < len(optNodes); j++ {
				nA := optNodes[i]
				nB := optNodes[j]

				cAX := nA.X + nA.Width/2.0
				cAY := nA.Y + nA.Height/2.0
				cBX := nB.X + nB.Width/2.0
				cBY := nB.Y + nB.Height/2.0

				dx := cBX - cAX
				dy := cBY - cAY
				dist := math.Hypot(dx, dy)
				if dist < 0.001 {
					dx = 1.0
					dist = 1.0
				}

				minSep := (nA.Width+nB.Width)/2.0 + 35.0
				if dist < minSep*2.5 {
					repForce := (minSep*2.5 - dist) * 0.4
					rx := (dx / dist) * repForce
					ry := (dy / dist) * repForce

					if !nA.IsPinned || !params.FreezePinnedNodes {
						gradX[nA.ID] -= rx
						gradY[nA.ID] -= ry
					}
					if !nB.IsPinned || !params.FreezePinnedNodes {
						gradX[nB.ID] += rx
						gradY[nB.ID] += ry
					}
				}
			}
		}

		// 3. Apply updates with momentum and grid snapping
		gradNorm := 0.0
		for i := range optNodes {
			n := &optNodes[i]
			if n.IsPinned && params.FreezePinnedNodes {
				// Strict invariant: ∇_X_pinned Φ(X) ≡ 0
				continue
			}

			gx := gradX[n.ID]
			gy := gradY[n.ID]
			gradNorm += gx*gx + gy*gy

			// Clip excessive gradient
			maxStep := 40.0
			stepX := gx * lr
			stepY := gy * lr
			if stepX > maxStep {
				stepX = maxStep
			} else if stepX < -maxStep {
				stepX = -maxStep
			}
			if stepY > maxStep {
				stepY = maxStep
			} else if stepY < -maxStep {
				stepY = -maxStep
			}

			velX[n.ID] = velX[n.ID]*momentum + stepX*(1.0-momentum)
			velY[n.ID] = velY[n.ID]*momentum + stepY*(1.0-momentum)

			newX := n.X + velX[n.ID]
			newY := n.Y + velY[n.ID]

			// Keep bounded
			if newX < 20 {
				newX = 20
			}
			if newY < 20 {
				newY = 20
			}
			if newX > 1800 {
				newX = 1800
			}
			if newY > 1200 {
				newY = 1200
			}

			// Grid snap to 5px
			n.X = math.Round(newX/5.0) * 5.0
			n.Y = math.Round(newY/5.0) * 5.0
		}

		currentBreakdown := CalculateNLPOptimalityBreakdown(optNodes, edges, params)
		currentBreakdown.GradientMagnitudeNorm = math.Sqrt(gradNorm)
		history = append(history, currentBreakdown)
	}

	// Re-route edges with Orthogonal A* on final optimized layout
	routedEdges := RouteOrthogonalAStar(optNodes, edges, routingOpts)
	finalBreakdown := CalculateNLPOptimalityBreakdown(optNodes, routedEdges, params)

	elapsed := float64(time.Since(startTime).Microseconds()) / 1000.0

	return NLPOptimizationResult{
		Nodes:            optNodes,
		Edges:            routedEdges,
		InitialBreakdown: initialBreakdown,
		FinalBreakdown:   finalBreakdown,
		History:          history,
		DurationMs:       elapsed,
	}
}
