package core

import (
	"context"
	"testing"
)

func TestRoutingOptionsBuilder(t *testing.T) {
	opts := NewRoutingOptionsBuilder().
		WithGridSize(12.0).
		WithObstacleClearance(20.0).
		WithBendPenalty(40.0).
		WithCrossingPenalty(60.0).
		WithChannelSpacing(18.0).
		WithPortExitOffset(25.0).
		WithAdaptivePortExitOffset(true).
		WithSmoothCorners(true, 10.0).
		WithJumpBridges(true).
		WithArtifactCleaning(true).
		WithPinAlignment(true).
		Build()

	if opts.GridSize != 12.0 {
		t.Fatalf("expected GridSize 12.0, got %f", opts.GridSize)
	}
	if opts.ObstacleClearance != 20.0 {
		t.Fatalf("expected ObstacleClearance 20.0, got %f", opts.ObstacleClearance)
	}
	if opts.SmoothCorners == nil || !*opts.SmoothCorners {
		t.Fatalf("expected SmoothCorners true")
	}
	if opts.CornerRadius == nil || *opts.CornerRadius != 10.0 {
		t.Fatalf("expected CornerRadius 10.0")
	}
	if opts.JumpBridges == nil || !*opts.JumpBridges {
		t.Fatalf("expected JumpBridges true")
	}
}

func TestNLPOptimizationParamsBuilder(t *testing.T) {
	params := NewNLPOptimizationParamsBuilder().
		WithIterations(250).
		WithLearningRate(0.05).
		WithMomentum(0.85).
		WithFreezePinnedNodes(true).
		Build()

	if params.Iterations != 250 {
		t.Fatalf("expected Iterations 250, got %d", params.Iterations)
	}
	if params.LearningRate != 0.05 {
		t.Fatalf("expected LearningRate 0.05, got %f", params.LearningRate)
	}
	if params.Momentum != 0.85 {
		t.Fatalf("expected Momentum 0.85, got %f", params.Momentum)
	}
	if !params.FreezePinnedNodes {
		t.Fatalf("expected FreezePinnedNodes true")
	}
}

func TestRouterRegistryAndPluggableRouters(t *testing.T) {
	registry := DefaultRouterRegistry()

	algorithms := []string{
		"orthogonal-a-star",
		"manhattan-channel",
		"lee-wave",
		"smooth-splines",
		"global-coordinated",
	}

	nodes := []BlockNode{
		{ID: "A", X: 10, Y: 10, Width: 50, Height: 50, Outputs: []Port{{ID: "p1", Side: SideRight}}},
		{ID: "B", X: 200, Y: 100, Width: 50, Height: 50, Inputs: []Port{{ID: "p2", Side: SideLeft}}},
	}
	edges := []EdgeConnection{
		{ID: "e1", SourceBlockID: "A", SourcePortID: "p1", TargetBlockID: "B", TargetPortID: "p2"},
	}
	opts := DefaultRoutingOptions()

	for _, algo := range algorithms {
		router, ok := registry.Get(algo)
		if !ok {
			t.Fatalf("router %q not found in registry", algo)
		}
		if router.Name() != algo {
			t.Fatalf("router.Name() = %q, expected %q", router.Name(), algo)
		}

		routed, err := RouteWithAlgorithm(context.Background(), algo, nodes, edges, opts)
		if err != nil {
			t.Fatalf("RouteWithAlgorithm(%q) returned error: %v", algo, err)
		}
		if len(routed) != 1 {
			t.Fatalf("RouteWithAlgorithm(%q) expected 1 edge, got %d", algo, len(routed))
		}
		if len(routed[0].Path) < 2 {
			t.Fatalf("RouteWithAlgorithm(%q) path too short: %d waypoints", algo, len(routed[0].Path))
		}
	}
}

func TestContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Immediately cancelled

	nodes := []BlockNode{
		{ID: "A", X: 10, Y: 10, Width: 50, Height: 50, Outputs: []Port{{ID: "p1", Side: SideRight}}},
		{ID: "B", X: 200, Y: 100, Width: 50, Height: 50, Inputs: []Port{{ID: "p2", Side: SideLeft}}},
	}
	edges := []EdgeConnection{
		{ID: "e1", SourceBlockID: "A", SourcePortID: "p1", TargetBlockID: "B", TargetPortID: "p2"},
	}
	opts := DefaultRoutingOptions()

	// 1. RouteWithContext
	_, err := RouteWithContext(ctx, RouteRequest{
		GraphID: "cancelled-test",
		Nodes:   nodes,
		Edges:   edges,
		Options: opts,
	})
	if err == nil {
		t.Fatalf("expected error on cancelled context, got nil")
	}

	// 2. Scene Engine with cancelled context
	engine := NewEngine()
	_, err = engine.OpenWithContext(ctx, SceneOpenRequest{
		GraphID: "cancelled-scene",
		Nodes:   nodes,
		Edges:   edges,
		Options: opts,
	})
	if err == nil {
		t.Fatalf("expected error on cancelled SceneOpen context, got nil")
	}
}
