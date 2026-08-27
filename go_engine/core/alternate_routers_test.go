package core

import (
	"math"
	"testing"
)

func sampleTestScene() ([]BlockNode, []EdgeConnection) {
	nodes := []BlockNode{
		{
			ID:       "src",
			Title:    "Source Node",
			Category: "source",
			Shape:    "rectangle",
			X:        100,
			Y:        100,
			Width:    120,
			Height:   80,
			Outputs:  []Port{{ID: "p_out", Side: SideRight, Type: "output"}},
		},
		{
			ID:       "obs",
			Title:    "Obstacle Node",
			Category: "processor",
			Shape:    "rectangle",
			X:        280,
			Y:        80,
			Width:    80,
			Height:   120,
		},
		{
			ID:       "tgt",
			Title:    "Target Node",
			Category: "sink",
			Shape:    "rectangle",
			X:        420,
			Y:        100,
			Width:    120,
			Height:   80,
			Inputs:   []Port{{ID: "p_in", Side: SideLeft, Type: "input"}},
		},
	}

	edges := []EdgeConnection{
		{
			ID:            "e1",
			SourceBlockID: "src",
			SourcePortID:  "p_out",
			TargetBlockID: "tgt",
			TargetPortID:  "p_in",
		},
	}

	return nodes, edges
}

func TestRouteManhattanChannel(t *testing.T) {
	nodes, edges := sampleTestScene()
	options := DefaultRoutingOptions()

	routed := RouteManhattanChannel(nodes, edges, options)
	if len(routed) != 1 {
		t.Fatalf("Expected 1 routed edge, got %d", len(routed))
	}
	path := routed[0].Path
	if len(path) < 4 {
		t.Fatalf("Expected at least 4 points in Manhattan path, got %d", len(path))
	}

	// Verify normal stubs
	firstSeg := Point{X: path[1].X - path[0].X, Y: path[1].Y - path[0].Y}
	if firstSeg.X <= 0 || !almost(firstSeg.Y, 0) {
		t.Errorf("Source exit stub is not horizontal-right: got (%.1f, %.1f)", firstSeg.X, firstSeg.Y)
	}

	lastSeg := Point{X: path[len(path)-1].X - path[len(path)-2].X, Y: path[len(path)-1].Y - path[len(path)-2].Y}
	if lastSeg.X <= 0 || !almost(lastSeg.Y, 0) {
		t.Errorf("Target entry stub is not horizontal-right into left port: got (%.1f, %.1f)", lastSeg.X, lastSeg.Y)
	}
}

func TestRouteLeeWave(t *testing.T) {
	nodes, edges := sampleTestScene()
	options := DefaultRoutingOptions()

	routed, _ := RouteLeeWave(nodes, edges, options)
	if len(routed) != 1 {
		t.Fatalf("Expected 1 routed edge, got %d", len(routed))
	}
	path := routed[0].Path
	if len(path) < 2 {
		t.Fatalf("Expected non-empty Lee wave path, got %d points", len(path))
	}

	if routed[0].Length <= 0 {
		t.Errorf("Lee wave route length must be positive, got %.2f", routed[0].Length)
	}
}

func TestRouteSmoothSplines(t *testing.T) {
	// 1. Co-axial nodes -> straight laser line with 2 points
	coaxialNodes, coaxialEdges := sampleTestScene()
	options := DefaultRoutingOptions()

	coaxialRouted := RouteSmoothSplines(coaxialNodes, coaxialEdges, options)
	if len(coaxialRouted) != 1 {
		t.Fatalf("Expected 1 routed edge, got %d", len(coaxialRouted))
	}
	if len(coaxialRouted[0].Path) != 2 {
		t.Errorf("Co-axial ports should produce a direct 2-point laser line, got %d points", len(coaxialRouted[0].Path))
	}

	// 2. Vertically offset nodes -> sampled G1 Bézier S-curve
	curvedNodes := []BlockNode{
		coaxialNodes[0],
		{
			ID:       "tgt_offset",
			Title:    "Target Offset",
			Category: "sink",
			Shape:    "rectangle",
			X:        420,
			Y:        250, // offset Y
			Width:    120,
			Height:   80,
			Inputs:   []Port{{ID: "p_in", Side: SideLeft, Type: "input"}},
		},
	}
	curvedEdges := []EdgeConnection{
		{ID: "e2", SourceBlockID: "src", SourcePortID: "p_out", TargetBlockID: "tgt_offset", TargetPortID: "p_in"},
	}

	curvedRouted := RouteSmoothSplines(curvedNodes, curvedEdges, options)
	if len(curvedRouted) != 1 {
		t.Fatalf("Expected 1 routed edge, got %d", len(curvedRouted))
	}
	path := curvedRouted[0].Path
	if len(path) < 10 {
		t.Fatalf("Expected sampled Bézier spline with >10 points, got %d", len(path))
	}

	// Verify step smoothness
	for i := 0; i+1 < len(path); i++ {
		step := math.Hypot(path[i+1].X-path[i].X, path[i+1].Y-path[i].Y)
		if step > 100 {
			t.Errorf("Spline step %d too large: %.2f", i, step)
		}
	}
}
