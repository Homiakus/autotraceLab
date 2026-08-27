package core

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"sync"
)

// RegistryStore holds declarative type definitions and supports dynamic package extensions.
type RegistryStore struct {
	mu              sync.RWMutex
	shapes          map[NamespacedID]ShapeDefinition
	icons           map[NamespacedID]IconDefinition
	blockTypes      map[NamespacedID]BlockTypeDefinition
	edgeTypes       map[NamespacedID]EdgeTypeDefinition
	routingProfiles map[NamespacedID]RoutingProfileDefinition
	themes          map[NamespacedID]ThemeDefinition
	packages        map[NamespacedID]RegistryPackage
}

// NewRegistryStore creates an initialized RegistryStore loaded with built-in system types.
func NewRegistryStore() *RegistryStore {
	store := &RegistryStore{
		shapes:          make(map[NamespacedID]ShapeDefinition),
		icons:           make(map[NamespacedID]IconDefinition),
		blockTypes:      make(map[NamespacedID]BlockTypeDefinition),
		edgeTypes:       make(map[NamespacedID]EdgeTypeDefinition),
		routingProfiles: make(map[NamespacedID]RoutingProfileDefinition),
		themes:          make(map[NamespacedID]ThemeDefinition),
		packages:        make(map[NamespacedID]RegistryPackage),
	}

	builtinPkg := DefaultBuiltinRegistryPackage()
	_ = store.ImportPackage(builtinPkg)
	return store
}

// CalculateChecksum computes a deterministic canonical SHA-256 hash of any serializable object.
func CalculateChecksum(v any) string {
	bytes, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	hash := sha256.Sum256(bytes)
	return hex.EncodeToString(hash[:])
}

// ImportPackage validates and merges a RegistryPackage into the store.
func (s *RegistryStore) ImportPackage(pkg RegistryPackage) error {
	if err := ValidateRegistryPackage(pkg); err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, shape := range pkg.Shapes {
		s.shapes[shape.ID] = shape
	}
	for _, icon := range pkg.Icons {
		s.icons[icon.ID] = icon
	}
	for _, block := range pkg.BlockTypes {
		s.blockTypes[block.ID] = block
	}
	for _, edge := range pkg.EdgeTypes {
		s.edgeTypes[edge.ID] = edge
	}
	for _, prof := range pkg.RoutingProfiles {
		s.routingProfiles[prof.ID] = prof
	}
	for _, theme := range pkg.Themes {
		s.themes[theme.ID] = theme
	}

	pkg.Checksum = CalculateChecksum(pkg)
	s.packages[pkg.ID] = pkg
	return nil
}

// GetBlockType retrieves a block type by ID.
func (s *RegistryStore) GetBlockType(id NamespacedID) (BlockTypeDefinition, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	b, ok := s.blockTypes[id]
	return b, ok
}

// GetEdgeType retrieves an edge type by ID.
func (s *RegistryStore) GetEdgeType(id NamespacedID) (EdgeTypeDefinition, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	e, ok := s.edgeTypes[id]
	return e, ok
}

// GetShape retrieves a shape definition by ID.
func (s *RegistryStore) GetShape(id NamespacedID) (ShapeDefinition, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sh, ok := s.shapes[id]
	return sh, ok
}

