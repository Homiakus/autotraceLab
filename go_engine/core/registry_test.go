package core

import (
	"testing"
)

func TestRegistry_PackageImportAndLookup(t *testing.T) {
	store := NewRegistryStore()

	// Verify built-in package is loaded
	proc, found := store.GetBlockType("core/block/process")
	if !found {
		t.Fatalf("Expected core/block/process in default registry")
	}
	if proc.Name != "Process Block" {
		t.Errorf("Expected 'Process Block', got %s", proc.Name)
	}

	// Register a custom user package
	customPkg := RegistryPackage{
		ID:      "industrial/package/valves",
		Name:    "Industrial Valves",
		Version: "1.0.0",
		Shapes: []ShapeDefinition{
			{ID: "industrial/shape/valve", Name: "Valve Shape", BaseShape: "diamond", Status: StatusPublished, Version: "1.0.0"},
		},
		BlockTypes: []BlockTypeDefinition{
			{
				ID:            "industrial/block/solenoid",
				Name:          "Solenoid Valve",
				Category:      "processor",
				Status:        StatusPublished,
				Version:       "1.0.0",
				ShapeID:       "industrial/shape/valve",
				DefaultWidth:  160,
				DefaultHeight: 80,
				Ports: []PortTemplate{
					{ID: "inlet", Name: "Inlet", Type: PortTypeInput, PreferredSide: SideLeft},
					{ID: "outlet", Name: "Outlet", Type: PortTypeOutput, PreferredSide: SideRight},
				},
			},
		},
	}

	err := store.ImportPackage(customPkg)
	if err != nil {
		t.Fatalf("ImportPackage failed: %v", err)
	}

	valv, found := store.GetBlockType("industrial/block/solenoid")
	if !found {
		t.Fatalf("Expected industrial/block/solenoid to be found after import")
	}
	if valv.ShapeID != "industrial/shape/valve" {
		t.Errorf("Expected shape industrial/shape/valve, got %s", valv.ShapeID)
	}

	// Checksum should be non-empty SHA256 hex string
	checksum := CalculateChecksum(customPkg)
	if len(checksum) != 64 {
		t.Errorf("Expected 64-char SHA256 checksum, got %d chars: %s", len(checksum), checksum)
	}
}

func TestRegistry_ResolverAndMigration(t *testing.T) {
	store := NewRegistryStore()

	legacyNode := BlockNode{
		ID:       "chip1",
		Title:    "Microcontroller",
		Shape:    "chip_ic",
		Category: "processor",
		X:        100,
		Y:        100,
		Width:    200,
		Height:   140,
	}

	migrated := MigrateLegacyNode(legacyNode)
	if migrated.SemanticType != "core/block/chip_ic" {
		t.Fatalf("Expected migrated semanticType 'core/block/chip_ic', got %v", migrated.SemanticType)
	}

	resolved := ResolveBlockStyle(migrated, store)
	if resolved.Shape.BaseShape != "chip_ic" {
		t.Errorf("Expected resolved baseShape 'chip_ic', got %s", resolved.Shape.BaseShape)
	}
	if len(resolved.Inputs)+len(resolved.Outputs) != 4 {
		t.Errorf("Expected 4 template ports resolved, got %d inputs and %d outputs",
			len(resolved.Inputs), len(resolved.Outputs))
	}
}

func TestRegistry_StyleInvalidationClassification(t *testing.T) {
	node1 := BlockNode{
		ID:     "n1",
		Title:  "Sensor A",
		X:      10,
		Y:      20,
		Width:  100,
		Height: 50,
	}

	// Rename title -> InvalidationRender (0 wire reroutes)
	node2 := node1
	node2.Title = "Sensor Alpha"
	class := ClassifyBlockChange(node1, node2)
	if class != InvalidationRender {
		t.Errorf("Expected InvalidationRender for title change, got %v", class)
	}

	// Move X coordinate -> InvalidationRoutingGeometry
	node3 := node1
	node3.X = 50
	classMove := ClassifyBlockChange(node1, node3)
	if classMove != InvalidationRoutingGeometry {
		t.Errorf("Expected InvalidationRoutingGeometry for position change, got %v", classMove)
	}
}
