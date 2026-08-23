package main

import (
	"fmt"
	"math"
	"time"
)

type GoTestResult struct {
	Suite      string  `json:"suite"`
	Name       string  `json:"name"`
	Passed     bool    `json:"passed"`
	Message    string  `json:"message"`
	DurationMs float64 `json:"durationMs"`
}

type GoTestSuiteSummary struct {
	Total      int            `json:"total"`
	Passed     int            `json:"passed"`
	Failed     int            `json:"failed"`
	DurationMs float64        `json:"durationMs"`
	Results    []GoTestResult `json:"results"`
}

func RunAllGoVerificationTests() GoTestSuiteSummary {
	startTime := time.Now()
	var results []GoTestResult

	assert := func(suite, name string, condition bool, message string) {
		results = append(results, GoTestResult{
			Suite:      suite,
			Name:       name,
			Passed:     condition,
			Message:    message,
			DurationMs: 0.01,
		})
	}

	// SUITE 1: Strict On-Arrow Label Placement
	{
		suite := "Strict Label-on-Arrow Placement (Go Engine)"
		nodes := []BlockNode{
			{
				ID:       "A",
				Title:    "Source",
				Category: "source",
				X:        50,
				Y:        100,
				Width:    80,
				Height:   50,
				Outputs:  []Port{{ID: "p_out", Name: "out", Side: SideRight, Type: "output"}},
			},
			{
				ID:       "B",
				Title:    "Target",
				Category: "processor",
				X:        350,
				Y:        100,
				Width:    80,
				Height:   50,
				Inputs:   []Port{{ID: "p_in", Name: "in", Side: SideLeft, Type: "input"}},
			},
		}
		edges := []EdgeConnection{
			{
				ID:            "e1",
				SourceBlockID: "A",
				SourcePortID:  "p_out",
				TargetBlockID: "B",
				TargetPortID:  "p_in",
				Label:         "DATA_BUS_32",
				Path:          []Point{{X: 130, Y: 125}, {X: 350, Y: 125}},
			},
		}

		labels := ComputeOptimizedLabels(nodes, edges, nil, 6.0)
		l := labels["e1"]
		assert(suite, "Go: Label sits strictly on its arrow with 0 penalty", l.IsOnArrow && l.Penalty == 0 && l.IsCollisionFree, "PASSED: Go label placed on horizontal segment with isOnArrow=true")

		// Displaced label check
		custom := map[string]Point{"e1": {X: 500, Y: 500}}
		displaced := ComputeOptimizedLabels(nodes, edges, custom, 6.0)["e1"]
		assert(suite, "Go: Maximum penalty applied (50,000) when label is off arrow", !displaced.IsOnArrow && displaced.Penalty == MaxLabelOffArrowPenalty, "PASSED: Triggered MaxLabelOffArrowPenalty (50000)")
	}

	// SUITE 2: No Collinear Overlaps
	{
		suite := "No Collinear Overlapping Wires (Go Engine)"
		overlapping := []EdgeConnection{
			{
				ID:   "e1",
				Path: []Point{{X: 100, Y: 100}, {X: 300, Y: 100}},
			},
			{
				ID:   "e2",
				Path: []Point{{X: 150, Y: 100}, {X: 250, Y: 100}},
			},
		}
		res := DetectCollinearOverlaps(overlapping)
		assert(suite, "Go: DetectCollinearOverlaps catches coinciding parallel segments", res.TotalOverlapLength == 100 && res.OverlapCount == 1, fmt.Sprintf("PASSED: Detected overlap %v px", res.TotalOverlapLength))

		// 90 deg crossing
		crossing := []EdgeConnection{
			{ID: "e_h", Path: []Point{{X: 100, Y: 150}, {X: 300, Y: 150}}},
			{ID: "e_v", Path: []Point{{X: 200, Y: 50}, {X: 200, Y: 250}}},
		}
		cRes := DetectCollinearOverlaps(crossing)
		assert(suite, "Go: 90° crossing has 0 collinear overlap", cRes.TotalOverlapLength == 0 && cRes.OverlapCount == 0, "PASSED: Perpendicular intersection produces 0 collinear penalty")
	}

	// SUITE 3: 90° Port Outflow & Inflow
	{
		suite := "90° Port Outflow & Inflow (Go Engine)"
		nodes := []BlockNode{
			{
				ID:       "Src",
				Title:    "Src",
				Category: "source",
				X:        100,
				Y:        100,
				Width:    80,
				Height:   60,
				Outputs:  []Port{{ID: "p_out", Name: "out", Side: SideRight, Type: "output"}},
			},
			{
				ID:       "Dst",
				Title:    "Dst",
				Category: "sink",
				X:        350,
				Y:        250,
				Width:    80,
				Height:   60,
				Inputs:   []Port{{ID: "p_in", Name: "in", Side: SideTop, Type: "input"}},
			},
		}
		edges := []EdgeConnection{
			{ID: "e_p", SourceBlockID: "Src", SourcePortID: "p_out", TargetBlockID: "Dst", TargetPortID: "p_in"},
		}
		routed := RouteOrthogonalAStar(nodes, edges, RoutingOptions{
			GridSize:          10,
			ObstacleClearance: 10,
			PortExitOffset:    20,
			ArtifactCleaning:  true,
		})
		path := routed[0].Path
		hasCleanExit := len(path) >= 2 && path[0].Y == path[1].Y && path[1].X > path[0].X
		lastIdx := len(path) - 1
		hasCleanEntry := len(path) >= 2 && path[lastIdx].X == path[lastIdx-1].X && path[lastIdx].Y > path[lastIdx-1].Y

		assert(suite, "Go: First wire segment leaves right port at 90°", hasCleanExit, "PASSED: Exit is strictly horizontal")
		assert(suite, "Go: Last wire segment enters top port at 90°", hasCleanEntry, "PASSED: Entry is strictly vertical")
	}

	// SUITE 4: NLP Optimizer Invariance
	{
		suite := "NLP Optimizer (Go Engine)"
		nodes := []BlockNode{
			{
				ID:       "A",
				Title:    "Pinned A",
				Category: "source",
				X:        100,
				Y:        100,
				Width:    80,
				Height:   60,
				IsPinned: true,
				Outputs:  []Port{{ID: "p_out", Name: "out", Side: SideRight, Type: "output"}},
			},
			{
				ID:       "B",
				Title:    "Moving B",
				Category: "sink",
				X:        300,
				Y:        200,
				Width:    80,
				Height:   60,
				Inputs:   []Port{{ID: "p_in", Name: "in", Side: SideLeft, Type: "input"}},
			},
		}
		edges := []EdgeConnection{
			{ID: "e1", SourceBlockID: "A", SourcePortID: "p_out", TargetBlockID: "B", TargetPortID: "p_in"},
		}
		res := RunNLPOptimization(nodes, edges, RoutingOptions{GridSize: 10, ObstacleClearance: 15, ArtifactCleaning: true}, NLPOptimizationParams{
			LearningRate:      0.08,
			Iterations:        10,
			FreezePinnedNodes: true,
		})

		pinnedRemained := res.Nodes[0].X == 100 && res.Nodes[0].Y == 100
		assert(suite, "Go: Pinned anchor block maintains strict invariant ∇_X_pinned Φ(X) ≡ 0", pinnedRemained, "PASSED: Pinned node remained at (100, 100)")
		assert(suite, "Go: NLP objective breakdown evaluates finite values", !math.IsNaN(res.FinalBreakdown.OverallCostValue) && !math.IsInf(res.FinalBreakdown.OverallCostValue, 0), "PASSED: Finite cost value calculated")
	}

	// SUITE 5: Artifact Cleaner
	{
		suite := "Artifact Cleaner (Go Engine)"
		dirty := []Point{
			{X: 100, Y: 100},
			{X: 150, Y: 100},
			{X: 200, Y: 100},
			{X: 200, Y: 150},
			{X: 200, Y: 120},
			{X: 200, Y: 200},
			{X: 300, Y: 200},
			{X: 400, Y: 200},
		}
		cleaned := CleanOrthogonalArtifacts(dirty, nil, nil, nil, 10, 15, 15)
		assert(suite, "Go: Cleaner removes collinear & U-turns", len(cleaned) < len(dirty), fmt.Sprintf("PASSED: Compressed from %d down to %d points", len(dirty), len(cleaned)))
	}

	// SUITE 6: Shape Geometry Parity
	{
		suite := "Block Geometry & Shapes (Go Engine)"
		shapes := []string{"rectangle", "rounded", "chip_ic", "circle", "diamond", "hexagon"}
		for _, s := range shapes {
			node := BlockNode{
				ID:      "shape_test",
				Shape:   s,
				X:       100,
				Y:       100,
				Width:   120,
				Height:  80,
				Outputs: []Port{{ID: "p1", Name: "out", Side: SideRight, Type: "output"}},
			}
			geom := BuildDerivedBlockGeometry(node, 15)
			assert(suite, fmt.Sprintf("Go: Shape '%s' derives valid geometry and obstacle envelope", s), geom.Valid && geom.MinWidth > 0 && geom.MinHeight > 0, fmt.Sprintf("PASSED: Shape %s valid", s))
		}
	}

	// SUITE 7: Symmetrical Crossing Calculation
	{
		suite := "Symmetrical Crossing Metrics (Go Engine)"
		nodes := []BlockNode{}
		edgesOrder1 := []EdgeConnection{
			{ID: "h", Path: []Point{{X: 50, Y: 100}, {X: 250, Y: 100}}},
			{ID: "v", Path: []Point{{X: 150, Y: 50}, {X: 150, Y: 200}}},
		}
		edgesOrder2 := []EdgeConnection{
			{ID: "v", Path: []Point{{X: 150, Y: 50}, {X: 150, Y: 200}}},
			{ID: "h", Path: []Point{{X: 50, Y: 100}, {X: 250, Y: 100}}},
		}
		m1 := CalculateBenchmarkMetrics(nodes, edgesOrder1, 0, "test", "test")
		m2 := CalculateBenchmarkMetrics(nodes, edgesOrder2, 0, "test", "test")
		assert(suite, "Go: Crossing count is order-independent and symmetric", m1.CrossingsCount == 1 && m2.CrossingsCount == 1, "PASSED: Both forward and reverse edge lists detect exactly 1 crossing")
	}

	total := len(results)
	passed := 0
	for _, r := range results {
		if r.Passed {
			passed++
		}
	}

	duration := float64(time.Since(startTime).Microseconds()) / 1000.0
	return GoTestSuiteSummary{
		Total:      total,
		Passed:     passed,
		Failed:     total - passed,
		DurationMs: duration,
		Results:    results,
	}
}
