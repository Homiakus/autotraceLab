package core

import (
	"encoding/json"
	"testing"
)

func TestOptionalFieldPresenceVsZero(t *testing.T) {
	// 1. Explicit zero values in JSON
	rawJSONWithZeros := `{
		"id": "p_zero",
		"name": "Port Zero",
		"type": "input",
		"placementMode": "fixed",
		"relativePosition": 0,
		"customOffset": 0,
		"order": 0,
		"pinNumber": 0
	}`

	var pZero Port
	if err := json.Unmarshal([]byte(rawJSONWithZeros), &pZero); err != nil {
		t.Fatalf("Failed to unmarshal Port with explicit 0: %v", err)
	}

	if pZero.RelativePosition == nil {
		t.Fatal("Expected RelativePosition to be present (not nil)")
	}
	if *pZero.RelativePosition != 0.0 {
		t.Errorf("Expected RelativePosition == 0.0, got %f", *pZero.RelativePosition)
	}

	if pZero.CustomOffset == nil {
		t.Fatal("Expected CustomOffset to be present (not nil)")
	}
	if *pZero.CustomOffset != 0.0 {
		t.Errorf("Expected CustomOffset == 0.0, got %f", *pZero.CustomOffset)
	}

	if pZero.Order == nil {
		t.Fatal("Expected Order to be present (not nil)")
	}
	if *pZero.Order != 0 {
		t.Errorf("Expected Order == 0, got %d", *pZero.Order)
	}

	if pZero.PinNumber == nil {
		t.Fatal("Expected PinNumber to be present (not nil)")
	}
	if *pZero.PinNumber != 0 {
		t.Errorf("Expected PinNumber == 0, got %d", *pZero.PinNumber)
	}

	// 2. Unset / omitted fields in JSON
	rawJSONUnset := `{
		"id": "p_unset",
		"name": "Port Unset",
		"type": "input"
	}`

	var pUnset Port
	if err := json.Unmarshal([]byte(rawJSONUnset), &pUnset); err != nil {
		t.Fatalf("Failed to unmarshal Port with unset fields: %v", err)
	}

	if pUnset.RelativePosition != nil {
		t.Errorf("Expected RelativePosition to be nil for unset, got %f", *pUnset.RelativePosition)
	}
	if pUnset.CustomOffset != nil {
		t.Errorf("Expected CustomOffset to be nil for unset, got %f", *pUnset.CustomOffset)
	}
	if pUnset.Order != nil {
		t.Errorf("Expected Order to be nil for unset, got %d", *pUnset.Order)
	}
	if pUnset.PinNumber != nil {
		t.Errorf("Expected PinNumber to be nil for unset, got %d", *pUnset.PinNumber)
	}
}

func TestOptionalBooleansPresenceVsFalse(t *testing.T) {
	// 1. Explicit false in JSON
	rawJSONExplicitFalse := `{
		"gridSize": 10,
		"obstacleClearance": 10,
		"bendPenalty": 35,
		"crossingPenalty": 50,
		"channelSpacing": 16,
		"portExitOffset": 24,
		"adaptivePortExitOffset": false,
		"smoothCorners": false,
		"artifactCleaning": false,
		"weights": {
			"crossingWeight": 95,
			"straightnessWeight": 90,
			"g1SplineWeight": 65,
			"portAlignmentWeight": 80,
			"clearanceWeight": 90,
			"wirelengthWeight": 15,
			"bendWeight": 25,
			"labelOverlapWeight": 75
		}
	}`

	var optFalse RoutingOptions
	if err := json.Unmarshal([]byte(rawJSONExplicitFalse), &optFalse); err != nil {
		t.Fatalf("Failed to unmarshal RoutingOptions with explicit false: %v", err)
	}

	if optFalse.AdaptivePortExitOffset == nil {
		t.Fatal("Expected AdaptivePortExitOffset to be present (not nil)")
	}
	if *optFalse.AdaptivePortExitOffset != false {
		t.Errorf("Expected AdaptivePortExitOffset == false, got true")
	}

	if optFalse.SmoothCorners == nil {
		t.Fatal("Expected SmoothCorners to be present (not nil)")
	}
	if *optFalse.SmoothCorners != false {
		t.Errorf("Expected SmoothCorners == false, got true")
	}

	if optFalse.ArtifactCleaning == nil {
		t.Fatal("Expected ArtifactCleaning to be present (not nil)")
	}
	if *optFalse.ArtifactCleaning != false {
		t.Errorf("Expected ArtifactCleaning == false, got true")
	}

	// 2. Unset / omitted booleans in JSON
	rawJSONUnset := `{
		"gridSize": 10,
		"obstacleClearance": 10,
		"bendPenalty": 35,
		"crossingPenalty": 50,
		"channelSpacing": 16,
		"portExitOffset": 24,
		"weights": {
			"crossingWeight": 95,
			"straightnessWeight": 90,
			"g1SplineWeight": 65,
			"portAlignmentWeight": 80,
			"clearanceWeight": 90,
			"wirelengthWeight": 15,
			"bendWeight": 25,
			"labelOverlapWeight": 75
		}
	}`

	var optUnset RoutingOptions
	if err := json.Unmarshal([]byte(rawJSONUnset), &optUnset); err != nil {
		t.Fatalf("Failed to unmarshal RoutingOptions with unset booleans: %v", err)
	}

	if optUnset.AdaptivePortExitOffset != nil {
		t.Errorf("Expected AdaptivePortExitOffset to be nil for unset, got %v", *optUnset.AdaptivePortExitOffset)
	}
	if optUnset.SmoothCorners != nil {
		t.Errorf("Expected SmoothCorners to be nil for unset, got %v", *optUnset.SmoothCorners)
	}
	if optUnset.ArtifactCleaning != nil {
		t.Errorf("Expected ArtifactCleaning to be nil for unset, got %v", *optUnset.ArtifactCleaning)
	}
}

