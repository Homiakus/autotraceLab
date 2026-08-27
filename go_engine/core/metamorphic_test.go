package core

import (
	"math"
	"testing"
)

// 1. Translation Invariance: Route(N + v, E) == Route(N, E) + v
func TestMetamorphicTranslationInvariance(t *testing.T) {
	nodes := []BlockNode{
		{
			ID:       "n1",
			Title:    "Source",
			Category: "source",
			Shape:    "rectangle",
			X:        100,
			Y:        100,
			Width:    120,
			Height:   80,
			Outputs:  []Port{{ID: "out", Side: SideRight, Type: "output"}},
		},
		{
			ID:       "obs",
			Title:    "Obstacle",
			Category: "processor",
			Shape:    "rectangle",
			X:        260,
			Y:        80,
			Width:    80,
			Height:   120,
		},
		{
			ID:       "n2",
			Title:    "Target",
			Category: "sink",
			Shape:    "rectangle",
			X:        400,
			Y:        100,
			Width:    120,
			Height:   80,
			Inputs:   []Port{{ID: "in", Side: SideLeft, Type: "input"}},
		},
	}

	edges := []EdgeConnection{
		{
			ID:            "e1",
			SourceBlockID: "n1",
			SourcePortID:  "out",
			TargetBlockID: "n2",
			TargetPortID:  "in",
		},
	}

	options := DefaultRoutingOptions()
	baseRouted := RouteOrthogonalAStar(nodes, edges, options)
	if len(baseRouted) == 0 || len(baseRouted[0].Path) == 0 {
		t.Fatal("Base route failed")
	}

	dx, dy := 200.0, 300.0
	translatedNodes := make([]BlockNode, len(nodes))
	for i, n := range nodes {
		clone := n
		clone.X += dx
		clone.Y += dy
		translatedNodes[i] = clone
	}

	translatedRouted := RouteOrthogonalAStar(translatedNodes, edges, options)
	if len(translatedRouted) == 0 || len(translatedRouted[0].Path) != len(baseRouted[0].Path) {
		t.Fatalf("Translated route point count mismatch: got %d, want %d",
			len(translatedRouted[0].Path), len(baseRouted[0].Path))
	}

	for i := range baseRouted[0].Path {
		basePt := baseRouted[0].Path[i]
		transPt := translatedRouted[0].Path[i]

		expectedX := basePt.X + dx
		expectedY := basePt.Y + dy

		if math.Abs(transPt.X-expectedX) > 1e-4 || math.Abs(transPt.Y-expectedY) > 1e-4 {
			t.Errorf("Point %d translation mismatch: got (%.1f, %.1f), want (%.1f, %.1f)",
				i, transPt.X, transPt.Y, expectedX, expectedY)
		}
	}
}

// 2. Input-Order Permutation Stability
func TestMetamorphicPermutationStability(t *testing.T) {
	nodeA := BlockNode{
		ID:       "n1",
		Title:    "N1",
		Category: "source",
		Shape:    "rectangle",
		X:        100,
		Y:        100,
		Width:    120,
		Height:   80,
		Outputs:  []Port{{ID: "p1", Side: SideRight, Type: "output"}},
	}
	nodeB := BlockNode{
		ID:       "n2",
		Title:    "N2",
		Category: "sink",
		Shape:    "rectangle",
		X:        300,
		Y:        100,
		Width:    120,
		Height:   80,
		Inputs:   []Port{{ID: "p2", Side: SideLeft, Type: "input"}},
	}

	edges := []EdgeConnection{
		{ID: "e1", SourceBlockID: "n1", SourcePortID: "p1", TargetBlockID: "n2", TargetPortID: "p2"},
	}
	options := DefaultRoutingOptions()

	// Order 1: [A, B]
	res1 := RouteOrthogonalAStar([]BlockNode{nodeA, nodeB}, edges, options)
	// Order 2: [B, A]
	res2 := RouteOrthogonalAStar([]BlockNode{nodeB, nodeA}, edges, options)

	if len(res1[0].Path) != len(res2[0].Path) {
		t.Fatalf("Permuted nodes produced differing path length: %d vs %d",
			len(res1[0].Path), len(res2[0].Path))
	}

	for i := range res1[0].Path {
		p1 := res1[0].Path[i]
		p2 := res2[0].Path[i]
		if p1.X != p2.X || p1.Y != p2.Y {
			t.Errorf("Point %d mismatch under permutation: (%.1f, %.1f) vs (%.1f, %.1f)",
				i, p1.X, p1.Y, p2.X, p2.Y)
		}
	}
}

// 3. Cleaner Idempotence: Clean(Clean(P)) == Clean(P)
func TestMetamorphicCleanerIdempotence(t *testing.T) {
	rawPoints := []Point{
		{X: 50, Y: 100},
		{X: 80, Y: 100},
		{X: 120, Y: 100},
		{X: 120, Y: 150},
		{X: 120, Y: 200},
		{X: 200, Y: 200},
	}

	pass1 := CleanOrthogonalArtifacts(rawPoints, nil, nil, nil, 10.0, 0, 0)
	pass2 := CleanOrthogonalArtifacts(pass1, nil, nil, nil, 10.0, 0, 0)

	if len(pass1) != len(pass2) {
		t.Fatalf("Cleaner is not idempotent: pass1 has %d points, pass2 has %d points",
			len(pass1), len(pass2))
	}

	for i := range pass1 {
		if pass1[i].X != pass2[i].X || pass1[i].Y != pass2[i].Y {
			t.Errorf("Point %d mismatch on 2nd cleaner pass: (%.1f, %.1f) vs (%.1f, %.1f)",
				i, pass1[i].X, pass1[i].Y, pass2[i].X, pass2[i].Y)
		}
	}
}

