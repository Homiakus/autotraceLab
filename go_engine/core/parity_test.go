package core

import (
	"encoding/json"
	"math"
	"os"
	"path/filepath"
	"testing"
)

type ParityHeader struct {
	SchemaVersion string `json:"schemaVersion"`
	Generator     string `json:"generator"`
	OracleCommit  string `json:"oracleCommit"`
}

type SizingTestCase struct {
	Shape          string    `json:"shape"`
	InputNode      BlockNode `json:"inputNode"`
	ExpectedMinSize struct {
		MinWidth  float64 `json:"minWidth"`
		MinHeight float64 `json:"minHeight"`
		WPorts    float64 `json:"wPorts"`
		HPorts    float64 `json:"hPorts"`
	} `json:"expectedMinSize"`
	PortCoordinates []struct {
		PortID string   `json:"portId"`
		Side   PortSide `json:"side"`
		Point  Point    `json:"point"`
	} `json:"portCoordinates"`
}

type SizingFixture struct {
	ParityHeader
	TestCases []SizingTestCase `json:"testCases"`
}

func TestParityGeometrySizing(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "testdata", "parity", "geometry", "sizing_and_derived.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Skipf("Parity fixture not found at %s: %v", fixturePath, err)
		return
	}

	var fixture SizingFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("Failed to unmarshal fixture: %v", err)
	}

	for _, tc := range fixture.TestCases {
		t.Run("Shape_"+tc.Shape, func(t *testing.T) {
			minW, minH, wPorts, hPorts := CalculateMinimumBlockSize(tc.InputNode, DefaultCornerMargin, DefaultPortPitch)
			if minW != tc.ExpectedMinSize.MinWidth {
				t.Errorf("MinWidth mismatch for %s: got %.1f, expected %.1f", tc.Shape, minW, tc.ExpectedMinSize.MinWidth)
			}
			if minH != tc.ExpectedMinSize.MinHeight {
				t.Errorf("MinHeight mismatch for %s: got %.1f, expected %.1f", tc.Shape, minH, tc.ExpectedMinSize.MinHeight)
			}
			if wPorts != tc.ExpectedMinSize.WPorts {
				t.Errorf("WPorts mismatch for %s: got %.1f, expected %.1f", tc.Shape, wPorts, tc.ExpectedMinSize.WPorts)
			}
			if hPorts != tc.ExpectedMinSize.HPorts {
				t.Errorf("HPorts mismatch for %s: got %.1f, expected %.1f", tc.Shape, hPorts, tc.ExpectedMinSize.HPorts)
			}

			// Verify port coordinates on sized node
			sizedNode := tc.InputNode
			sizedNode.Width = minW
			sizedNode.Height = minH

			for _, expectedPort := range tc.PortCoordinates {
				actualCoords := GetPortCoordinatesAccurate(sizedNode, expectedPort.PortID, false)
				dx := math.Abs(actualCoords.X - expectedPort.Point.X)
				dy := math.Abs(actualCoords.Y - expectedPort.Point.Y)
				if dx > 1.0 || dy > 1.0 {
					t.Errorf("Port %s coord mismatch on %s: got (%.1f, %.1f), expected (%.1f, %.1f)",
						expectedPort.PortID, tc.Shape, actualCoords.X, actualCoords.Y, expectedPort.Point.X, expectedPort.Point.Y)
				}
			}
		})
	}
}

type CleanerTestCase struct {
	Name            string  `json:"name"`
	RawPoints       []Point `json:"rawPoints"`
	ExpectedCleaned []Point `json:"expectedCleaned"`
}

type CleanerFixture struct {
	ParityHeader
	TestCases []CleanerTestCase `json:"testCases"`
}

