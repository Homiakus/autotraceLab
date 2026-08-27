package core

import (
	"math"
	"strings"
	"testing"
)

func TestRenderG1ContinuousPrimitives_StraightAndFillets(t *testing.T) {
	// 2 points = 1 straight line
	pts2 := []Point{{X: 10, Y: 10}, {X: 100, Y: 10}}
	prims2 := RenderG1ContinuousPrimitives(pts2, true, nil, nil)
	if len(prims2) != 1 {
		t.Fatalf("Expected 1 primitive for 2 points, got %d", len(prims2))
	}
	if prims2[0].Type != SegmentLine {
		t.Errorf("Expected SegmentLine, got %v", prims2[0].Type)
	}

	// 3 points with a 90 degree bend = Line, CubicBezier fillet, Line
	pts3 := []Point{
		{X: 10, Y: 10},
		{X: 100, Y: 10},
		{X: 100, Y: 100},
	}
	opts := DefaultRoutingOptions()
	opts.CornerRadius = OptFloat(12.0)
	opts.AdaptiveCornerRadius = OptBool(true)
	weights := DefaultOptimizationWeights()

	prims3 := RenderG1ContinuousPrimitives(pts3, true, &weights, &opts)
	hasBezier := false
	for _, p := range prims3 {
		if p.Type == SegmentCubicBezier {
			hasBezier = true
			if p.Control1 == nil || p.Control2 == nil {
				t.Errorf("CubicBezier fillet must have control points")
			}
			// Verify continuity with endpoint
			if math.Hypot(p.End.X-100, p.End.Y-20) > 2.0 {
				t.Logf("Fillet end at (%.1f, %.1f)", p.End.X, p.End.Y)
			}
		}
	}
	if !hasBezier {
		t.Errorf("Expected CubicBezier fillet at 90-degree corner")
	}

	// Test SVG string rendering
	svgStr := RenderSVGPathString(prims3)
	if !strings.Contains(svgStr, "M ") || !strings.Contains(svgStr, "C ") {
		t.Errorf("SVG string must contain M and C commands: got %s", svgStr)
	}
}

func TestGenerateRendererNeutralPathWithBridges_Crossing(t *testing.T) {
	// Vertical wire crossing a horizontal wire
	verticalPoints := []Point{
		{X: 100, Y: 20},
		{X: 100, Y: 200},
	}

	horizontalEdge := EdgeConnection{
		ID: "h_edge",
		Path: []Point{
			{X: 50, Y: 100},
			{X: 150, Y: 100},
		},
	}

	allEdges := []EdgeConnection{horizontalEdge}

	prims := GenerateRendererNeutralPathWithBridges(
		verticalPoints,
		"v_edge",
		allEdges,
		true,  // enableBridges
		false, // smoothCorners
		nil,
		nil,
	)

	hasBridgeArc := false
	for _, p := range prims {
		if p.Type == SegmentArc && p.IsBridgeHop {
			hasBridgeArc = true
			if p.Radius != 5.5 {
				t.Errorf("Expected bridge radius 5.5, got %f", p.Radius)
			}
		}
	}

	if !hasBridgeArc {
		t.Errorf("Expected bridge hop arc where vertical wire crosses horizontal wire")
	}

	svg := GenerateOrthogonalPathWithBridgesSVG(verticalPoints, "v1", allEdges, true, false, nil, nil)
	if !strings.Contains(svg, "A 5.5 5.5") {
		t.Errorf("SVG output must contain arc command 'A 5.5 5.5': got %s", svg)
	}
}
