package core

import (
	"fmt"
	"strings"
)

// ValidateNamespacedID checks that an identifier follows the "namespace/type/id" or "namespace/id" format.
func ValidateNamespacedID(id NamespacedID) error {
	s := string(id)
	if s == "" {
		return fmt.Errorf("namespaced id cannot be empty")
	}
	parts := strings.Split(s, "/")
	if len(parts) < 2 {
		return fmt.Errorf("namespaced id %q must contain at least a namespace prefix (e.g. 'core/block/process')", s)
	}
	for _, part := range parts {
		if strings.TrimSpace(part) == "" {
			return fmt.Errorf("namespaced id %q has empty component", s)
		}
	}
	return nil
}

// ValidateShapeDefinition ensures shape definition parameters are valid.
func ValidateShapeDefinition(shape ShapeDefinition) error {
	if err := ValidateNamespacedID(shape.ID); err != nil {
		return err
	}
	if strings.TrimSpace(shape.Name) == "" {
		return fmt.Errorf("shape %q must have a non-empty name", shape.ID)
	}
	validBases := map[string]bool{
		"rectangle": true,
		"rounded":   true,
		"circle":    true,
		"diamond":   true,
		"hexagon":   true,
		"chip_ic":   true,
		"custom":    true,
	}
	if !validBases[shape.BaseShape] {
		return fmt.Errorf("shape %q baseShape %q is invalid", shape.ID, shape.BaseShape)
	}
	if shape.CornerRadius < 0 {
		return fmt.Errorf("shape %q cornerRadius must be non-negative", shape.ID)
	}
	return nil
}

// ValidateBlockTypeDefinition verifies block blueprint integrity and port templates.
func ValidateBlockTypeDefinition(block BlockTypeDefinition, shapes map[NamespacedID]ShapeDefinition) error {
	if err := ValidateNamespacedID(block.ID); err != nil {
		return err
	}
	if strings.TrimSpace(block.Name) == "" {
		return fmt.Errorf("block type %q must have a non-empty name", block.ID)
	}
	if block.DefaultWidth <= 0 || block.DefaultHeight <= 0 {
		return fmt.Errorf("block type %q default dimensions must be positive", block.ID)
	}
	if block.MinWidth < 0 || block.MinHeight < 0 {
		return fmt.Errorf("block type %q min dimensions cannot be negative", block.ID)
	}

	// Verify Shape reference
	if shapes != nil && len(shapes) > 0 {
		if _, ok := shapes[block.ShapeID]; !ok {
			return fmt.Errorf("block type %q references unknown shape %q", block.ID, block.ShapeID)
		}
	}

	// Validate Port Templates
	portIDs := make(map[string]bool, len(block.Ports))
	for _, p := range block.Ports {
		if strings.TrimSpace(p.ID) == "" {
			return fmt.Errorf("block type %q has port with empty id", block.ID)
		}
		if portIDs[p.ID] {
			return fmt.Errorf("block type %q has duplicate port id %q", block.ID, p.ID)
		}
		portIDs[p.ID] = true
	}

	return nil
}

// ValidateEdgeTypeDefinition verifies edge formatting properties.
func ValidateEdgeTypeDefinition(edge EdgeTypeDefinition) error {
	if err := ValidateNamespacedID(edge.ID); err != nil {
		return err
	}
	if strings.TrimSpace(edge.Name) == "" {
		return fmt.Errorf("edge type %q must have a non-empty name", edge.ID)
	}
	if edge.StrokeWidth <= 0 {
		return fmt.Errorf("edge type %q strokeWidth must be positive", edge.ID)
	}
	return nil
}

// ValidateRegistryPackage performs deep schema and reference checking on an entire package.
func ValidateRegistryPackage(pkg RegistryPackage) error {
	if err := ValidateNamespacedID(pkg.ID); err != nil {
		return err
	}
	if strings.TrimSpace(pkg.Name) == "" {
		return fmt.Errorf("package %q must have a name", pkg.ID)
	}
	if strings.TrimSpace(pkg.Version) == "" {
		return fmt.Errorf("package %q must specify a version", pkg.ID)
	}

	shapesMap := make(map[NamespacedID]ShapeDefinition, len(pkg.Shapes))
	for _, s := range pkg.Shapes {
		if err := ValidateShapeDefinition(s); err != nil {
			return fmt.Errorf("package %q shape invalid: %w", pkg.ID, err)
		}
		if _, exists := shapesMap[s.ID]; exists {
			return fmt.Errorf("package %q duplicate shape %q", pkg.ID, s.ID)
		}
		shapesMap[s.ID] = s
	}

	for _, b := range pkg.BlockTypes {
		if err := ValidateBlockTypeDefinition(b, shapesMap); err != nil {
			return fmt.Errorf("package %q block type invalid: %w", pkg.ID, err)
		}
	}

	for _, e := range pkg.EdgeTypes {
		if err := ValidateEdgeTypeDefinition(e); err != nil {
			return fmt.Errorf("package %q edge type invalid: %w", pkg.ID, err)
		}
	}

	return nil
}