// 4. Scene Patch Equivalence: Open(Final) == Open(Base) o Patch
func TestMetamorphicScenePatchEquivalence(t *testing.T) {
	engineDirect := NewEngine()
	engineIncremental := NewEngine()

	baseNodes := []BlockNode{
		{ID: "a", Title: "A", X: 0, Y: 0, Width: 80, Height: 50, Outputs: []Port{{ID: "out", Side: SideRight, Type: "output"}}},
		{ID: "b", Title: "B", X: 400, Y: 0, Width: 80, Height: 50, Inputs: []Port{{ID: "in", Side: SideLeft, Type: "input"}}},
		{ID: "c", Title: "C", X: 200, Y: 200, Width: 80, Height: 60},
	}
	edges := []EdgeConnection{
		{ID: "e1", SourceBlockID: "a", SourcePortID: "out", TargetBlockID: "b", TargetPortID: "in"},
	}
	options := DefaultRoutingOptions()

	// 1. Incremental path: Open base -> Patch node C moved
	_, err := engineIncremental.Open(SceneOpenRequest{
		GraphID:  "g_inc",
		Revision: 1,
		Nodes:    baseNodes,
		Edges:    edges,
		Options:  options,
	})
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}

	movedNodeC := BlockNode{ID: "c", Title: "C", X: 200, Y: 350, Width: 80, Height: 60}
	patchedRes, err := engineIncremental.Patch(ScenePatchRequest{
		GraphID: "g_inc",
		Patch: ScenePatch{
			BaseRevision:  1,
			Revision:      2,
			ChangedBlocks: []BlockNode{movedNodeC},
		},
	})
	if err != nil {
		t.Fatalf("Patch failed: %v", err)
	}

	// 2. Direct path: Open final state directly
	finalNodes := []BlockNode{baseNodes[0], baseNodes[1], movedNodeC}
	directRes, err := engineDirect.Open(SceneOpenRequest{
		GraphID:  "g_direct",
		Revision: 2,
		Nodes:    finalNodes,
		Edges:    edges,
		Options:  options,
	})
	if err != nil {
		t.Fatalf("Direct open failed: %v", err)
	}

	// 3. Verify equivalence of routed edges and metrics
	if len(patchedRes.Edges) != len(directRes.Edges) {
		t.Fatalf("Edge count mismatch: %d vs %d", len(patchedRes.Edges), len(directRes.Edges))
	}
	if len(patchedRes.Edges[0].Path) != len(directRes.Edges[0].Path) {
		t.Fatalf("Edge path length mismatch: %d vs %d", len(patchedRes.Edges[0].Path), len(directRes.Edges[0].Path))
	}
	for i := range directRes.Edges[0].Path {
		pD := directRes.Edges[0].Path[i]
		pP := patchedRes.Edges[0].Path[i]
		if pD.X != pP.X || pD.Y != pP.Y {
			t.Errorf("Path point %d mismatch: (%.1f, %.1f) vs (%.1f, %.1f)", i, pD.X, pD.Y, pP.X, pP.Y)
		}
	}
}

// 5. Metric Calculation Determinism
func TestMetamorphicMetricDeterminism(t *testing.T) {
	nodes := []BlockNode{
		{ID: "a", X: 0, Y: 0, Width: 80, Height: 50, Outputs: []Port{{ID: "out", Side: SideRight, Type: "output"}}},
		{ID: "b", X: 300, Y: 100, Width: 80, Height: 50, Inputs: []Port{{ID: "in", Side: SideLeft, Type: "input"}}},
	}
	edges := []EdgeConnection{
		{
			ID:            "e1",
			SourceBlockID: "a",
			SourcePortID:  "out",
			TargetBlockID: "b",
			TargetPortID:  "in",
			Path: []Point{
				{X: 80, Y: 25},
				{X: 190, Y: 25},
				{X: 190, Y: 125},
				{X: 300, Y: 125},
			},
		},
	}

	m1 := CalculateBenchmarkMetrics(nodes, edges, 5.0, "sugiyama", "orthogonal-a-star")
	m2 := CalculateBenchmarkMetrics(nodes, edges, 5.0, "sugiyama", "orthogonal-a-star")

	if m1.TotalWirelength != m2.TotalWirelength {
		t.Errorf("TotalWirelength mismatch: %.2f vs %.2f", m1.TotalWirelength, m2.TotalWirelength)
	}
	if m1.BendCount != m2.BendCount {
		t.Errorf("BendCount mismatch: %d vs %d", m1.BendCount, m2.BendCount)
	}
	if m1.CrossingsCount != m2.CrossingsCount {
		t.Errorf("CrossingsCount mismatch: %d vs %d", m1.CrossingsCount, m2.CrossingsCount)
	}
	if m1.CollinearOverlapCount != m2.CollinearOverlapCount {
		t.Errorf("CollinearOverlapCount mismatch: %d vs %d", m1.CollinearOverlapCount, m2.CollinearOverlapCount)
	}
	if m1.CompositeScore != m2.CompositeScore {
		t.Errorf("CompositeScore mismatch: %.2f vs %.2f", m1.CompositeScore, m2.CompositeScore)
	}
}
