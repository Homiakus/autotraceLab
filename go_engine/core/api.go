package core

import (
	"context"
	"fmt"
	"math"
	"time"
)

type RouteRequest struct {
	GraphID string          `json:"graphId"`
	Nodes   []BlockNode     `json:"nodes"`
	Edges   []EdgeConnection `json:"edges"`
	Options RoutingOptions  `json:"options"`
}

type RouteResult struct {
	GraphID         string           `json:"graphId"`
	Edges           []EdgeConnection `json:"edges"`
	Metrics         BenchmarkMetrics `json:"metrics"`
	DurationMs      float64          `json:"durationMs"`
	Engine          string           `json:"engine"`
	ContractVersion int              `json:"contractVersion"`
}

func ValidateScene(nodes []BlockNode, edges []EdgeConnection) error {
	ids := make(map[string]BlockNode, len(nodes))
	ports := make(map[string]struct{})
	for _, node := range nodes {
		if node.ID == "" {
			return fmt.Errorf("node id is required")
		}
		if _, exists := ids[node.ID]; exists {
			return fmt.Errorf("duplicate node id %q", node.ID)
		}
		if !finite(node.X) || !finite(node.Y) || !finite(node.Width) || !finite(node.Height) {
			return fmt.Errorf("node %q contains non-finite geometry", node.ID)
		}
		if node.Width < 0 || node.Height < 0 {
			return fmt.Errorf("node %q dimensions must be non-negative", node.ID)
		}
		ids[node.ID] = node
		for _, port := range append(append([]Port(nil), node.Inputs...), node.Outputs...) {
			if port.ID == "" {
				return fmt.Errorf("node %q contains empty port id", node.ID)
			}
			key := node.ID + "\x00" + port.ID
			if _, exists := ports[key]; exists {
				return fmt.Errorf("duplicate port %q in node %q", port.ID, node.ID)
			}
			ports[key] = struct{}{}
		}
	}
	edgeIDs := make(map[string]struct{}, len(edges))
	for _, edge := range edges {
		if edge.ID == "" {
			return fmt.Errorf("edge id is required")
		}
		if _, exists := edgeIDs[edge.ID]; exists {
			return fmt.Errorf("duplicate edge id %q", edge.ID)
		}
		edgeIDs[edge.ID] = struct{}{}
		if _, ok := ids[edge.SourceBlockID]; !ok {
			return fmt.Errorf("edge %q source block %q does not exist", edge.ID, edge.SourceBlockID)
		}
		if _, ok := ids[edge.TargetBlockID]; !ok {
			return fmt.Errorf("edge %q target block %q does not exist", edge.ID, edge.TargetBlockID)
		}
		if edge.SourcePortID != "" {
			if _, ok := ports[edge.SourceBlockID+"\x00"+edge.SourcePortID]; !ok {
				return fmt.Errorf("edge %q source port %q does not exist", edge.ID, edge.SourcePortID)
			}
		}
		if edge.TargetPortID != "" {
			if _, ok := ports[edge.TargetBlockID+"\x00"+edge.TargetPortID]; !ok {
				return fmt.Errorf("edge %q target port %q does not exist", edge.ID, edge.TargetPortID)
			}
		}
	}
	return nil
}

// Route executes orthogonal A* path planning synchronously.
func Route(request RouteRequest) (RouteResult, error) {
	return RouteWithContext(context.Background(), request)
}

// RouteWithContext executes path planning with context cancellation support.
func RouteWithContext(ctx context.Context, request RouteRequest) (RouteResult, error) {
	if err := ctx.Err(); err != nil {
		return RouteResult{}, err
	}
	if err := ValidateScene(request.Nodes, request.Edges); err != nil {
		return RouteResult{}, err
	}
	started := time.Now()
	edges := RouteOrthogonalAStar(request.Nodes, request.Edges, request.Options)
	if err := ctx.Err(); err != nil {
		return RouteResult{}, err
	}
	duration := float64(time.Since(started).Microseconds()) / 1000
	metrics := CalculateBenchmarkMetrics(request.Nodes, edges, duration, "preserve-input-layout", "orthogonal-a-star")
	return RouteResult{
		GraphID:         request.GraphID,
		Edges:           edges,
		Metrics:         metrics,
		DurationMs:      duration,
		Engine:          EngineID,
		ContractVersion: ContractVersion,
	}, nil
}

func finite(value float64) bool { return !math.IsNaN(value) && !math.IsInf(value, 0) }

