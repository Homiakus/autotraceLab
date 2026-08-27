package core

import (
	"fmt"
	"math"
	"sort"
)

// UnifiedOptimizationResult contains the co-optimized diagram layout, routing, and quality achievements.
type UnifiedOptimizationResult struct {
	Nodes                    []BlockNode      `json:"nodes"`
	Edges                    []EdgeConnection `json:"edges"`
	Steps                    []AlgorithmStep  `json:"steps"`
	AlignmentScore           int              `json:"alignmentScore"`
	StraightWiresCount       int              `json:"straightWiresCount"`
	EliminatedArtifactsCount int              `json:"eliminatedArtifactsCount"`
}

// RunUnifiedCoOptimization executes joint placement and artifact-free wire routing co-optimization.
func RunUnifiedCoOptimization(
	initialNodes []BlockNode,
	initialEdges []EdgeConnection,
	options RoutingOptions,
) UnifiedOptimizationResult {
	var steps []AlgorithmStep
	nodes := cloneNodesSnapshot(initialNodes)
	edges := cloneEdgesSnapshot(initialEdges)

	nodeMap := make(map[string]*BlockNode, len(nodes))
	for i := range nodes {
		nodeMap[nodes[i].ID] = &nodes[i]
	}

	weights := options.Weights

	// Snapshot 0: Initial
	steps = append(steps, AlgorithmStep{
		StepIndex:     0,
		Title:         "Исходное состояние (Initial State)",
		Description:   "Начальные позиции блоков и связи до запуска сквозной совместной оптимизации (Co-Optimization).",
		Phase:         "Init",
		NodesSnapshot: cloneNodesSnapshot(nodes),
		EdgesSnapshot: cloneEdgesSnapshot(edges),
	})

	// =========================================================================
	// STAGE 1: Cycle Breaking & Topological Layer Assignment
	// =========================================================================
	adj := make(map[string][]string, len(nodes))
	for _, n := range nodes {
		adj[n.ID] = []string{}
	}
	for _, e := range edges {
		adj[e.SourceBlockID] = append(adj[e.SourceBlockID], e.TargetBlockID)
	}

	visited := make(map[string]bool)
	recStack := make(map[string]bool)
	reversedEdges := make(map[string]bool)

	var dfsCycle func(u string)
	dfsCycle = func(u string) {
		visited[u] = true
		recStack[u] = true
		for _, v := range adj[u] {
			if !visited[v] {
				dfsCycle(v)
			} else if recStack[v] {
				reversedEdges[u+"->"+v] = true
			}
		}
		recStack[u] = false
	}

	for _, n := range nodes {
		if !visited[n.ID] {
			dfsCycle(n.ID)
		}
	}

	// Calculate in-degree for DAG
	inDegree := make(map[string]int, len(nodes))
	for _, n := range nodes {
		inDegree[n.ID] = 0
	}
	for _, e := range edges {
		if !reversedEdges[e.SourceBlockID+"->"+e.TargetBlockID] {
			inDegree[e.TargetBlockID]++
		}
	}

	var layers [][]string
	processed := make(map[string]bool)
	var currentLayer []string
	for _, n := range nodes {
		if inDegree[n.ID] == 0 {
			currentLayer = append(currentLayer, n.ID)
		}
	}
	if len(currentLayer) == 0 && len(nodes) > 0 {
		currentLayer = []string{nodes[0].ID}
	}

	layerIdx := 0
	for len(currentLayer) > 0 && layerIdx < 20 {
		layers = append(layers, currentLayer)
		for _, id := range currentLayer {
			processed[id] = true
			if node, ok := nodeMap[id]; ok {
				layerCopy := layerIdx
				node.Layer = &layerCopy
			}
		}

		candidateMap := make(map[string]bool)
		for _, u := range currentLayer {
			for _, v := range adj[u] {
				if !reversedEdges[u+"->"+v] && !processed[v] {
					candidateMap[v] = true
				}
			}
		}

		var nextLayer []string
		for v := range candidateMap {
			allParentsProcessed := true
			for _, e := range edges {
				if e.TargetBlockID == v && !reversedEdges[e.SourceBlockID+"->"+v] {
					if !processed[e.SourceBlockID] {
						allParentsProcessed = false
						break
					}
				}
			}
			if allParentsProcessed {
				nextLayer = append(nextLayer, v)
			}
		}

		if len(nextLayer) == 0 && len(processed) < len(nodes) {
			for _, n := range nodes {
				if !processed[n.ID] {
					nextLayer = []string{n.ID}
					break
				}
			}
		}

		currentLayer = nextLayer
		layerIdx++
	}

	// =========================================================================
	// STAGE 2: Port-Aware Barycentric Crossing Minimization
	// =========================================================================
	sweepIterations := int(math.Max(3, math.Min(15, math.Round(weights.CrossingWeight/8.0))))
	for sweep := 0; sweep < sweepIterations; sweep++ {
		// Forward sweep
		for l := 1; l < len(layers); l++ {
			prevNodes := layers[l-1]
			prevNodeIndex := make(map[string]int, len(prevNodes))
			for idx, id := range prevNodes {
				prevNodeIndex[id] = idx
			}

			type nodeScore struct {
				id    string
				score float64
			}
			var scores []nodeScore

			for _, nodeId := range layers[l] {
				totalWeight := 0.0
				weightedSum := 0.0

				for _, e := range edges {
					if e.TargetBlockID == nodeId {
						if srcIdx, ok := prevNodeIndex[e.SourceBlockID]; ok {
							srcNode := nodeMap[e.SourceBlockID]
							tgtNode := nodeMap[nodeId]
							if srcNode != nil && tgtNode != nil {
								srcPos := GetPortCoordinatesAccurate(*srcNode, e.SourcePortID, true)
								portRelative := srcPos.Y - srcNode.Y
								weightedSum += float64(srcIdx)*1000.0 + portRelative
								totalWeight += 1.0
							}
						}
					}
				}

				score := 0.0
				if totalWeight > 0 {
					score = weightedSum / totalWeight
				}
				scores = append(scores, nodeScore{id: nodeId, score: score})
			}

			sort.Slice(scores, func(a, b int) bool {
				return scores[a].score < scores[b].score
			})

			newLayer := make([]string, len(scores))
			for idx, s := range scores {
				newLayer[idx] = s.id
			}
			layers[l] = newLayer
		}

		// Backward sweep
		for l := len(layers) - 2; l >= 0; l-- {
			nextNodes := layers[l+1]
			nextNodeIndex := make(map[string]int, len(nextNodes))
			for idx, id := range nextNodes {
				nextNodeIndex[id] = idx
			}

			type nodeScore struct {
				id    string
				score float64
			}
			var scores []nodeScore

			for _, nodeId := range layers[l] {
				totalWeight := 0.0
				weightedSum := 0.0

				for _, e := range edges {
					if e.SourceBlockID == nodeId {
						if tgtIdx, ok := nextNodeIndex[e.TargetBlockID]; ok {
							tgtNode := nodeMap[e.TargetBlockID]
							srcNode := nodeMap[nodeId]
							if tgtNode != nil && srcNode != nil {
								tgtPos := GetPortCoordinatesAccurate(*tgtNode, e.TargetPortID, false)
								portRelative := tgtPos.Y - tgtNode.Y
								weightedSum += float64(tgtIdx)*1000.0 + portRelative
								totalWeight += 1.0
							}
						}
					}
				}

				score := 0.0
				if totalWeight > 0 {
					score = weightedSum / totalWeight
				}
				scores = append(scores, nodeScore{id: nodeId, score: score})
			}

			sort.Slice(scores, func(a, b int) bool {
				return scores[a].score < scores[b].score
			})

			newLayer := make([]string, len(scores))
			for idx, s := range scores {
				newLayer[idx] = s.id
			}
			layers[l] = newLayer
		}
	}

	// =========================================================================
	// STAGE 3: Exact Pin-to-Pin Micro-Alignment & Coordinate Assignment
	// =========================================================================
	layerWidths := make([]float64, len(layers))
	for l, layerNodeIds := range layers {
		maxW := 150.0
		for _, id := range layerNodeIds {
			if n, ok := nodeMap[id]; ok && n.Width > maxW {
				maxW = n.Width
			}
		}
		layerWidths[l] = maxW
	}

	// Calculate dynamic channel width based on inter-layer wire density
	layerChannelSpacing := make([]float64, len(layers))
	for l := 0; l < len(layers)-1; l++ {
		currentLayerSet := make(map[string]bool)
		for _, id := range layers[l] {
			currentLayerSet[id] = true
		}
		nextLayerSet := make(map[string]bool)
		for _, id := range layers[l+1] {
			nextLayerSet[id] = true
		}

		crossEdgesCount := 0
		for _, e := range edges {
			if currentLayerSet[e.SourceBlockID] && nextLayerSet[e.TargetBlockID] {
				crossEdgesCount++
			}
		}

		dynamicSpacing := math.Max(160.0, 140.0+float64(crossEdgesCount)*14.0)
		layerChannelSpacing[l] = dynamicSpacing
	}
	if len(layers) > 0 {
		layerChannelSpacing[len(layers)-1] = 160.0
	}

	currentX := 80.0
	layerX := make([]float64, len(layers))
	for l := range layers {
		layerX[l] = currentX
		spacing := 160.0
		if l < len(layerChannelSpacing) {
			spacing = layerChannelSpacing[l]
		}
		currentX += layerWidths[l] + spacing
	}

	// Vertical placement with iterative Pin-Y Snapping
	nodeSpacing := 45.0
	startY := 80.0

	// Step 3.1: Initial baseline Y placement for Layer 0
	if len(layers) > 0 {
		y0 := startY
		for _, id := range layers[0] {
			if node, ok := nodeMap[id]; ok {
				node.X = layerX[0]
				node.Y = y0
				y0 += node.Height + nodeSpacing
			}
		}
	}

	// Step 3.2: Forward Pin-Alignment from Layer 1 to N-1
	for l := 1; l < len(layers); l++ {
		layerNodeIds := layers[l]
		prevLayerNodeIds := make(map[string]bool)
		for _, id := range layers[l-1] {
			prevLayerNodeIds[id] = true
		}

		type desiredPos struct {
			id       string
			desiredY float64
			node     *BlockNode
		}
		var desiredYPositions []desiredPos

		for _, id := range layerNodeIds {
			node := nodeMap[id]
			if node == nil {
				continue
			}
			node.X = layerX[l]

			var targetOffsets []float64
			for _, e := range edges {
				if e.TargetBlockID == id && prevLayerNodeIds[e.SourceBlockID] {
					srcNode := nodeMap[e.SourceBlockID]
					if srcNode != nil {
						srcPortPos := GetPortCoordinatesAccurate(*srcNode, e.SourcePortID, true)

						var tgtPort *Port
						portIndex := 0
						for pIdx, p := range node.Inputs {
							if p.ID == e.TargetPortID {
								tgtPort = &node.Inputs[pIdx]
								portIndex = pIdx
								break
							}
						}
						if tgtPort == nil && len(node.Inputs) > 0 {
							tgtPort = &node.Inputs[0]
							portIndex = 0
						}

						portRelativeY := node.Height / 2.0
						if tgtPort != nil && len(node.Inputs) > 0 {
							portRelativeY = (node.Height / float64(len(node.Inputs)+1)) * float64(portIndex+1)
						}

						idealNodeY := srcPortPos.Y - portRelativeY
						targetOffsets = append(targetOffsets, idealNodeY)
					}
				}
			}

			if len(targetOffsets) > 0 {
				sum := 0.0
				for _, val := range targetOffsets {
					sum += val
				}
				medianDesiredY := sum / float64(len(targetOffsets))
				desiredYPositions = append(desiredYPositions, desiredPos{id: id, desiredY: medianDesiredY, node: node})
			} else {
				desiredYPositions = append(desiredYPositions, desiredPos{id: id, desiredY: startY + float64(len(desiredYPositions))*120.0, node: node})
			}
		}

		runningY := startY
		for _, item := range desiredYPositions {
			targetY := math.Max(runningY, item.desiredY)
			item.node.Y = math.Round(targetY/10.0) * 10.0
			runningY = item.node.Y + item.node.Height + nodeSpacing
		}
	}

	// Step 3.3: Backward Pin-Alignment refinement (Centering sources to sinks)
	for l := len(layers) - 2; l >= 0; l-- {
		layerNodeIds := layers[l]
		nextLayerNodeIds := make(map[string]bool)
		for _, id := range layers[l+1] {
			nextLayerNodeIds[id] = true
		}

		for _, id := range layerNodeIds {
			node := nodeMap[id]
			if node == nil {
				continue
			}

			var outgoing []EdgeConnection
			for _, e := range edges {
				if e.SourceBlockID == id && nextLayerNodeIds[e.TargetBlockID] {
					outgoing = append(outgoing, e)
				}
			}

			if len(outgoing) == 1 {
				edge := outgoing[0]
				tgtNode := nodeMap[edge.TargetBlockID]
				if tgtNode != nil {
					tgtPortPos := GetPortCoordinatesAccurate(*tgtNode, edge.TargetPortID, false)

					var srcPort *Port
					portIndex := 0
					for pIdx, p := range node.Outputs {
						if p.ID == edge.SourcePortID {
							srcPort = &node.Outputs[pIdx]
							portIndex = pIdx
							break
						}
					}
					if srcPort == nil && len(node.Outputs) > 0 {
						srcPort = &node.Outputs[0]
						portIndex = 0
					}

					srcRelativeY := node.Height / 2.0
					if srcPort != nil && len(node.Outputs) > 0 {
						srcRelativeY = (node.Height / float64(len(node.Outputs)+1)) * float64(portIndex+1)
					}

					alignedY := math.Round((tgtPortPos.Y-srcRelativeY)/10.0) * 10.0

					// Check if shifting causes overlap with peers in the same layer
					canShift := true
					for _, pid := range layerNodeIds {
						if pid == id {
							continue
						}
						peer := nodeMap[pid]
						if peer == nil {
							continue
						}
						overlap := !(alignedY+node.Height+20.0 < peer.Y || alignedY > peer.Y+peer.Height+20.0)
						if overlap {
							canShift = false
							break
						}
					}

					if canShift && alignedY >= startY {
						node.Y = alignedY
					}
				}
			}
		}
	}

	steps = append(steps, AlgorithmStep{
		StepIndex:     1,
		Title:         "Фаза 1 & 2: Оптимальное размещение блоков с соосностью пинов (Pin-Aligned Placement)",
		Description:   "Блоки размещены по слоям с выравниванием по высоте Y для обеспечения 100% прямолинейных 0-изгибных трасс.",
		Phase:         "Placement",
		NodesSnapshot: cloneNodesSnapshot(nodes),
		EdgesSnapshot: cloneEdgesSnapshot(edges),
	})

	// =========================================================================
	// STAGE 4: Artifact-Free Multi-Pass Orthogonal Wire Routing
	// =========================================================================
	straightCount := 0
	eliminatedArtifacts := 0
	alignedPortPairs := 0

	routedBase := RouteOrthogonalAStar(nodes, edges, options)

	optimizedEdges := make([]EdgeConnection, len(routedBase))
	for i, edge := range routedBase {
		srcNode := nodeMap[edge.SourceBlockID]
		tgtNode := nodeMap[edge.TargetBlockID]
		if srcNode == nil || tgtNode == nil {
			optimizedEdges[i] = edge
			continue
		}

		srcPos := GetPortCoordinatesAccurate(*srcNode, edge.SourcePortID, true)
		tgtPos := GetPortCoordinatesAccurate(*tgtNode, edge.TargetPortID, false)

		if math.Abs(srcPos.Y-tgtPos.Y) <= 4.0 || math.Abs(srcPos.X-tgtPos.X) <= 4.0 {
			alignedPortPairs++
		}

		rawPath := edge.Path
		if len(rawPath) < 2 {
			rawPath = []Point{
				{X: srcPos.X, Y: srcPos.Y},
				{X: tgtPos.X, Y: tgtPos.Y},
			}
		}

		initialBendCount := int(math.Max(0, float64(len(rawPath)-2)))
		clearance := options.ObstacleClearance
		if clearance <= 0 {
			clearance = 12.0
		}

		cleanedPath := CleanOrthogonalArtifacts(rawPath, &srcPos, &tgtPos, nodes, clearance, options.PortExitOffset, options.PortExitOffset)
		finalBendCount := int(math.Max(0, float64(len(cleanedPath)-2)))

		if finalBendCount < initialBendCount {
			eliminatedArtifacts += (initialBendCount - finalBendCount)
		}

		if len(cleanedPath) == 2 {
			straightCount++
		}

		cpEdge := edge
		cpEdge.Path = cleanedPath
		optimizedEdges[i] = cpEdge
	}

	steps = append(steps, AlgorithmStep{
		StepIndex:     2,
		Title:         "Фаза 3: Трассировка без артефактов изгиба (Artifact-Free Wire Clean)",
		Description:   fmt.Sprintf("Устранено паразитных изгибов: %d. Сформировано абсолютно прямых 0-изгибных связей: %d.", eliminatedArtifacts, straightCount),
		Phase:         "Routing",
		NodesSnapshot: cloneNodesSnapshot(nodes),
		EdgesSnapshot: cloneEdgesSnapshot(optimizedEdges),
	})

	alignmentScore := 100
	if len(edges) > 0 {
		alignmentScore = int(math.Round((float64(alignedPortPairs) / float64(len(edges))) * 100.0))
	}

	return UnifiedOptimizationResult{
		Nodes:                    nodes,
		Edges:                    optimizedEdges,
		Steps:                    steps,
		AlignmentScore:           alignmentScore,
		StraightWiresCount:       straightCount,
		EliminatedArtifactsCount: eliminatedArtifacts,
	}
}
