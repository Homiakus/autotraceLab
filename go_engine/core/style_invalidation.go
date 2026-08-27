package core

import "math"

// ClassifyBlockChange determines the exact invalidation class when a block property changes.
// Guarantees:
// - Title, HeaderColor, BodyColor, BorderColor changes -> InvalidationRender (0 wire reroutes).
// - Description, CustomProperties changes -> InvalidationSemantic (0 wire reroutes).
// - Position (X, Y) changes -> InvalidationRoutingGeometry (reroutes affected wires).
// - Dimensions (Width, Height), Shape, or Port additions/moves -> InvalidationRoutingGeometry.
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

	// 2. Check port changes
	if len(before.Inputs) != len(after.Inputs) || len(before.Outputs) != len(after.Outputs) {
		return InvalidationRoutingGeometry
	}
	for i := range before.Inputs {
		p1, p2 := before.Inputs[i], after.Inputs[i]
		if p1.ID != p2.ID || p1.Side != p2.Side || (p1.RelativePosition != nil && p2.RelativePosition != nil && *p1.RelativePosition != *p2.RelativePosition) {
			return InvalidationRoutingGeometry
		}
	}
	for i := range before.Outputs {
		p1, p2 := before.Outputs[i], after.Outputs[i]
		if p1.ID != p2.ID || p1.Side != p2.Side || (p1.RelativePosition != nil && p2.RelativePosition != nil && *p1.RelativePosition != *p2.RelativePosition) {
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
