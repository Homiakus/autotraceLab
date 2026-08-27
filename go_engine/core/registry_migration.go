package core

import "strings"

// MigrateLegacyNode converts a legacy un-namespaced node to declarative registry format.
func MigrateLegacyNode(node BlockNode) BlockNode {
	migrated := node

	// If already has namespaced type
	if strings.Contains(node.SemanticType, "/") {
		return migrated
	}

	// Map legacy shape/category to namespaced typeId
	var targetType string
	switch node.Shape {
	case "chip_ic":
		targetType = "core/block/chip_ic"
	case "rounded":
		if node.Category == "source" {
			targetType = "core/block/sensor"
		} else {
			targetType = "core/block/process"
		}
	default:
		targetType = "core/block/process"
	}

	migrated.SemanticType = targetType
	return migrated
}

// MigrateLegacyScene upgrades all nodes in a diagram to declarative registry schemas.
func MigrateLegacyScene(nodes []BlockNode, edges []EdgeConnection) ([]BlockNode, []EdgeConnection) {
	migratedNodes := make([]BlockNode, len(nodes))
	for i, n := range nodes {
		migratedNodes[i] = MigrateLegacyNode(n)
	}

	migratedEdges := make([]EdgeConnection, len(edges))
	for i, e := range edges {
		migratedEdges[i] = e
	}

	return migratedNodes, migratedEdges
}
