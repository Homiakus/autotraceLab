package core

import (
	"math"
	"sort"
)

// SugiyamaOptions configures the 4-phase layered layout engine.
type SugiyamaOptions struct {
	LayerSpacing float64
	NodeSpacing  float64
	StartX       float64
	StartY       float64
}

// DefaultSugiyamaOptions returns standard spacing values.
func DefaultSugiyamaOptions() SugiyamaOptions {
	return SugiyamaOptions{
		LayerSpacing: 180.0,
		NodeSpacing:  50.0,
		StartX:       80.0,
		StartY:       80.0,
	}
}

// RunSugiyamaLayout executes 4-phase Sugiyama layered graph drawing:
// 1. Cycle Breaking (FAS via DFS)
// 2. Layer / Rank Assignment (Topological longest path)
// 3. Crossing Reduction (Barycentric layer sweep)
// 4. Coordinate Assignment (Port-aligned balanced placement)
func RunSugiyamaLayout(initialNodes []BlockNode, edges []EdgeConnection, opt SugiyamaOptions) []BlockNode {
	if len(initialNodes) == 0 {
		return nil
	}
	if opt.LayerSpacing <= 0 {
		opt.LayerSpacing = 180.0
	}
	if opt.NodeSpacing <= 0 {
		opt.NodeSpacing = 50.0
	}
	if opt.StartX <= 0 {
		opt.StartX = 80.0
	}
	if opt.StartY <= 0 {
		opt.StartY = 80.0
	}

	nodes := make([]BlockNode, len(initialNodes))
	copy(nodes, initialNodes)

	nodeMap := make(map[string]*BlockNode, len(nodes))
	for i := range nodes {
		nodeMap[nodes[i].ID] = &nodes[i]
	}

	// 1. CYCLE REMOVAL (DFS-based FAS)
	adj := make(map[string][]string, len(nodes))
	for _, n := range nodes {
		adj[n.ID] = []string{}
	}
	for _, e := range edges {
		adj[e.SourceBlockID] = append(adj[e.SourceBlockID], e.TargetBlockID)
	}

	visited := make(map[string]bool, len(nodes))
	recStack := make(map[string]bool, len(nodes))
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

	// 2. LAYER ASSIGNMENT (Longest Path layering)
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
	processed := make(map[string]bool, len(nodes))

	var currentLayer []string
	for _, n := range nodes {
		if inDegree[n.ID] == 0 {
			currentLayer = append(currentLayer, n.ID)
		}
	}
	if len(currentLayer) == 0 && len(nodes) > 0 {
		currentLayer = []string{nodes[0].ID}
	}

	for len(currentLayer) > 0 && len(layers) < 50 {
		layers = append(layers, currentLayer)
		for _, id := range currentLayer {
			processed[id] = true
			if node, ok := nodeMap[id]; ok {
				node.Layer = OptInt(len(layers) - 1)
			}
		}

		nextCandidatesMap := make(map[string]bool)
		for _, u := range currentLayer {
			for _, v := range adj[u] {
				if !reversedEdges[u+"->"+v] && !processed[v] {
					nextCandidatesMap[v] = true
				}
			}
		}

		var nextLayer []string
		for v := range nextCandidatesMap {
			allParentsDone := true
			for _, e := range edges {
				if e.TargetBlockID == v && !reversedEdges[e.SourceBlockID+"->"+v] {
					if !processed[e.SourceBlockID] {
						allParentsDone = false
						break
					}
				}
			}
			if allParentsDone {
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
	}

	// 3. CROSSING REDUCTION (Barycentric Sweep)
	type baryItem struct {
		id    string
		value float64
	}

	for iter := 0; iter < 4; iter++ {
		// Forward sweep
		for l := 1; l < len(layers); l++ {
			prevLayerNodes := layers[l-1]
			prevIndexMap := make(map[string]int, len(prevLayerNodes))
			for idx, id := range prevLayerNodes {
				prevIndexMap[id] = idx
			}

			barycenters := make([]baryItem, len(layers[l]))
			for i, nodeId := range layers[l] {
				sum := 0.0
				count := 0
				for _, e := range edges {
					if e.TargetBlockID == nodeId {
						if pIdx, ok := prevIndexMap[e.SourceBlockID]; ok {
							sum += float64(pIdx)
							count++
						}
					}
				}
				val := 0.0
				if count > 0 {
					val = sum / float64(count)
				}
				barycenters[i] = baryItem{id: nodeId, value: val}
			}

			sort.SliceStable(barycenters, func(i, j int) bool {
				return barycenters[i].value < barycenters[j].value
			})
			for i, b := range barycenters {
				layers[l][i] = b.id
			}
		}

		// Backward sweep
		for l := len(layers) - 2; l >= 0; l-- {
			nextLayerNodes := layers[l+1]
			nextIndexMap := make(map[string]int, len(nextLayerNodes))
			for idx, id := range nextLayerNodes {
				nextIndexMap[id] = idx
			}

			barycenters := make([]baryItem, len(layers[l]))
			for i, nodeId := range layers[l] {
				sum := 0.0
				count := 0
				for _, e := range edges {
					if e.SourceBlockID == nodeId {
						if nIdx, ok := nextIndexMap[e.TargetBlockID]; ok {
							sum += float64(nIdx)
							count++
						}
					}
				}
				val := 0.0
				if count > 0 {
					val = sum / float64(count)
				}
				barycenters[i] = baryItem{id: nodeId, value: val}
			}

			sort.SliceStable(barycenters, func(i, j int) bool {
				return barycenters[i].value < barycenters[j].value
			})
			for i, b := range barycenters {
				layers[l][i] = b.id
			}
		}
	}

	// 4. COORDINATE ASSIGNMENT
	layerWidths := make([]float64, len(layers))
	for l, layerNodeIds := range layers {
		maxW := 140.0
		for _, id := range layerNodeIds {
			if node, ok := nodeMap[id]; ok && node.Width > maxW {
				maxW = node.Width
			}
		}
		layerWidths[l] = maxW
	}

	layerXPositions := make([]float64, len(layers))
	currX := opt.StartX
	for l := range layers {
		layerXPositions[l] = currX
		currX += layerWidths[l] + opt.LayerSpacing
	}

	layerTotalHeights := make([]float64, len(layers))
	maxOverallHeight := 400.0
	for l, layerNodeIds := range layers {
		sumH := 0.0
		for _, id := range layerNodeIds {
			h := 80.0
			if node, ok := nodeMap[id]; ok && node.Height > 0 {
				h = node.Height
			}
			sumH += h + opt.NodeSpacing
		}
		if len(layerNodeIds) > 0 {
			sumH -= opt.NodeSpacing
		}
		layerTotalHeights[l] = sumH
		if sumH > maxOverallHeight {
			maxOverallHeight = sumH
		}
	}

	for lIdx, layerNodeIds := range layers {
		x := layerXPositions[lIdx]
		totH := layerTotalHeights[lIdx]
		currY := opt.StartY + math.Max(0.0, (maxOverallHeight-totH)/2.0)

		for orderIdx, id := range layerNodeIds {
			if node, ok := nodeMap[id]; ok {
				node.X = x
				node.Y = currY
				node.Layer = OptInt(lIdx)
				node.Order = OptInt(orderIdx)
				currY += node.Height + opt.NodeSpacing
			}
		}
	}

	// Pin alignment post-refinement
	for l := 1; l < len(layers); l++ {
		currentLayerNodeIds := layers[l]
		prevLayerSet := make(map[string]bool, len(layers[l-1]))
		for _, id := range layers[l-1] {
			prevLayerSet[id] = true
		}

		for _, id := range currentLayerNodeIds {
			node := nodeMap[id]
			if node == nil {
				continue
			}

			var directIncoming []EdgeConnection
			for _, e := range edges {
				if e.TargetBlockID == id && prevLayerSet[e.SourceBlockID] {
					directIncoming = append(directIncoming, e)
				}
			}

			if len(directIncoming) == 1 {
				edge := directIncoming[0]
				srcNode := nodeMap[edge.SourceBlockID]
				if srcNode != nil {
					srcPortPos := GetPortCoordinates(*srcNode, edge.SourcePortID, true)
					tgtRelY := GetPortCoordinates(BlockNode{
						ID: node.ID, Width: node.Width, Height: node.Height, Shape: node.Shape,
						Inputs: node.Inputs, Outputs: node.Outputs, Ports: node.Ports,
						X: 0, Y: 0,
					}, edge.TargetPortID, false).Y
					alignedY := math.Round((srcPortPos.Y-tgtRelY)/10.0) * 10.0

					canFit := true
					for _, peerId := range currentLayerNodeIds {
						if peerId == id {
							continue
						}
						peer := nodeMap[peerId]
						if peer == nil {
							continue
						}
						if !(alignedY+node.Height+25.0 < peer.Y || alignedY > peer.Y+peer.Height+25.0) {
							canFit = false
							break
						}
					}

					if canFit && alignedY >= opt.StartY {
						node.Y = alignedY
					}
				}
			}
		}
	}

	return nodes
}

// RunForceDirectedLayout executes physics-based spring-electrical layout with directional flow bias.
func RunForceDirectedLayout(initialNodes []BlockNode, edges []EdgeConnection, iterations int) []BlockNode {
	if len(initialNodes) == 0 {
		return nil
	}
	if iterations <= 0 {
		iterations = 120
	}

	nodes := make([]BlockNode, len(initialNodes))
	copy(nodes, initialNodes)

	nodeMap := make(map[string]*BlockNode, len(nodes))
	for i := range nodes {
		nodeMap[nodes[i].ID] = &nodes[i]
	}

	const (
		kRepulse        = 80000.0
		kSpring         = 0.05
		kFlow           = 0.4
		desiredDistance = 220.0
	)

	type force struct {
		fx, fy float64
	}

	for iter := 0; iter < iterations; iter++ {
		forces := make(map[string]force, len(nodes))

		// 1. Repulsion between all node pairs
		for i := 0; i < len(nodes); i++ {
			for j := i + 1; j < len(nodes); j++ {
				u := &nodes[i]
				v := &nodes[j]
				dx := (u.X + u.Width/2.0) - (v.X + v.Width/2.0)
				dy := (u.Y + u.Height/2.0) - (v.Y + v.Height/2.0)
				dist := math.Hypot(dx, dy)
				if dist < 1.0 {
					dist = 1.0
				}

				minDist := math.Max(u.Width, u.Height)/2.0 + math.Max(v.Width, v.Height)/2.0 + 40.0
				effectiveDist := math.Max(dist, 10.0)

				scale := 1.0
				if dist < minDist {
					scale = 2.5
				}
				repForce := (kRepulse / (effectiveDist * effectiveDist)) * scale
				fx := (dx / dist) * repForce
				fy := (dy / dist) * repForce

				fu := forces[u.ID]
				fu.fx += fx
				fu.fy += fy
				forces[u.ID] = fu

				fv := forces[v.ID]
				fv.fx -= fx
				fv.fy -= fy
				forces[v.ID] = fv
			}
		}

		// 2. Spring attraction along edges & Flow bias
		for _, e := range edges {
			u := nodeMap[e.SourceBlockID]
			v := nodeMap[e.TargetBlockID]
			if u == nil || v == nil {
				continue
			}

			uPortPos := GetPortCoordinates(*u, e.SourcePortID, true)
			vPortPos := GetPortCoordinates(*v, e.TargetPortID, false)

			dx := vPortPos.X - uPortPos.X
			dy := vPortPos.Y - uPortPos.Y
			dist := math.Hypot(dx, dy)
			if dist < 1.0 {
				dist = 1.0
			}

			displacement := dist - desiredDistance
			springForce := displacement * kSpring

			fx := (dx / dist) * springForce
			fy := (dy / dist) * springForce

			fu := forces[u.ID]
			fu.fx += fx
			fu.fy += fy

			fv := forces[v.ID]
			fv.fx -= fx
			fv.fy -= fy

			if u.X+u.Width > v.X-40.0 {
				overlapX := (u.X + u.Width) - (v.X - 40.0)
				fu.fx -= overlapX * kFlow
				fv.fx += overlapX * kFlow
			}

			forces[u.ID] = fu
			forces[v.ID] = fv
		}

		// 3. Apply displacement with cooling, honoring IsPinned
		temp := math.Max(0.05, 1.0-float64(iter)/float64(iterations))
		for i := range nodes {
			n := &nodes[i]
			if n.IsPinned {
				continue // Invariant: pinned anchor nodes never move
			}

			f := forces[n.ID]
			moveX := math.Max(-25.0, math.Min(25.0, f.fx*0.1*temp))
			moveY := math.Max(-25.0, math.Min(25.0, f.fy*0.1*temp))

			n.X = math.Round(math.Max(40.0, n.X+moveX))
			n.Y = math.Round(math.Max(40.0, n.Y+moveY))
		}
	}

	return nodes
}

// RunOrthogonalGridLayout places nodes in a discrete matrix channel grid.
func RunOrthogonalGridLayout(initialNodes []BlockNode, edges []EdgeConnection) []BlockNode {
	if len(initialNodes) == 0 {
		return nil
	}

	nodes := make([]BlockNode, len(initialNodes))
	copy(nodes, initialNodes)

	inDeg := make(map[string]int, len(nodes))
	outDeg := make(map[string]int, len(nodes))
	for _, n := range nodes {
		inDeg[n.ID] = 0
		outDeg[n.ID] = 0
	}
	for _, e := range edges {
		outDeg[e.SourceBlockID]++
		inDeg[e.TargetBlockID]++
	}

	sort.SliceStable(nodes, func(i, j int) bool {
		scoreA := inDeg[nodes[i].ID]*10 - outDeg[nodes[i].ID]
		scoreB := inDeg[nodes[j].ID]*10 - outDeg[nodes[j].ID]
		return scoreA < scoreB
	})

	cols := int(math.Max(2.0, math.Ceil(math.Sqrt(float64(len(nodes))*1.5))))
	const (
		cellWidth  = 240.0
		cellHeight = 160.0
		originX    = 80.0
		originY    = 80.0
	)

	for index := range nodes {
		col := index % cols
		row := index / cols
		nodes[index].X = originX + float64(col)*cellWidth
		nodes[index].Y = originY + float64(row)*cellHeight
	}

	return nodes
}
