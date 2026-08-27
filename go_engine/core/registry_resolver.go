package core

import (
	"math"
)

// ResolveBlockStyle merges a block node instance with its declarative type definition.
// Precedence order:
// 1. Instance explicit override (Width, Height, Title, explicit Ports)
// 2. BlockTypeDefinition defaults
// 3. ShapeDefinition defaults
func ResolveBlockStyle(node BlockNode, store *RegistryStore) ResolvedBlockStyle {
	if store == nil {
		store = GlobalRegistry
	}

	typeID := NamespacedID("core/block/process")
	if node.SemanticType != "" {
		typeID = NamespacedID(node.SemanticType)
	}

	blockType, found := store.GetBlockType(typeID)
	if !found {
		// Fallback to default process block
		blockType, _ = store.GetBlockType("core/block/process")
	}

	shapeDef, foundShape := store.GetShape(blockType.ShapeID)
	if !foundShape {
		shapeDef, _ = store.GetShape("core/shape/rectangle")
	}

	// Resolve width & height respecting min limits
	w := node.Width
	if w <= 0 {
		w = blockType.DefaultWidth
	}
	w = math.Max(w, blockType.MinWidth)

	h := node.Height
	if h <= 0 {
		h = blockType.DefaultHeight
	}
	h = math.Max(h, blockType.MinHeight)

	// Resolve ports: if node defines explicit ports, use them; otherwise instantiate templates
	inputs := node.Inputs
	outputs := node.Outputs

	if len(inputs) == 0 && len(outputs) == 0 && len(blockType.Ports) > 0 {
		for _, pt := range blockType.Ports {
			side := pt.PreferredSide
			if side == "" {
				if pt.Type == PortTypeInput {
					side = SideLeft
				} else {
					side = SideRight
				}
			}

			relPos := pt.RelativePosition
			p := Port{
				ID:               pt.ID,
				Name:             pt.Name,
				Type:             pt.Type,
				Side:             side,
				RelativePosition: &relPos,
				Color:            pt.Color,
			}
			if pt.Type == PortTypeInput {
				inputs = append(inputs, p)
			} else {
				outputs = append(outputs, p)
			}
		}
	}

	return ResolvedBlockStyle{
		TypeID:      typeID,
		Title:       node.Title,
		Shape:       shapeDef,
		Width:       w,
		Height:      h,
		HeaderColor: blockType.HeaderColor,
		BodyColor:   blockType.BodyColor,
		BorderColor: blockType.BorderColor,
		Inputs:      inputs,
		Outputs:     outputs,
	}
}

// ResolveEdgeStyle resolves edge visual presentation.
func ResolveEdgeStyle(edge EdgeConnection, store *RegistryStore) (EdgeTypeDefinition, bool) {
	if store == nil {
		store = GlobalRegistry
	}

	typeID := NamespacedID("core/edge/signal")
	return store.GetEdgeType(typeID)
}
