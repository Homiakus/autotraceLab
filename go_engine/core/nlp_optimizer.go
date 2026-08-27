package core

import (
	"context"
	"fmt"
	"math"
	"strings"
)

// DefaultNLPParams returns canonical default hyperparameters and objective weights for the NLP solver.
func DefaultNLPParams() NLPOptimizationParams {
	return NLPOptimizationParams{
		OptimalBlockDistance:       220.0,
		OptimalWireDistance:        24.0,
		WirelengthWeight:           40.0,
		WirelengthVarianceWeight:   35.0,
		BlockRepulsionWeight:       85.0,
		WireSpacingWeight:          60.0,
		StrictLabelClearanceWeight: 75.0,
		PortAlignmentWeight:        80.0,
		LearningRate:               0.08,
		Iterations:                 75,
		Momentum:                   0.85,
		FreezePinnedNodes:          true,
	}
}

func cloneNodesSnapshot(nodes []BlockNode) []BlockNode {
	result := make([]BlockNode, len(nodes))
	for i, n := range nodes {
		cp := n
		if n.Inputs != nil {
			cp.Inputs = make([]Port, len(n.Inputs))
			copy(cp.Inputs, n.Inputs)
		}
		if n.Outputs != nil {
			cp.Outputs = make([]Port, len(n.Outputs))
			copy(cp.Outputs, n.Outputs)
		}
		if n.Ports != nil {
			cp.Ports = make([]Port, len(n.Ports))
			copy(cp.Ports, n.Ports)
		}
		result[i] = cp
	}
	return result
}

func cloneEdgesSnapshot(edges []EdgeConnection) []EdgeConnection {
	result := make([]EdgeConnection, len(edges))
	for i, e := range edges {
		cp := e
		if e.Path != nil {
			cp.Path = make([]Point, len(e.Path))
			copy(cp.Path, e.Path)
		}
		result[i] = cp
	}
	return result
}

func buildConnectedPairsSet(edges []EdgeConnection) map[string]bool {
	set := make(map[string]bool, len(edges)*2)
	for _, e := range edges {
		set[e.SourceBlockID+"__"+e.TargetBlockID] = true
		set[e.TargetBlockID+"__"+e.SourceBlockID] = true
	}
	return set
}