// DefaultBuiltinRegistryPackage returns the authoritative built-in core package.
func DefaultBuiltinRegistryPackage() RegistryPackage {
	shapes := []ShapeDefinition{
		{ID: "core/shape/rectangle", Name: "Rectangle", BaseShape: "rectangle", Status: StatusPublished, Version: "1.0.0"},
		{ID: "core/shape/rounded", Name: "Rounded Rectangle", BaseShape: "rounded", CornerRadius: 8.0, Status: StatusPublished, Version: "1.0.0"},
		{ID: "core/shape/chip_ic", Name: "Chip IC Package", BaseShape: "chip_ic", Status: StatusPublished, Version: "1.0.0"},
		{ID: "core/shape/circle", Name: "Circle", BaseShape: "circle", Status: StatusPublished, Version: "1.0.0"},
		{ID: "core/shape/diamond", Name: "Diamond Decision", BaseShape: "diamond", Status: StatusPublished, Version: "1.0.0"},
		{ID: "core/shape/hexagon", Name: "Hexagon", BaseShape: "hexagon", Status: StatusPublished, Version: "1.0.0"},
	}

	blockTypes := []BlockTypeDefinition{
		{
			ID:            "core/block/process",
			Name:          "Process Block",
			Category:      "processor",
			Status:        StatusPublished,
			Version:       "1.0.0",
			ShapeID:       "core/shape/rectangle",
			DefaultWidth:  140,
			DefaultHeight: 60,
			MinWidth:      80,
			MinHeight:     40,
			HeaderColor:   "#3b82f6",
			BodyColor:     "#1e293b",
			BorderColor:   "#64748b",
			Ports: []PortTemplate{
				{ID: "in", Name: "In", Type: PortTypeInput, PreferredSide: SideLeft, RelativePosition: 0.5},
				{ID: "out", Name: "Out", Type: PortTypeOutput, PreferredSide: SideRight, RelativePosition: 0.5},
			},
		},
		{
			ID:            "core/block/sensor",
			Name:          "Sensor Source",
			Category:      "source",
			Status:        StatusPublished,
			Version:       "1.0.0",
			ShapeID:       "core/shape/rounded",
			DefaultWidth:  120,
			DefaultHeight: 60,
			MinWidth:      80,
			MinHeight:     40,
			HeaderColor:   "#10b981",
			BodyColor:     "#064e3b",
			Ports: []PortTemplate{
				{ID: "data", Name: "Data", Type: PortTypeOutput, PreferredSide: SideRight, RelativePosition: 0.5},
			},
		},
		{
			ID:            "core/block/chip_ic",
			Name:          "Dual Inline IC",
			Category:      "processor",
			Status:        StatusPublished,
			Version:       "1.0.0",
			ShapeID:       "core/shape/chip_ic",
			DefaultWidth:  180,
			DefaultHeight: 120,
			MinWidth:      100,
			MinHeight:     60,
			BodyColor:     "#0f172a",
			BorderColor:   "#94a3b8",
			Ports: []PortTemplate{
				{ID: "p1", Name: "VCC", Type: PortTypeInput, PreferredSide: SideLeft, RelativePosition: 0.2},
				{ID: "p2", Name: "GND", Type: PortTypeInput, PreferredSide: SideLeft, RelativePosition: 0.8},
				{ID: "p3", Name: "CLK", Type: PortTypeInput, PreferredSide: SideRight, RelativePosition: 0.2},
				{ID: "p4", Name: "OUT", Type: PortTypeOutput, PreferredSide: SideRight, RelativePosition: 0.8},
			},
		},
	}

	edgeTypes := []EdgeTypeDefinition{
		{
			ID:          "core/edge/signal",
			Name:        "Signal Wire",
			Status:      StatusPublished,
			Version:     "1.0.0",
			Color:       "#38bdf8",
			StrokeWidth: 2.0,
			ArrowHead:   "arrow",
		},
		{
			ID:          "core/edge/bus",
			Name:        "Data Bus",
			Status:      StatusPublished,
			Version:     "1.0.0",
			Color:       "#a855f7",
			StrokeWidth: 3.5,
			ArrowHead:   "arrow",
		},
		{
			ID:          "core/edge/control",
			Name:        "Control Strobe",
			Status:      StatusPublished,
			Version:     "1.0.0",
			Color:       "#f59e0b",
			StrokeWidth: 2.0,
			DashPattern: "6,3",
			ArrowHead:   "diamond",
		},
	}

	return RegistryPackage{
		ID:          "core/package/builtin",
		Name:        "AutoTrace Core Builtins",
		Version:     "1.0.0",
		Author:      "AutoTrace Team",
		Description: "Standard declarative blocks, shapes, and connections",
		Shapes:      shapes,
		BlockTypes:  blockTypes,
		EdgeTypes:   edgeTypes,
	}
}

// GlobalRegistry is the process-wide default registry store.
var GlobalRegistry = NewRegistryStore()