func TestJSONRoundTripFidelity(t *testing.T) {
	node := BlockNode{
		ID:        "node_roundtrip",
		Title:     "Roundtrip Processor",
		Category:  "processor",
		Shape:     "rectangle",
		X:         100,
		Y:         100,
		Width:     160,
		Height:    120,
		Order:     OptInt(0),
		Layer:     OptInt(0),
		AutoSize:  OptBool(false),
		MinWidth:  OptFloat(120),
		MinHeight: OptFloat(80),
		Inputs: []Port{
			{
				ID:               "p_fixed_zero",
				Name:             "In Zero",
				Side:             SideLeft,
				Type:             "input",
				PlacementMode:    "fixed",
				RelativePosition: OptFloat(0.0),
				CustomOffset:     OptFloat(0.0),
				Order:            OptInt(0),
				PinNumber:        OptInt(0),
			},
		},
		Outputs: []Port{
			{
				ID:            "p_adaptive_unset",
				Name:          "Out Adaptive",
				Side:          SideRight,
				Type:          "output",
				PlacementMode: "adaptive",
			},
		},
	}

	// 1. Marshal to JSON
	data, err := json.Marshal(node)
	if err != nil {
		t.Fatalf("Failed to marshal BlockNode: %v", err)
	}

	// 2. Unmarshal back
	var restored BlockNode
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("Failed to unmarshal BlockNode: %v", err)
	}

	// 3. Verify exact equivalence
	if restored.ID != node.ID {
		t.Errorf("ID mismatch: got %s, want %s", restored.ID, node.ID)
	}
	if restored.Order == nil || *restored.Order != 0 {
		t.Errorf("Order mismatch: got %v, want 0", restored.Order)
	}
	if restored.AutoSize == nil || *restored.AutoSize != false {
		t.Errorf("AutoSize mismatch: got %v, want false", restored.AutoSize)
	}

	p0 := restored.Inputs[0]
	if p0.RelativePosition == nil || *p0.RelativePosition != 0.0 {
		t.Errorf("p0.RelativePosition mismatch: got %v, want 0.0", p0.RelativePosition)
	}
	if p0.CustomOffset == nil || *p0.CustomOffset != 0.0 {
		t.Errorf("p0.CustomOffset mismatch: got %v, want 0.0", p0.CustomOffset)
	}
	if p0.Order == nil || *p0.Order != 0 {
		t.Errorf("p0.Order mismatch: got %v, want 0", p0.Order)
	}
	if p0.PinNumber == nil || *p0.PinNumber != 0 {
		t.Errorf("p0.PinNumber mismatch: got %v, want 0", p0.PinNumber)
	}

	p1 := restored.Outputs[0]
	if p1.RelativePosition != nil {
		t.Errorf("p1.RelativePosition should be nil, got %v", p1.RelativePosition)
	}
	if p1.CustomOffset != nil {
		t.Errorf("p1.CustomOffset should be nil, got %v", p1.CustomOffset)
	}
	if p1.Order != nil {
		t.Errorf("p1.Order should be nil, got %v", p1.Order)
	}
	if p1.PinNumber != nil {
		t.Errorf("p1.PinNumber should be nil, got %v", p1.PinNumber)
	}
}
