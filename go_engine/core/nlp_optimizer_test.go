package core

import (
	"math"
	"testing"
)

func TestDefaultNLPParams(t *testing.T) {
	params := DefaultNLPParams()
	if params.OptimalBlockDistance != 220.0 {
		t.Errorf("Expected OptimalBlockDistance 220.0, got %f", params.OptimalBlockDistance)
	}
	if params.OptimalWireDistance != 24.0 {
		t.Errorf("Expected OptimalWireDistance 24.0, got %f", params.OptimalWireDistance)
	}
	if params.WirelengthWeight != 40.0 {
		t.Errorf("Expected WirelengthWeight 40.0, got %f", params.WirelengthWeight)
	}
	if !params.FreezePinnedNodes {
		t.Errorf("Expected FreezePinnedNodes true, got false")
	}
}

func TestCalculateNLPOptimalityBreakdown_FiniteAndDeterministic(t *testing.T) {
	nodes := []BlockNode{
		{
			ID:     "n1",
			Title:  "Source",
			Shape:  "rectangle",
			X:      50,
			Y:      50,
			Width:  120,
			Height: 60,
			Outputs: []Port{
				{ID: "p1", Side: SideRight, Type: "output"},
			},
			IsPinned: true,
		},
		{
			ID:     "n2",
			Title:  "Processor",
			Shape:  "rectangle",
			X:      300,
			Y:      50,
			Width:  120,
			Height: 60,
			Inputs: []Port{
				{ID: "p2", Side: SideLeft, Type: "input"},
			},
			Outputs: []Port{
				{ID: "p3", Side: SideRight, Type: "output"},
			},
		},
		{
			ID:     "n3",
			Title:  "Sink",
			Shape:  "rectangle",
			X:      600,
			Y:      50,
			Width:  120,
			Height: 60,
			Inputs: []Port{
				{ID: "p4", Side: SideLeft, Type: "input"},
			},
		},
	}

	edges := []EdgeConnection{
		{
			ID:            "e1",
			SourceBlockID: "n1",
			SourcePortID:  "p1",
			TargetBlockID: "n2",
			TargetPortID:  "p2",
			Label:         "Data Stream",
			Path: []Point{
				{X: 170, Y: 80},
				{X: 300, Y: 80},
			},
		},
		{
			ID:            "e2",
			SourceBlockID: "n2",
			SourcePortID:  "p3",
			TargetBlockID: "n3",
			TargetPortID:  "p4",
			Label:         "Processed",
			Path: []Point{
				{X: 420, Y: 80},
				{X: 600, Y: 80},
			},
		},
	}

	params := DefaultNLPParams()
	breakdown1 := CalculateNLPOptimalityBreakdown(nodes, edges, params)
	breakdown2 := CalculateNLPOptimalityBreakdown(nodes, edges, params)

	if math.IsNaN(breakdown1.OverallCostValue) || math.IsInf(breakdown1.OverallCostValue, 0) {
		t.Fatalf("OverallCostValue must be finite, got %f", breakdown1.OverallCostValue)
	}

	if breakdown1.OverallCostValue != breakdown2.OverallCostValue {
		t.Errorf("Determinism violation: %f != %f", breakdown1.OverallCostValue, breakdown2.OverallCostValue)
	}

	if breakdown1.TotalWirelength <= 0 {
		t.Errorf("Expected TotalWirelength > 0, got %f", breakdown1.TotalWirelength)
	}
}

func TestRunNLPOptimization_PinnedInvariance(t *testing.T) {
	nodes := []BlockNode{
		{
			ID:       "anchor",
			Title:    "Fixed Anchor",
			Shape:    "rectangle",
			X:        100,
			Y:        100,
			Width:    120,
			Height:   60,
			IsPinned: true,
			Outputs: []Port{
				{ID: "p1", Side: SideRight, Type: "output"},
			},
		},
		{
			ID:     "free_node",
			Title:  "Free Node",
			Shape:  "rectangle",
			X:      500,
			Y:      400,
			Width:  120,
			Height: 60,
			Inputs: []Port{
				{ID: "p2", Side: SideLeft, Type: "input"},
			},
		},
	}

	edges := []EdgeConnection{
		{
			ID:            "e1",
			SourceBlockID: "anchor",
			SourcePortID:  "p1",
			TargetBlockID: "free_node",
			TargetPortID:  "p2",
		},
	}

	opts := DefaultRoutingOptions()
	params := DefaultNLPParams()
	params.Iterations = 30

	res := RunNLPOptimization(nodes, edges, opts, &params)

	var anchorAfter *BlockNode
	for i := range res.Nodes {
		if res.Nodes[i].ID == "anchor" {
			anchorAfter = &res.Nodes[i]
			break
		}
	}

	if anchorAfter == nil {
		t.Fatalf("Anchor node not found in result")
	}

	if anchorAfter.X != 100 || anchorAfter.Y != 100 {
		t.Errorf("Pinned node anchor violated invariance: moved to (%.1f, %.1f), expected (100, 100)", anchorAfter.X, anchorAfter.Y)
	}
}

func TestRunNLPOptimization_ConvergenceAndProgress(t *testing.T) {
	nodes := []BlockNode{
		{
			ID:       "n1",
			Title:    "Input",
			Shape:    "rectangle",
			X:        50,
			Y:        200,
			Width:    100,
			Height:   60,
			IsPinned: true,
			Outputs: []Port{
				{ID: "p1", Side: SideRight, Type: "output"},
			},
		},
		{
			ID:     "n2",
			Title:  "Misplaced Far Away",
			Shape:  "rectangle",
			X:      1200,
			Y:      900,
			Width:  100,
			Height: 60,
			Inputs: []Port{
				{ID: "p2", Side: SideLeft, Type: "input"},
			},
		},
	}

	edges := []EdgeConnection{
		{
			ID:            "e1",
			SourceBlockID: "n1",
			SourcePortID:  "p1",
			TargetBlockID: "n2",
			TargetPortID:  "p2",
		},
	}

	opts := DefaultRoutingOptions()
	params := DefaultNLPParams()
	params.Iterations = 45

	res := RunNLPOptimization(nodes, edges, opts, &params)

	if len(res.History) == 0 {
		t.Errorf("Expected non-empty iteration history")
	}

	if len(res.Steps) == 0 {
		t.Errorf("Expected non-empty algorithm steps")
	}

	// Cost after NLP optimization should decrease wirelength
	var n2After *BlockNode
	for i := range res.Nodes {
		if res.Nodes[i].ID == "n2" {
			n2After = &res.Nodes[i]
			break
		}
	}

	if n2After == nil {
		t.Fatalf("n2 not found in result")
	}

	distAfter := math.Hypot(n2After.X-50, n2After.Y-200)
	initialDist := math.Hypot(1200-50, 900-200)

	if distAfter >= initialDist {
		t.Errorf("Expected NLP to pull connected node closer: initial dist=%.1f, after=%.1f", initialDist, distAfter)
	}
}