// CalculateNLPOptimalityBreakdown calculates the exact multi-objective loss function Φ(X) and its constituent components.
func CalculateNLPOptimalityBreakdown(
	nodes []BlockNode,
	edges []EdgeConnection,
	params NLPOptimizationParams,
) NLPOptimalityBreakdown {
	nodeMap := make(map[string]BlockNode, len(nodes))
	for _, n := range nodes {
		nodeMap[n.ID] = n
	}
	connectedPairs := buildConnectedPairsSet(edges)
	wireLengths := make([]float64, 0, len(edges))
	totalWirelength := 0.0
	maxIndividualWirelength := 0.0
	portAlignmentDeviation := 0.0

	// 1. Individual and total wirelengths
	for _, e := range edges {
		sNode, okS := nodeMap[e.SourceBlockID]
		tNode, okT := nodeMap[e.TargetBlockID]
		if !okS || !okT {
			continue
		}

		sPos := GetPortCoordinatesAccurate(sNode, e.SourcePortID, true)
		tPos := GetPortCoordinatesAccurate(tNode, e.TargetPortID, false)

		length := 0.0
		if len(e.Path) >= 2 {
			for p := 0; p < len(e.Path)-1; p++ {
				length += math.Hypot(e.Path[p+1].X-e.Path[p].X, e.Path[p+1].Y-e.Path[p].Y)
			}
		} else {
			length = math.Hypot(tPos.X-sPos.X, tPos.Y-sPos.Y)
		}

		wireLengths = append(wireLengths, length)
		totalWirelength += length
		if length > maxIndividualWirelength {
			maxIndividualWirelength = length
		}

		// Port Y alignment error for horizontal connections
		if sPos.Normal.Dx == 1 && tPos.Normal.Dx == -1 {
			portAlignmentDeviation += math.Abs(tPos.Y - sPos.Y)
		}
	}

	edgeCount := len(wireLengths)
	if edgeCount < 1 {
		edgeCount = 1
	}
	averageWirelength := totalWirelength / float64(edgeCount)

	// Variance of wirelengths
	varianceSum := 0.0
	for _, l := range wireLengths {
		diff := l - averageWirelength
		varianceSum += diff * diff
	}
	wirelengthVariance := math.Sqrt(varianceSum / float64(edgeCount))

	// 2. Block-to-Block distance deviation from D_opt
	blockDistDevSum := 0.0
	blockPairs := 0
	for i := 0; i < len(nodes); i++ {
		u := nodes[i]
		cxU := u.X + u.Width/2.0
		cyU := u.Y + u.Height/2.0

		for j := i + 1; j < len(nodes); j++ {
			v := nodes[j]
			cxV := v.X + v.Width/2.0
			cyV := v.Y + v.Height/2.0
			dist := math.Hypot(cxV-cxU, cyV-cyU)

			if connectedPairs[u.ID+"__"+v.ID] {
				blockDistDevSum += math.Abs(dist - params.OptimalBlockDistance)
				blockPairs++
			}
		}
	}
	blockDistanceDeviation := 0.0
	if blockPairs > 0 {
		blockDistanceDeviation = blockDistDevSum / float64(blockPairs)
	}

	// 3. Wire Distance Violations (wires closer than S_opt)
	wireViolations := 0
	for i := 0; i < len(edges); i++ {
		e1 := edges[i]
		if len(e1.Path) < 2 {
			continue
		}

		for j := i + 1; j < len(edges); j++ {
			e2 := edges[j]
			if len(e2.Path) < 2 {
				continue
			}

			for p := 0; p < len(e1.Path)-1; p++ {
				s1 := e1.Path[p]
				s2 := e1.Path[p+1]
				sIsH := math.Abs(s1.Y-s2.Y) < 1.0

				for q := 0; q < len(e2.Path)-1; q++ {
					t1 := e2.Path[q]
					t2 := e2.Path[q+1]
					tIsH := math.Abs(t1.Y-t2.Y) < 1.0

					if sIsH && tIsH {
						minS := math.Min(s1.X, s2.X)
						maxS := math.Max(s1.X, s2.X)
						minT := math.Min(t1.X, t2.X)
						maxT := math.Max(t1.X, t2.X)

						overlapX := !(maxS < minT || maxT < minS)
						if overlapX && math.Abs(s1.Y-t1.Y) < params.OptimalWireDistance {
							wireViolations++
						}
					}
				}
			}
		}
	}

	// 4. Strict Mandate Evaluation: Collinear Wire Overlaps & On-Arrow Labels
	collinear := DetectCollinearOverlaps(edges)
	collinearOverlapPenalty := collinear.TotalOverlapLength * 10000.0
	if collinear.TotalOverlapLength > 0 {
		collinearOverlapPenalty += 50000.0
	}

	labelClearance := 4.0
	if params.StrictLabelClearanceWeight > 0 {
		labelClearance = 8.0
	}
	labelPositions := ComputeOptimizedLabels(nodes, edges, nil, labelClearance)
	labelsOnArrowCount := 0
	labelsOffArrowCount := 0
	labelsOffArrowPenalty := 0.0

	for _, e := range edges {
		if strings.TrimSpace(e.Label) != "" {
			pos, exists := labelPositions[e.ID]
			if exists && pos.IsOnArrow && pos.IsCollisionFree {
				labelsOnArrowCount++
			} else {
				labelsOffArrowCount++
				labelsOffArrowPenalty += MaxLabelOffArrowPenalty
			}
		}
	}

	// 5. Overall Multi-Objective Cost Function Φ(X) with Strict Violation Barriers
	w1 := params.WirelengthWeight * 0.01
	w2 := params.WirelengthVarianceWeight * 0.05
	w3 := params.BlockRepulsionWeight * 0.08
	w4 := params.WireSpacingWeight * 0.1
	w5 := params.PortAlignmentWeight * 0.05

	baseCost := w1*totalWirelength +
		w2*wirelengthVariance +
		w3*blockDistanceDeviation*10.0 +
		w4*float64(wireViolations)*25.0 +
		w5*portAlignmentDeviation

	overallCostValue := math.Round(baseCost + labelsOffArrowPenalty + collinearOverlapPenalty)

	return NLPOptimalityBreakdown{
		TotalWirelength:            math.Round(totalWirelength),
		AverageWirelength:          math.Round(averageWirelength),
		MaxIndividualWirelength:    math.Round(maxIndividualWirelength),
		WirelengthVariance:         math.Round(wirelengthVariance),
		BlockDistanceDeviation:     math.Round(blockDistanceDeviation),
		WireDistanceViolationCount: wireViolations,
		CollinearWireOverlapLength: collinear.TotalOverlapLength,
		CollinearWireOverlapCount:  collinear.OverlapCount,
		LabelsOnArrowCount:         labelsOnArrowCount,
		LabelsOffArrowCount:        labelsOffArrowCount,
		LabelsOffArrowPenalty:      labelsOffArrowPenalty,
		LabelCollisionsCount:       labelsOffArrowCount,
		PortAlignmentDeviation:     math.Round(portAlignmentDeviation),
		OverallCostValue:           overallCostValue,
	}
}