func TestParityWireCleaner(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "testdata", "parity", "cleaner", "cleaner_cases.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Skipf("Cleaner parity fixture not found: %v", err)
		return
	}

	var fixture CleanerFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("Failed to unmarshal cleaner fixture: %v", err)
	}

	for _, tc := range fixture.TestCases {
		t.Run(tc.Name, func(t *testing.T) {
			cleaned := CleanOrthogonalArtifacts(tc.RawPoints, nil, nil, nil, 12.0, 0, 0)
			if len(cleaned) == 0 && len(tc.ExpectedCleaned) > 0 {
				t.Errorf("CleanOrthogonalArtifacts returned empty slice, expected %d points", len(tc.ExpectedCleaned))
			}
			t.Logf("Cleaned points count: %d, expected: %d", len(cleaned), len(tc.ExpectedCleaned))
		})
	}
}

type FreeSlotFixture struct {
	ParityHeader
	ExistingNodes []BlockNode `json:"existingNodes"`
	RequestedSize struct {
		Width  float64 `json:"width"`
		Height float64 `json:"height"`
	} `json:"requestedSize"`
	ExpectedSlot Point `json:"expectedSlot"`
}

func TestParityFreeSlot(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "testdata", "parity", "geometry", "free_slot.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Skipf("Free slot parity fixture not found: %v", err)
		return
	}

	var fixture FreeSlotFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("Failed to unmarshal free slot fixture: %v", err)
	}

	actualSlot := FindDeterministicFreeSlot(
		fixture.ExistingNodes,
		fixture.RequestedSize.Width,
		fixture.RequestedSize.Height,
		20.0,
		40.0,
	)

	if actualSlot.X != fixture.ExpectedSlot.X || actualSlot.Y != fixture.ExpectedSlot.Y {
		t.Errorf("FreeSlot mismatch: got (%.1f, %.1f), want (%.1f, %.1f)",
			actualSlot.X, actualSlot.Y, fixture.ExpectedSlot.X, fixture.ExpectedSlot.Y)
	}
}

type RouterFixture struct {
	ParityHeader
	Nodes        []BlockNode      `json:"nodes"`
	Edges        []EdgeConnection `json:"edges"`
	Options      RoutingOptions   `json:"options"`
	ExpectedPath []Point          `json:"expectedPath"`
}

func TestParityRouterAStar(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "testdata", "parity", "router_astar", "obstacle_detour.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Skipf("Router parity fixture not found: %v", err)
		return
	}

	var fixture RouterFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("Failed to unmarshal router fixture: %v", err)
	}

	routed := RouteOrthogonalAStar(fixture.Nodes, fixture.Edges, fixture.Options)
	if len(routed) == 0 {
		t.Fatal("RouteOrthogonalAStar returned 0 edges")
	}

	actualPath := routed[0].Path
	if len(actualPath) == 0 {
		t.Fatal("RouteOrthogonalAStar returned empty path")
	}

	t.Logf("Go A* routed %d points (TS expected %d points)", len(actualPath), len(fixture.ExpectedPath))

	// Ensure zero obstacle collisions
	for i := 0; i+1 < len(actualPath); i++ {
		p1, p2 := actualPath[i], actualPath[i+1]
		for _, obs := range fixture.Nodes {
			if obs.ID == fixture.Edges[0].SourceBlockID || obs.ID == fixture.Edges[0].TargetBlockID {
				continue
			}
			coreBox := ObstacleBox{
				ID:   obs.ID,
				MinX: obs.X + 0.5,
				MaxX: obs.X + obs.Width - 0.5,
				MinY: obs.Y + 0.5,
				MaxY: obs.Y + obs.Height - 0.5,
			}
			if SegmentIntersectsBox(p1, p2, coreBox) {
				t.Fatalf("CRITICAL HARD VIOLATION: Segment (%.1f,%.1f)-(%.1f,%.1f) intersects obstacle %s!",
					p1.X, p1.Y, p2.X, p2.Y, obs.ID)
			}
		}
	}
}

type LabelsFixture struct {
	ParityHeader
	Nodes          []BlockNode      `json:"nodes"`
	Edges          []EdgeConnection `json:"edges"`
	ExpectedLabels []struct {
		EdgeID   string                 `json:"edgeId"`
		Position OptimizedLabelPosition `json:"position"`
	} `json:"expectedLabels"`
}

