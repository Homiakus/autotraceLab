package core

import (
	"testing"
)

func sampleLayoutScene() ([]BlockNode, []EdgeConnection) {
	nodes := []BlockNode{
		{
			ID:       "n1",
			Title:    "Node 1",
			Category: "source",
			Shape:    "rectangle",
			X:        50,
			Y:        50,
			Width:    120,
			Height:   80,
			Outputs:  []Port{{ID: "p1_out", Side: SideRight, Type: "output"}},
			IsPinned: true, // Anchor block
		},
		{
			ID:       "n2",
			Title:    "Node 2",
			Category: "processor",
			Shape:    "rectangle",
			X:        50,
			Y:        50, // Initially overlapping n1
			Width:    120,
			Height:   80,
			Inputs:   []Port{{ID: "p2_in", Side: SideLeft, Type: "input"}},
			Outputs:  []Port{{ID: "p2_out", Side: SideRight, Type: "output"}},
		},
		{
			ID:       "n3",
			Title:    "Node 3",
			Category: "sink",
			Shape:    "rectangle",
			X:        50,
			Y:        50, // Initially overlapping
			Width:    120,
			Height:   80,
			Inputs:   []Port{{ID: "p3_in", Side: SideLeft, Type: "input"}},
		},
	}

	edges := []EdgeConnection{
		{ID: "e1", SourceBlockID: "n1", SourcePortID: "p1_out", TargetBlockID: "n2", TargetPortID: "p2_in"},
		{ID: "e2", SourceBlockID: "n2", SourcePortID: "p2_out", TargetBlockID: "n3", TargetPortID: "p3_in"},
	}

	return nodes, edges
}

func TestRunSugiyamaLayout(t *testing.T) {
	nodes, edges := sampleLayoutScene()
	opt := DefaultSugiyamaOptions()

	laidOut := RunSugiyamaLayout(nodes, edges, opt)
	if len(laidOut) != 3 {
		t.Fatalf("Expected 3 laid out nodes, got %d", len(laidOut))
	}

	nodeMap := make(map[string]BlockNode, len(laidOut))
	for _, n := range laidOut {
		nodeMap[n.ID] = n
	}

	// Verify left-to-right flow hierarchy
	n1, n2, n3 := nodeMap["n1"], nodeMap["n2"], nodeMap["n3"]
	if !(n1.X < n2.X && n2.X < n3.X) {
		t.Errorf("Sugiyama layout did not produce left-to-right flow: X1=%.1f, X2=%.1f, X3=%.1f", n1.X, n2.X, n3.X)
	}
	l1, l2, l3 := IntVal(n1.Layer, -1), IntVal(n2.Layer, -1), IntVal(n3.Layer, -1)
	if !(l1 < l2 && l2 < l3) {
		t.Errorf("Sugiyama layer indices invalid: L1=%d, L2=%d, L3=%d", l1, l2, l3)
	}
}

func TestRunForceDirectedLayout(t *testing.T) {
	nodes, edges := sampleLayoutScene()

	// Initial position of pinned anchor
	pinnedInitialX := nodes[0].X
	pinnedInitialY := nodes[0].Y

	laidOut := RunForceDirectedLayout(nodes, edges, 60)
	if len(laidOut) != 3 {
		t.Fatalf("Expected 3 laid out nodes, got %d", len(laidOut))
	}

	nodeMap := make(map[string]BlockNode, len(laidOut))
	for _, n := range laidOut {
		nodeMap[n.ID] = n
	}

	// 1. Strict Pinned Anchor Invariant: Pinned block must NOT move
	n1 := nodeMap["n1"]
	if n1.X != pinnedInitialX || n1.Y != pinnedInitialY {
		t.Errorf("CRITICAL HARD INVARIANT VIOLATION: Pinned node moved from (%.1f, %.1f) to (%.1f, %.1f)",
			pinnedInitialX, pinnedInitialY, n1.X, n1.Y)
	}

	// 2. Overlap separation: n2 and n3 must have moved away from n1
	n2, n3 := nodeMap["n2"], nodeMap["n3"]
	if n2.X == n1.X && n2.Y == n1.Y {
		t.Errorf("Node n2 did not separate from n1: (%.1f, %.1f)", n2.X, n2.Y)
	}
	if n3.X == n2.X && n3.Y == n2.Y {
		t.Errorf("Node n3 did not separate from n2: (%.1f, %.1f)", n3.X, n3.Y)
	}
}

func TestRunOrthogonalGridLayout(t *testing.T) {
	nodes, edges := sampleLayoutScene()

	laidOut := RunOrthogonalGridLayout(nodes, edges)
	if len(laidOut) != 3 {
		t.Fatalf("Expected 3 laid out nodes, got %d", len(laidOut))
	}

	// Verify all nodes have distinct non-zero coordinates
	posMap := make(map[string]bool)
	for _, n := range laidOut {
		key := string(rune(int(n.X))) + "," + string(rune(int(n.Y)))
		if posMap[key] {
			t.Errorf("Orthogonal grid assigned duplicate matrix slot to node %s at (%.1f, %.1f)", n.ID, n.X, n.Y)
		}
		posMap[key] = true
	}
}