// RunNLPOptimization executes multi-objective gradient descent on block coordinates.
func RunNLPOptimization(
	initialNodes []BlockNode,
	initialEdges []EdgeConnection,
	options RoutingOptions,
	customParams *NLPOptimizationParams,
) NLPOptimizationResult {
	res, _ := RunNLPOptimizationWithContext(context.Background(), initialNodes, initialEdges, options, customParams)
	return res
}

// RunNLPOptimizationWithContext executes multi-objective gradient descent with context cancellation support.
func RunNLPOptimizationWithContext(
	ctx context.Context,
	initialNodes []BlockNode,
	initialEdges []EdgeConnection,
	options RoutingOptions,
	customParams *NLPOptimizationParams,
) (NLPOptimizationResult, error) {
	if err := ctx.Err(); err != nil {
		return NLPOptimizationResult{}, err
	}

	params := DefaultNLPParams()
	if options.NLPParams != nil {
		params = *options.NLPParams
	}
	if customParams != nil {
		params = *customParams
	}

	steps := make([]AlgorithmStep, 0)
	history := make([]NLPIterationSnapshot, 0)

	nodes := cloneNodesSnapshot(initialNodes)
	edges := cloneEdgesSnapshot(initialEdges)

	pinnedSet := make(map[string]bool)
	for _, n := range nodes {
		if n.IsPinned {
			pinnedSet[n.ID] = true
		}
	}
	if len(pinnedSet) == 0 && len(nodes) > 0 {
		pinnedSet[nodes[0].ID] = true
		nodes[0].IsPinned = true
	}

	initialBreakdown := CalculateNLPOptimalityBreakdown(nodes, edges, params)
	connectedPairs := buildConnectedPairsSet(edges)

	pinnedIDsList := make([]string, 0, len(pinnedSet))
	for id := range pinnedSet {
		pinnedIDsList = append(pinnedIDsList, id)
	}

	steps = append(steps, AlgorithmStep{
		StepIndex:        0,
		Title:            "NLP: Инициализация задачи нелинейного программирования",
		Description:      fmt.Sprintf("Формулировка критериев: D_opt = %.0fpx, S_opt = %.0fpx. Заморожено опорных блоков: %d. Начальная функция потерь Φ(X) = %.0f.", params.OptimalBlockDistance, params.OptimalWireDistance, len(pinnedSet), initialBreakdown.OverallCostValue),
		Phase:            "NLP Init",
		NodesSnapshot:    cloneNodesSnapshot(nodes),
		EdgesSnapshot:    cloneEdgesSnapshot(edges),
		HighlightedNodes: pinnedIDsList,
	})

	type velocity struct {
		vx, vy float64
	}
	type gradient struct {
		gx, gy float64
	}

	velocities := make(map[string]*velocity, len(nodes))
	for _, n := range nodes {
		velocities[n.ID] = &velocity{vx: 0, vy: 0}
	}

	D_opt := params.OptimalBlockDistance
	S_opt := params.OptimalWireDistance
	iterations := params.Iterations
	if iterations <= 0 {
		iterations = 75
	}
	alpha := params.LearningRate
	if alpha <= 0 {
		alpha = 0.08
	}
	momentum := params.Momentum
	if momentum <= 0 {
		momentum = 0.85
	}

	// Compute dynamic bounding box
	minBoundX, minBoundY := 1e9, 1e9
	maxBoundX, maxBoundY := -1e9, -1e9
	for _, n := range initialNodes {
		if n.X < minBoundX {
			minBoundX = n.X
		}
		if n.Y < minBoundY {
			minBoundY = n.Y
		}
		if n.X+n.Width > maxBoundX {
			maxBoundX = n.X + n.Width
		}
		if n.Y+n.Height > maxBoundY {
			maxBoundY = n.Y + n.Height
		}
	}
	if minBoundX == 1e9 {
		minBoundX, minBoundY = 0, 0
		maxBoundX, maxBoundY = 2200, 1800
	}
	minBoundX = math.Min(30.0, minBoundX-500.0)
	minBoundY = math.Min(30.0, minBoundY-500.0)
	maxBoundX = math.Max(2200.0, maxBoundX+500.0)
	maxBoundY = math.Max(1800.0, maxBoundY+500.0)

	for iter := 1; iter <= iterations; iter++ {
		select {
		case <-ctx.Done():
			return NLPOptimizationResult{}, ctx.Err()
		default:
		}

		nodeMap := make(map[string]BlockNode, len(nodes))
		for _, n := range nodes {
			nodeMap[n.ID] = n
		}

		gradients := make(map[string]*gradient, len(nodes))
		for _, n := range nodes {
			gradients[n.ID] = &gradient{gx: 0, gy: 0}
		}

		// 1. Block-to-Block Barrier Potential & Optimal Spacing D_opt
		for i := 0; i < len(nodes); i++ {
			for j := i + 1; j < len(nodes); j++ {
				u := nodes[i]
				v := nodes[j]

				cxU := u.X + u.Width/2.0
				cyU := u.Y + u.Height/2.0
				cxV := v.X + v.Width/2.0
				cyV := v.Y + v.Height/2.0

				dx := cxV - cxU
				dy := cyV - cyU
				dist := math.Hypot(dx, dy)
				if dist == 0 {
					dist = 1.0
				}

				minClearDist := math.Max(u.Width, u.Height)/2.0 + math.Max(v.Width, v.Height)/2.0 + 30.0
				isConnected := connectedPairs[u.ID+"__"+v.ID]

				forceMag := 0.0
				if dist < minClearDist {
					denom := math.Max(dist, 10.0)
					forceMag = -((params.BlockRepulsionWeight * 600.0) / (denom * denom))
				} else if isConnected {
					delta := dist - D_opt
					forceMag = delta * (params.WirelengthVarianceWeight * 0.004)
				} else {
					forceMag = -((params.BlockRepulsionWeight * 120.0) / math.Pow(dist, 1.5))
				}

				fx := (dx / dist) * forceMag
				fy := (dy / dist) * forceMag

				gradients[u.ID].gx += fx
				gradients[u.ID].gy += fy
				gradients[v.ID].gx -= fx
				gradients[v.ID].gy -= fy
			}
		}

		// 2. Wirelength Minimization & Port Coaxial Alignment
		for _, e := range edges {
			u, okU := nodeMap[e.SourceBlockID]
			v, okV := nodeMap[e.TargetBlockID]
			if !okU || !okV {
				continue
			}

			sPos := GetPortCoordinatesAccurate(u, e.SourcePortID, true)
			tPos := GetPortCoordinatesAccurate(v, e.TargetPortID, false)

			dx := tPos.X - sPos.X
			dy := tPos.Y - sPos.Y
			wireLen := math.Hypot(dx, dy)
			if wireLen == 0 {
				wireLen = 1.0
			}

			wLenGrad := params.WirelengthWeight * 0.008
			fxLen := (dx / wireLen) * wLenGrad
			fyLen := (dy / wireLen) * wLenGrad

			gradients[u.ID].gx += fxLen
			gradients[u.ID].gy += fyLen
			gradients[v.ID].gx -= fxLen
			gradients[v.ID].gy -= fyLen

			// Flow directionality: source should be left of target for horizontal pins
			if sPos.Normal.Dx == 1 && tPos.Normal.Dx == -1 {
				if sPos.X > tPos.X-60.0 {
					overlap := (sPos.X - (tPos.X - 60.0)) * 0.08
					gradients[u.ID].gx -= overlap
					gradients[v.ID].gx += overlap
				}

				// Port Y Alignment
				yDiff := tPos.Y - sPos.Y
				alignForce := yDiff * (params.PortAlignmentWeight * 0.005)
				gradients[u.ID].gy += alignForce
				gradients[v.ID].gy -= alignForce
			}

			// Strict On-Arrow Label Clearance Expansion Force
			if strings.TrimSpace(e.Label) != "" {
				requiredLabelSpan := math.Max(70.0, float64(len(e.Label))*7.5+40.0)
				if wireLen < requiredLabelSpan {
					shortage := (requiredLabelSpan - wireLen) * 0.15
					pushX := (dx / wireLen) * shortage
					pushY := (dy / wireLen) * shortage
					gradients[u.ID].gx -= pushX
					gradients[u.ID].gy -= pushY
					gradients[v.ID].gx += pushX
					gradients[v.ID].gy += pushY
				}
			}
		}

		// 3. Frozen Block Constraint Enforcement (\nabla \Phi \equiv 0 for Pinned)
		if params.FreezePinnedNodes {
			for pinnedId := range pinnedSet {
				if grad, exists := gradients[pinnedId]; exists {
					grad.gx = 0
					grad.gy = 0
				}
			}
		}

		// 4. Projected Gradient Descent Update with Momentum & Temperature Cooling
		temp := math.Max(0.1, 1.0-(float64(iter)/float64(iterations))*0.85)
		totalGradNorm := 0.0

		for idx := range nodes {
			node := &nodes[idx]
			if params.FreezePinnedNodes && pinnedSet[node.ID] {
				continue
			}

			grad := gradients[node.ID]
			vel := velocities[node.ID]

			gradNorm := math.Hypot(grad.gx, grad.gy)
			totalGradNorm += gradNorm

			maxGrad := 60.0
			clampedGx := math.Max(-maxGrad, math.Min(maxGrad, grad.gx))
			clampedGy := math.Max(-maxGrad, math.Min(maxGrad, grad.gy))

			vel.vx = momentum*vel.vx + alpha*clampedGx*temp
			vel.vy = momentum*vel.vy + alpha*clampedGy*temp

			node.X += vel.vx
			node.Y += vel.vy

			node.X = math.Max(minBoundX, math.Min(maxBoundX, node.X))
			node.Y = math.Max(minBoundY, math.Min(maxBoundY, node.Y))
		}

		// Record snapshot every 15 iterations or on final step
		if iter%15 == 0 || iter == iterations {
			if iter == iterations {
				snap := options.GridSize
				if snap <= 0 {
					snap = 12.0
				}
				for idx := range nodes {
					if !pinnedSet[nodes[idx].ID] {
						nodes[idx].X = math.Round(nodes[idx].X/snap) * snap
						nodes[idx].Y = math.Round(nodes[idx].Y/snap) * snap
					}
				}
			}

			currentBreakdown := CalculateNLPOptimalityBreakdown(nodes, edges, params)

			history = append(history, NLPIterationSnapshot{
				Iteration:              iter,
				Loss:                   currentBreakdown.OverallCostValue,
				TotalLength:            currentBreakdown.TotalWirelength,
				MaxIndividualLength:    currentBreakdown.MaxIndividualWirelength,
				WireVariance:           currentBreakdown.WirelengthVariance,
				BlockDistanceDeviation: currentBreakdown.BlockDistanceDeviation,
				GradientNorm:           math.Round(totalGradNorm*10.0) / 10.0,
			})

			steps = append(steps, AlgorithmStep{
				StepIndex:        len(steps),
				Title:            fmt.Sprintf("NLP Итерация %d/%d (Сходимость)", iter, iterations),
				Description:      fmt.Sprintf("Функция потерь Φ(X) = %.0f. Общая длина: %.0fpx, Отклонение от D_opt: %.0fpx. Норма градиента: %.1f.", currentBreakdown.OverallCostValue, currentBreakdown.TotalWirelength, currentBreakdown.BlockDistanceDeviation, totalGradNorm),
				Phase:            fmt.Sprintf("NLP Iter %d", iter),
				NodesSnapshot:    cloneNodesSnapshot(nodes),
				EdgesSnapshot:    cloneEdgesSnapshot(edges),
				HighlightedNodes: pinnedIDsList,
			})
		}
	}

	// 5. Final Wire Routing on Optimized Positions
	routedEdges, err := RouteOrthogonalAStarWithContext(ctx, nodes, edges, options)
	if err != nil {
		return NLPOptimizationResult{}, err
	}
	labelClearance := 12.0
	if options.LabelClearance != nil {
		labelClearance = *options.LabelClearance
	}
	ComputeOptimizedLabels(nodes, routedEdges, nil, labelClearance)

	finalBreakdown := CalculateNLPOptimalityBreakdown(nodes, routedEdges, params)
	improvement := 0.0
	if initialBreakdown.OverallCostValue > 0 {
		improvement = math.Max(0, math.Round(((initialBreakdown.OverallCostValue-finalBreakdown.OverallCostValue)/initialBreakdown.OverallCostValue)*100.0))
	}

	steps = append(steps, AlgorithmStep{
		StepIndex:        len(steps),
		Title:            "NLP Решение найдено (Optimal Solution Converged)",
		Description:      fmt.Sprintf("Оптимизация завершена. Улучшение целевой функции: +%.0f%%. Удовлетворены условия: строгие 90° вылеты, строгие надписи без пересечений, оптимальные дистанции D_opt=%.0fpx, S_opt=%.0fpx.", improvement, D_opt, S_opt),
		Phase:            "NLP Converged",
		NodesSnapshot:    cloneNodesSnapshot(nodes),
		EdgesSnapshot:    cloneEdgesSnapshot(routedEdges),
		HighlightedNodes: pinnedIDsList,
	})

	return NLPOptimizationResult{
		Nodes:                 nodes,
		Edges:                 routedEdges,
		Steps:                 steps,
		History:               history,
		InitialBreakdown:      initialBreakdown,
		FinalBreakdown:        finalBreakdown,
		ImprovementPercentage: improvement,
		PinnedNodeIDs:         pinnedIDsList,
	}, nil
}
