package core

import (
	"testing"
)

func TestRunUnifiedCoOptimization_BasicPipeline(t *testing.T) {
	nodes := []BlockNode{
		{
			ID:     "n1",
			Title:  "Sensor",
			Shape:  "rectangle",
			X:      50,
			Y:      100,
			Width:  120,
			Height: 60,
			Outputs: []Port{
				{ID: "p1", Name: "Data", Side: SideRight, Type: "output"},
			},
		},
		{
			ID:     "n2",
			Title:  "DSP Filter",
			Shape:  "rectangle",
			X:      50,
			Y:      300,
			Width:  120,
			Height: 60,
			Inputs: []Port{
				{ID: "p2", Name: "In", Side: SideLeft, Type: "input"},
			},
			Outputs: []Port{
				{ID: "p3", Name: "Out", Side: SideRight, Type: "output"},
			},
		},
		{
			ID:     "n3",
			Title:  "Actuator",
			Shape:  "rectangle",
			X:      50,
			Y:      500,
			Width:  120,
			Height: 60,
			Inputs: []Port{
				{ID: "p4", Name: "In", Side: SideLeft, Type: "input"},
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
		{
			ID:            "e2",
			SourceBlockID: "n2",
			SourcePortID:  "p3",
			TargetBlockID: "n3",
			TargetPortID:  "p4",
		},
	}

	opts := DefaultRoutingOptions()
	res := RunUnifiedCoOptimization(nodes, edges, opts)

	if len(res.Nodes) != 3 {
		t.Fatalf("Expected 3 nodes in result, got %d", len(res.Nodes))
	}
	if len(res.Edges) != 2 {
		t.Fatalf("Expected 2 edges in result, got %d", len(res.Edges))
	}

	// Verify layer assignments: n1 -> Layer 0, n2 -> Layer 1, n3 -> Layer 2
	var n1, n2, n3 *BlockNode
	for i := range res.Nodes {
		switch res.Nodes[i].ID {
		case "n1":
			n1 = &res.Nodes[i]
		case "n2":
			n2 = &res.Nodes[i]
		case "n3":
			n3 = &res.Nodes[i]
		}
	}

	if n1 == nil || n2 == nil || n3 == nil {
		t.Fatalf("Missing nodes in result")
	}

	if n1.Layer == nil || *n1.Layer != 0 {
		t.Errorf("Expected n1 at Layer 0, got %v", n1.Layer)
	}
	if n2.Layer == nil || *n2.Layer != 1 {
		t.Errorf("Expected n2 at Layer 1, got %v", n2.Layer)
	}
	if n3.Layer == nil || *n3.Layer != 2 {
		t.Errorf("Expected n3 at Layer 2, got %v", n3.Layer)
	}

	// Layer X positioning should flow from left to right
	if !(n1.X < n2.X && n2.X < n3.X) {
		t.Errorf("Expected left-to-right topological layout: n1.X=%.1f, n2.X=%.1f, n3.X=%.1f", n1.X, n2.X, n3.X)
	}

	if res.StraightWiresCount < 1 {
		t.Errorf("Expected at least 1 straight 0-bend wire created by pin-alignment, got %d", res.StraightWiresCount)
	}

	if len(res.Steps) != 3 {
		t.Errorf("Expected 3 algorithm progression steps, got %d", len(res.Steps))
	}
}
