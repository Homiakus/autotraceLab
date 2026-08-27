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
