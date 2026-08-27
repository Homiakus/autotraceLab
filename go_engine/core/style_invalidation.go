package core

import "math"

func portsDifferGeometrically(p1, p2 Port) bool {
	if p1.ID != p2.ID || p1.Side != p2.Side || p1.PreferredSide != p2.PreferredSide {
		return true
	}
	if (p1.RelativePosition == nil) != (p2.RelativePosition == nil) {
		return true
	}
	if p1.RelativePosition != nil && p2.RelativePosition != nil && *p1.RelativePosition != *p2.RelativePosition {
		return true
	}
	if (p1.CustomOffset == nil) != (p2.CustomOffset == nil) {
		return true
	}
	if p1.CustomOffset != nil && p2.CustomOffset != nil && *p1.CustomOffset != *p2.CustomOffset {
		return true
	}
	if (p1.MinSpacing == nil) != (p2.MinSpacing == nil) {
		return true
	}
	if p1.MinSpacing != nil && p2.MinSpacing != nil && *p1.MinSpacing != *p2.MinSpacing {
		return true
	}
	if len(p1.AllowedSides) != len(p2.AllowedSides) {
		return true
	}
	for i := range p1.AllowedSides {
		if p1.AllowedSides[i] != p2.AllowedSides[i] {
			return true
		}
	}
	return false
}

// ClassifyBlockChange determines the exact invalidation class when a block property changes.
func ClassifyBlockChange(before, after BlockNode) InvalidationClass {
	// 1. Check for geometric position / size changes
	if math.Abs(before.X-after.X) > 0.001 || math.Abs(before.Y-after.Y) > 0.001 {
		return InvalidationRoutingGeometry
	}
	if math.Abs(before.Width-after.Width) > 0.001 || math.Abs(before.Height-after.Height) > 0.001 {
		return InvalidationRoutingGeometry
	}
	if before.Shape != after.Shape {
		return InvalidationRoutingGeometry
	}
	if (before.RoutingClearance == nil) != (after.RoutingClearance == nil) {
		return InvalidationRoutingGeometry
	}
	if before.RoutingClearance != nil && after.RoutingClearance != nil && *before.RoutingClearance != *after.RoutingClearance {
		return InvalidationRoutingGeometry
	}

	// 2. Check port changes
	if len(before.Inputs) != len(after.Inputs) || len(before.Outputs) != len(after.Outputs) || len(before.Ports) != len(after.Ports) {
		return InvalidationRoutingGeometry
	}
	for i := range before.Inputs {
		if portsDifferGeometrically(before.Inputs[i], after.Inputs[i]) {
			return InvalidationRoutingGeometry
		}
	}
	for i := range before.Outputs {
		if portsDifferGeometrically(before.Outputs[i], after.Outputs[i]) {
			return InvalidationRoutingGeometry
		}
	}
	for i := range before.Ports {
		if portsDifferGeometrically(before.Ports[i], after.Ports[i]) {
			return InvalidationRoutingGeometry
		}
	}

	// 3. Check for render-only changes (colors, title)
	if before.Title != after.Title {
		return InvalidationRender
	}

	// 4. Semantic / metadata-only changes
	return InvalidationSemantic
}

// ClassifyEdgeChange determines invalidation for connection edits.
func ClassifyEdgeChange(before, after EdgeConnection) InvalidationClass {
	if before.SourceBlockID != after.SourceBlockID ||
		before.SourcePortID != after.SourcePortID ||
		before.TargetBlockID != after.TargetBlockID ||
		before.TargetPortID != after.TargetPortID {
		return InvalidationRoutingGeometry
	}

	if before.Label != after.Label {
		return InvalidationRender
	}

	return InvalidationSemantic
}
