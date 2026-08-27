package core

// InvalidationClass categorizes the impact of an edit on canvas, layout, and routing pipelines.
type InvalidationClass string

const (
	InvalidationNone            InvalidationClass = "none"
	InvalidationRender          InvalidationClass = "render"
	InvalidationSemantic        InvalidationClass = "semantic"
	InvalidationRoutingCost     InvalidationClass = "routing_cost"
	InvalidationRoutingGeometry InvalidationClass = "routing_geometry"
	InvalidationLayout          InvalidationClass = "layout"
)

// NamespacedID represents a valid namespaced identifier: "namespace/entityType/id"
type NamespacedID string

// LifecycleStatus defines state of registry types: draft -> published -> deprecated.
type LifecycleStatus string

const (
	StatusDraft      LifecycleStatus = "draft"
	StatusPublished  LifecycleStatus = "published"
	StatusDeprecated LifecycleStatus = "deprecated"
)

// ShapeDefinition defines standard and parametric block silhouette geometries.
type ShapeDefinition struct {
	ID          NamespacedID    `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Status      LifecycleStatus `json:"status"`
	Version     string          `json:"version"`
	BaseShape   string          `json:"baseShape"` // "rectangle", "rounded", "circle", "diamond", "hexagon", "chip_ic"
	CornerRadius float64        `json:"cornerRadius,omitempty"`
	AspectRatio  *float64       `json:"aspectRatio,omitempty"`
	ClipPathSVG  string         `json:"clipPathSvg,omitempty"`
}

// IconDefinition defines iconography resources.
type IconDefinition struct {
	ID       NamespacedID    `json:"id"`
	Name     string          `json:"name"`
	Pack     string          `json:"pack,omitempty"`
	Status   LifecycleStatus `json:"status"`
	SVG      string          `json:"svg"`
	Category string          `json:"category,omitempty"`
}

const (
	PortTypeInput   = "input"
	PortTypeOutput  = "output"
	PortTypeInout   = "inout"
	PortTypePassive = "passive"
)

// PortTemplate defines a default port specification on a block type.
type PortTemplate struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Type             string   `json:"type"` // "input", "output", "inout", "passive"
	DataType         string   `json:"dataType,omitempty"`
	PreferredSide    PortSide `json:"preferredSide,omitempty"`
	RelativePosition float64  `json:"relativePosition,omitempty"`
	PinNumber        *int     `json:"pinNumber,omitempty"`
	MinPitch         float64  `json:"minPitch,omitempty"`
	Color            string   `json:"color,omitempty"`
}

// BlockTypeDefinition defines a reusable blueprint for canvas nodes.
type BlockTypeDefinition struct {
	ID               NamespacedID    `json:"id"`
	Name             string          `json:"name"`
	Description      string          `json:"description,omitempty"`
	Category         string          `json:"category"`
	Status           LifecycleStatus `json:"status"`
	Version          string          `json:"version"`
	ShapeID          NamespacedID    `json:"shapeId"`
	IconID           *NamespacedID   `json:"iconId,omitempty"`
	DefaultWidth     float64         `json:"defaultWidth"`
	DefaultHeight    float64         `json:"defaultHeight"`
	MinWidth         float64         `json:"minWidth"`
	MinHeight        float64         `json:"minHeight"`
	Ports            []PortTemplate  `json:"ports"`
	HeaderColor      string          `json:"headerColor,omitempty"`
	BodyColor        string          `json:"bodyColor,omitempty"`
	BorderColor      string          `json:"borderColor,omitempty"`
	RoutingProfileID *NamespacedID   `json:"routingProfileId,omitempty"`
	CustomProperties map[string]any  `json:"customProperties,omitempty"`
}

// EdgeTypeDefinition defines connection formatting, styling, and default behavior.
type EdgeTypeDefinition struct {
	ID               NamespacedID    `json:"id"`
	Name             string          `json:"name"`
	Description      string          `json:"description,omitempty"`
	Status           LifecycleStatus `json:"status"`
	Version          string          `json:"version"`
	Color            string          `json:"color"`
	StrokeWidth      float64         `json:"strokeWidth"`
	DashPattern      string          `json:"dashPattern,omitempty"`
	ArrowHead        string          `json:"arrowHead,omitempty"` // "arrow", "circle", "diamond", "none"
	RoutingProfileID *NamespacedID   `json:"routingProfileId,omitempty"`
}

// RoutingProfileDefinition defines algorithmic weights and channel clearance presets.
type RoutingProfileDefinition struct {
	ID          NamespacedID    `json:"id"`
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Status      LifecycleStatus `json:"status"`
	Version     string          `json:"version"`
	Options     RoutingOptions  `json:"options"`
}

// ThemeDefinition defines color palettes and rendering styles.
type ThemeDefinition struct {
	ID              NamespacedID      `json:"id"`
	Name            string            `json:"name"`
	Status          LifecycleStatus   `json:"status"`
	Version         string            `json:"version"`
	IsDark          bool              `json:"isDark"`
	CanvasBackground string           `json:"canvasBackground"`
	GridColor       string            `json:"gridColor"`
	BlockFill       string            `json:"blockFill"`
	BlockStroke     string            `json:"blockStroke"`
	TextColor       string            `json:"textColor"`
	WireDefault     string            `json:"wireDefault"`
	WireSelected    string            `json:"wireSelected"`
	Variables       map[string]string `json:"variables,omitempty"`
}

// RegistryPackage bundles definitions into an importable / exportable versioned artifact.
type RegistryPackage struct {
	ID              NamespacedID                `json:"id"`
	Name            string                      `json:"name"`
	Version         string                      `json:"version"`
	Author          string                      `json:"author,omitempty"`
	Description     string                      `json:"description,omitempty"`
	Checksum        string                      `json:"checksum,omitempty"`
	Shapes          []ShapeDefinition           `json:"shapes,omitempty"`
	Icons           []IconDefinition            `json:"icons,omitempty"`
	BlockTypes      []BlockTypeDefinition       `json:"blockTypes,omitempty"`
	EdgeTypes       []EdgeTypeDefinition        `json:"edgeTypes,omitempty"`
	RoutingProfiles []RoutingProfileDefinition  `json:"routingProfiles,omitempty"`
	Themes          []ThemeDefinition           `json:"themes,omitempty"`
}

// ResolvedBlockStyle contains fully merged properties ready for canvas rendering.
type ResolvedBlockStyle struct {
	TypeID       NamespacedID
	Title        string
	Shape        ShapeDefinition
	Width        float64
	Height       float64
	HeaderColor  string
	BodyColor    string
	BorderColor  string
	Inputs       []Port
	Outputs      []Port
}