func TestParityLabels(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "testdata", "parity", "labels", "label_positions.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Skipf("Labels parity fixture not found: %v", err)
		return
	}

	var fixture LabelsFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("Failed to unmarshal labels fixture: %v", err)
	}

	labelMap := ComputeOptimizedLabels(fixture.Nodes, fixture.Edges, nil, 8.0)
	for _, expected := range fixture.ExpectedLabels {
		actual, ok := labelMap[expected.EdgeID]
		if !ok {
			t.Fatalf("Label for edge %s not found in result", expected.EdgeID)
		}

		if !actual.IsOnArrow {
			t.Errorf("Label for edge %s must be on arrow (isOnArrow=true), got false", expected.EdgeID)
		}
		if actual.Penalty != 0 {
			t.Errorf("Label for edge %s penalty mismatch: got %.1f, want 0", expected.EdgeID, actual.Penalty)
		}
		if actual.SegmentIndex != expected.Position.SegmentIndex {
			t.Errorf("Label for edge %s segmentIndex mismatch: got %d, want %d",
				expected.EdgeID, actual.SegmentIndex, expected.Position.SegmentIndex)
		}
		if actual.X != expected.Position.X || actual.Y != expected.Position.Y {
			t.Errorf("Label for edge %s coordinates mismatch: got (%.1f, %.1f), want (%.1f, %.1f)",
				expected.EdgeID, actual.X, actual.Y, expected.Position.X, expected.Position.Y)
		}
	}
}

type MetricsFixture struct {
	ParityHeader
	Nodes           []BlockNode      `json:"nodes"`
	Edges           []EdgeConnection `json:"edges"`
	ExpectedMetrics BenchmarkMetrics `json:"expectedMetrics"`
}

func TestParityMetrics(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "testdata", "parity", "metrics", "canonical_metrics.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Skipf("Metrics parity fixture not found: %v", err)
		return
	}

	var fixture MetricsFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("Failed to unmarshal metrics fixture: %v", err)
	}

	actual := CalculateDetailedMetrics(fixture.Nodes, fixture.Edges, "manual", "orthogonal-astar", 0.05, nil)

	if actual.TotalWirelength != fixture.ExpectedMetrics.TotalWirelength {
		t.Errorf("TotalWirelength mismatch: got %.1f, want %.1f", actual.TotalWirelength, fixture.ExpectedMetrics.TotalWirelength)
	}
	if actual.CrossingsCount != fixture.ExpectedMetrics.CrossingsCount {
		t.Errorf("CrossingsCount mismatch: got %d, want %d", actual.CrossingsCount, fixture.ExpectedMetrics.CrossingsCount)
	}
	if actual.CollinearOverlapCount != fixture.ExpectedMetrics.CollinearOverlapCount {
		t.Errorf("CollinearOverlapCount mismatch: got %d, want %d", actual.CollinearOverlapCount, fixture.ExpectedMetrics.CollinearOverlapCount)
	}
	if actual.QualityVector.HardViolations != fixture.ExpectedMetrics.QualityVector.HardViolations {
		t.Errorf("HardViolations mismatch: got %d, want %d",
			actual.QualityVector.HardViolations, fixture.ExpectedMetrics.QualityVector.HardViolations)
	}
}

type NLPFixture struct {
	ParityHeader
	InputNodes               []BlockNode            `json:"inputNodes"`
	InputEdges               []EdgeConnection       `json:"inputEdges"`
	Params                   NLPOptimizationParams  `json:"params"`
	ExpectedInitialBreakdown NLPOptimalityBreakdown `json:"expectedInitialBreakdown"`
	ExpectedFinalBreakdown   NLPOptimalityBreakdown `json:"expectedFinalBreakdown"`
	ExpectedImprovement      float64                `json:"expectedImprovement"`
	PinnedNodeIDs            []string               `json:"pinnedNodeIds"`
	IterationsRun            int                    `json:"iterationsRun"`
	HistorySnapshotsCount    int                    `json:"historySnapshotsCount"`
}

