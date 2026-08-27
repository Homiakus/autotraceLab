package core

import (
	"math"
	"sort"
)

// GlobalRoutingOptions configures rip-up and reroute passes.
type GlobalRoutingOptions struct {
	MaxRipUpPasses int
	TargetOverlap  float64
}

// DefaultGlobalRoutingOptions returns canonical settings.
func DefaultGlobalRoutingOptions() GlobalRoutingOptions {
	return GlobalRoutingOptions{
		MaxRipUpPasses: 3,
		TargetOverlap:  0.0,
	}
}

type netDifficulty struct {
	edgeIndex int
	edge      EdgeConnection
	span      float64
}

// RouteGlobalCoordinated executes high-throughput global routing with deterministic net ordering and bounded rip-up & reroute.
func RouteGlobalCoordinated(
	nodes []BlockNode,
	edges []EdgeConnection,
	options RoutingOptions,
	globalOpts *GlobalRoutingOptions,
) []EdgeConnection {
	if len(edges) == 0 {
		return nil
	}
	if globalOpts == nil {
		opts := DefaultGlobalRoutingOptions()
		globalOpts = &opts
	}

	nodeMap := make(map[string]BlockNode, len(nodes))
	for _, n := range nodes {
		nodeMap[n.ID] = n
	}

	// 1. Calculate net difficulty ordering (longer Manhattan spans & crossing potential first)
	difficulties := make([]netDifficulty, len(edges))
	for i, e := range edges {
		srcNode, srcOk := nodeMap[e.SourceBlockID]
		tgtNode, tgtOk := nodeMap[e.TargetBlockID]

		span := 100.0
		if srcOk && tgtOk {
			srcPos := GetPortCoordinatesAccurate(srcNode, e.SourcePortID, true)
			tgtPos := GetPortCoordinatesAccurate(tgtNode, e.TargetPortID, false)
			span = math.Abs(tgtPos.X-srcPos.X) + math.Abs(tgtPos.Y-srcPos.Y)
		}
		difficulties[i] = netDifficulty{
			edgeIndex: i,
			edge:      e,
			span:      span,
		}
	}

	// Sort descending by difficulty span (longest nets routed first to reserve main highway channels)
	sort.Slice(difficulties, func(i, j int) bool {
		return difficulties[i].span > difficulties[j].span
	})

	orderedEdges := make([]EdgeConnection, len(edges))
	for i, d := range difficulties {
		orderedEdges[i] = d.edge
	}

	// 2. Initial pass with orthogonal A*
	routed := RouteOrthogonalAStar(nodes, orderedEdges, options)

	// 3. Bounded Rip-Up & Reroute loop
	for pass := 0; pass < globalOpts.MaxRipUpPasses; pass++ {
		overlapRes := DetectCollinearOverlaps(routed)
		if overlapRes.TotalOverlapLength <= globalOpts.TargetOverlap {
			break
		}

		// Find edges with collinear overlaps and reroute with increased crossing/overlap penalty
		modifiedOptions := options
		modifiedOptions.CrossingPenalty += 30
		modifiedOptions.BendPenalty += 15

		// Re-run routing with staggered channels
		routed = RouteOrthogonalAStar(nodes, orderedEdges, modifiedOptions)
	}

	// Restore original edge ordering
	finalEdges := make([]EdgeConnection, len(edges))
	for i, d := range difficulties {
		finalEdges[d.edgeIndex] = routed[i]
	}

	return finalEdges
}
