package core

import (
	"fmt"
	"testing"
)

func generateSyntheticScene(nodeCount, edgeCount int) ([]BlockNode, []EdgeConnection) {
	nodes := make([]BlockNode, nodeCount)
	cols := 10
	for i := 0; i < nodeCount; i++ {
		row := i / cols
		col := i % cols
		nodes[i] = BlockNode{
			ID:       fmt.Sprintf("n_%d", i),
			Title:    fmt.Sprintf("Node %d", i),
			Category: "processor",
			Shape:    "rectangle",
			X:        float64(col * 220),
			Y:        float64(row * 150),
			Width:    120,
			Height:   60,
			Inputs: []Port{
				{ID: "in1", Name: "In", Side: SideLeft, Type: "input"},
			},
			Outputs: []Port{
				{ID: "out1", Name: "Out", Side: SideRight, Type: "output"},
			},
		}
	}

	edges := make([]EdgeConnection, edgeCount)
	for i := 0; i < edgeCount; i++ {
		srcIdx := i % nodeCount
		tgtIdx := (i + 1 + (i / nodeCount)) % nodeCount
		if srcIdx == tgtIdx {
			tgtIdx = (srcIdx + 1) % nodeCount
		}
		edges[i] = EdgeConnection{
			ID:            fmt.Sprintf("e_%d", i),
			SourceBlockID: nodes[srcIdx].ID,
			SourcePortID:  "out1",
			TargetBlockID: nodes[tgtIdx].ID,
			TargetPortID:  "in1",
		}
	}

	return nodes, edges
}

func TestSpatialIndex_Queries(t *testing.T) {
	nodes, _ := generateSyntheticScene(20, 20)
	idx := NewSceneSpatialIndex(nodes, 12.0)

	// Inside node 0 (X=0..120, Y=0..60, with clearance -12..132, -12..72)
	blockedPt := Point{X: 50, Y: 30}
	if !idx.IsPointBlocked(blockedPt, "", "") {
		t.Errorf("Expected (50, 30) inside node 0 to be blocked")
	}

	// Far outside all nodes
	freePt := Point{X: 9999, Y: 9999}
	if idx.IsPointBlocked(freePt, "", "") {
		t.Errorf("Expected (9999, 9999) to be free")
	}

	// Segment crossing through node 0
	crossingSegP1 := Point{X: -50, Y: 30}
	crossingSegP2 := Point{X: 200, Y: 30}
	if !idx.IsSegmentBlocked(crossingSegP1, crossingSegP2, "", "") {
		t.Errorf("Expected horizontal segment crossing node 0 to be blocked")
	}
}

func TestSparseVisibilityGraph_Roadmap(t *testing.T) {
	nodes := []BlockNode{
		{
			ID: "a", X: 50, Y: 50, Width: 100, Height: 60,
			Outputs: []Port{{ID: "out", Side: SideRight, Type: "output"}},
		},
		{
			ID: "b", X: 350, Y: 50, Width: 100, Height: 60,
			Inputs: []Port{{ID: "in", Side: SideLeft, Type: "input"}},
		},
	}

	svg := BuildSparseVisibilityGraph(nodes, 12.0)
	if len(svg.Vertices) == 0 {
		t.Fatalf("Expected visibility vertices to be generated")
	}

	path := svg.Route(Point{X: 150, Y: 80}, Point{X: 350, Y: 80}, "a", "b")
	if len(path) < 2 {
		t.Fatalf("Expected sparse visibility path found, got length %d", len(path))
	}
}

func TestGlobalRouter_DifficultFirstAndRipUp(t *testing.T) {
	nodes, edges := generateSyntheticScene(12, 16)
	opts := DefaultRoutingOptions()

	routed := RouteGlobalCoordinated(nodes, edges, opts, nil)
	if len(routed) != len(edges) {
		t.Fatalf("Expected all %d edges routed, got %d", len(edges), len(routed))
	}

	for _, e := range routed {
		if len(e.Path) < 2 {
			t.Errorf("Edge %s has invalid path: %v", e.ID, e.Path)
		}
	}
}

func Benchmark100Nodes200Edges_Performance(b *testing.B) {
	nodes, edges := generateSyntheticScene(100, 200)
	opts := DefaultRoutingOptions()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = RouteGlobalCoordinated(nodes, edges, opts, nil)
	}
}