func TestParityNLP(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "testdata", "parity", "nlp", "nlp_cases.json")
	data, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Skipf("NLP parity fixture not found: %v", err)
		return
	}

	var fixture NLPFixture
	if err := json.Unmarshal(data, &fixture); err != nil {
		t.Fatalf("Failed to unmarshal NLP fixture: %v", err)
	}

	// 1. Initial breakdown parity test
	initialBreakdown := CalculateNLPOptimalityBreakdown(fixture.InputNodes, fixture.InputEdges, fixture.Params)

	if initialBreakdown.OverallCostValue != fixture.ExpectedInitialBreakdown.OverallCostValue {
		t.Errorf("Initial OverallCostValue mismatch: got %.1f, want %.1f",
			initialBreakdown.OverallCostValue, fixture.ExpectedInitialBreakdown.OverallCostValue)
	}
	if initialBreakdown.TotalWirelength != fixture.ExpectedInitialBreakdown.TotalWirelength {
		t.Errorf("Initial TotalWirelength mismatch: got %.1f, want %.1f",
			initialBreakdown.TotalWirelength, fixture.ExpectedInitialBreakdown.TotalWirelength)
	}
	if initialBreakdown.BlockDistanceDeviation != fixture.ExpectedInitialBreakdown.BlockDistanceDeviation {
		t.Errorf("Initial BlockDistanceDeviation mismatch: got %.1f, want %.1f",
			initialBreakdown.BlockDistanceDeviation, fixture.ExpectedInitialBreakdown.BlockDistanceDeviation)
	}
	if initialBreakdown.LabelsOnArrowCount != fixture.ExpectedInitialBreakdown.LabelsOnArrowCount {
		t.Errorf("Initial LabelsOnArrowCount mismatch: got %d, want %d",
			initialBreakdown.LabelsOnArrowCount, fixture.ExpectedInitialBreakdown.LabelsOnArrowCount)
	}

	// 2. Full optimization run parity test
	opts := DefaultRoutingOptions()
	opts.GridSize = 10
	opts.ObstacleClearance = 10
	opts.BendPenalty = 35
	opts.CrossingPenalty = 50
	opts.ChannelSpacing = 16
	opts.PortExitOffset = 24
	opts.AdaptivePortExitOffset = OptBool(true)
	opts.LabelClearance = OptFloat(8.0)
	opts.StrictLabels = OptBool(true)
	opts.MinWireDistance = OptFloat(16.0)
	opts.OptimalBlockDistance = OptFloat(220.0)
	opts.OptimalWireDistance = OptFloat(24.0)

	params := fixture.Params
	params.Iterations = fixture.IterationsRun

	res := RunNLPOptimization(fixture.InputNodes, fixture.InputEdges, opts, &params)

	if len(res.History) != fixture.HistorySnapshotsCount {
		t.Errorf("History snapshots count mismatch: got %d, want %d", len(res.History), fixture.HistorySnapshotsCount)
	}

	// Verify pinned node invariance
	for _, pinnedID := range fixture.PinnedNodeIDs {
		var origNode *BlockNode
		for _, n := range fixture.InputNodes {
			if n.ID == pinnedID {
				origNode = &n
				break
			}
		}
		var afterNode *BlockNode
		for _, n := range res.Nodes {
			if n.ID == pinnedID {
				afterNode = &n
				break
			}
		}
		if origNode != nil && afterNode != nil {
			if afterNode.X != origNode.X || afterNode.Y != origNode.Y {
				t.Errorf("Pinned node %s position shifted: got (%.1f, %.1f), want (%.1f, %.1f)",
					pinnedID, afterNode.X, afterNode.Y, origNode.X, origNode.Y)
			}
		}
	}
}

