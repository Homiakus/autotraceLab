package core

// Point represents an (X, Y) 2D point.
type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// Direction vector.
type Direction struct {
	Dx int `json:"dx"`
	Dy int `json:"dy"`
}

// PortSide represents left, right, top, bottom.
type PortSide string

const (
	SideLeft   PortSide = "left"
	SideRight  PortSide = "right"
	SideTop    PortSide = "top"
	SideBottom PortSide = "bottom"
)

// Port defines a block terminal conforming to rule/2.md §12.
type Port struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	Side             PortSide   `json:"side,omitempty"`
	Type             string     `json:"type"`
	DataType         string     `json:"dataType,omitempty"`
	PlacementMode    string     `json:"placementMode,omitempty"`
	RelativePosition *float64   `json:"relativePosition,omitempty"`
	CustomOffset     *float64   `json:"customOffset,omitempty"`
	PinNumber        *int       `json:"pinNumber,omitempty"`
	PreferredSide    PortSide   `json:"preferredSide,omitempty"`
	AllowedSides     []PortSide `json:"allowedSides,omitempty"`
	Order            *int       `json:"order,omitempty"`
	GroupID          string     `json:"groupId,omitempty"`
	Color            string     `json:"color,omitempty"`
	Description      string     `json:"description,omitempty"`
	MinSpacing       *float64   `json:"minSpacing,omitempty"`
	OffsetPct        *float64   `json:"offsetPct,omitempty"`
}

type BlockCategory string

type BlockNode struct {
	ID                string        `json:"id"`
	Title             string        `json:"title"`
	Subtitle          string        `json:"subtitle,omitempty"`
	Category          BlockCategory `json:"category"`
	SemanticType      string        `json:"semanticType,omitempty"`
	Description       string        `json:"description,omitempty"`
	X                 float64       `json:"x"`
	Y                 float64       `json:"y"`
	Width             float64       `json:"width"`
	Height            float64       `json:"height"`
	Inputs            []Port        `json:"inputs"`
	Outputs           []Port        `json:"outputs"`
	Ports             []Port        `json:"ports,omitempty"`
	IsPinned          bool          `json:"isPinned,omitempty"`
	Layer             *int          `json:"layer,omitempty"`
	Order             *int          `json:"order,omitempty"`
	Color             string        `json:"color,omitempty"`
	Shape             string        `json:"shape,omitempty"`
	AutoSize          *bool         `json:"autoSize,omitempty"`
	MinWidth          *float64      `json:"minWidth,omitempty"`
	MinHeight         *float64      `json:"minHeight,omitempty"`
	ImageURL          string        `json:"imageUrl,omitempty"`
	ImageFit          string        `json:"imageFit,omitempty"`
	ImageOpacity      *float64      `json:"imageOpacity,omitempty"`
	ShowTitleOverlay  bool          `json:"showTitleOverlay,omitempty"`
	IconName          string        `json:"iconName,omitempty"`
	PortsAdaptiveMode string        `json:"portsAdaptiveMode,omitempty"`
	RoutingClearance  *float64      `json:"routingClearance,omitempty"`
	PreferredFlow     string        `json:"preferredFlow,omitempty"`
}

type EdgeConnection struct {
	ID            string  `json:"id"`
	SourceBlockID string  `json:"sourceBlockId"`
	SourcePortID  string  `json:"sourcePortId"`
	TargetBlockID string  `json:"targetBlockId"`
	TargetPortID string  `json:"targetPortId"`
	Label         string  `json:"label,omitempty"`
	Color         string  `json:"color,omitempty"`
	Path          []Point `json:"path,omitempty"`
	Bends         int     `json:"bends,omitempty"`
	Crossings     int     `json:"crossings,omitempty"`
	Length        float64 `json:"length,omitempty"`
	DataType      string  `json:"dataType,omitempty"`
}

type OptimizationWeights struct {
	CrossingWeight      float64 `json:"crossingWeight"`
	StraightnessWeight  float64 `json:"straightnessWeight"`
	G1SplineWeight      float64 `json:"g1SplineWeight"`
	PortAlignmentWeight float64 `json:"portAlignmentWeight"`
	ClearanceWeight     float64 `json:"clearanceWeight"`
	WirelengthWeight    float64 `json:"wirelengthWeight"`
	BendWeight          float64 `json:"bendWeight"`
	LabelOverlapWeight  float64 `json:"labelOverlapWeight"`
}

type RoutingOptions struct {
	GridSize               float64             `json:"gridSize"`
	ObstacleClearance      float64             `json:"obstacleClearance"`
	BendPenalty            float64             `json:"bendPenalty"`
	CrossingPenalty        float64             `json:"crossingPenalty"`
	ChannelSpacing         float64             `json:"channelSpacing"`
	PortExitOffset         float64             `json:"portExitOffset"`
	AdaptivePortExitOffset *bool               `json:"adaptivePortExitOffset,omitempty"`
	SmoothCorners          *bool               `json:"smoothCorners,omitempty"`
	CornerRadius           *float64            `json:"cornerRadius,omitempty"`
	AdaptiveCornerRadius   *bool               `json:"adaptiveCornerRadius,omitempty"`
	LabelClearance         *float64            `json:"labelClearance,omitempty"`
	StrictLabels           *bool               `json:"strictLabels,omitempty"`
	MinWireDistance        *float64            `json:"minWireDistance,omitempty"`
	OptimalBlockDistance   *float64            `json:"optimalBlockDistance,omitempty"`
	OptimalWireDistance    *float64            `json:"optimalWireDistance,omitempty"`
	JumpBridges            *bool               `json:"jumpBridges,omitempty"`
	PinAlignment           *bool               `json:"pinAlignment,omitempty"`
	ArtifactCleaning       *bool               `json:"artifactCleaning,omitempty"`
	Weights                OptimizationWeights `json:"weights"`
}

type PortCoordinates struct {
	X      float64   `json:"x"`
	Y      float64   `json:"y"`
	Normal Direction `json:"normal"`
	Side   PortSide  `json:"side"`
	Port   Port      `json:"port"`
}

type DerivedBlockGeometry struct {
	BlockID        string            `json:"blockId"`
	VisualBounds   [4]float64        `json:"visualBounds"`
	RoutingBounds  [4]float64        `json:"routingBounds"`
	ObstacleBounds [4]float64        `json:"obstacleBounds"`
	PortAnchors    []PortCoordinates `json:"portAnchors"`
	MinWidth       float64           `json:"minWidth"`
	MinHeight      float64           `json:"minHeight"`
	Valid          bool              `json:"valid"`
	Violations     []string          `json:"violations"`
}

type QualityVector struct {
	HardViolations          int     `json:"hardViolations"`
	Crossings               int     `json:"crossings"`
	CollinearOverlapCount   int     `json:"collinearOverlapCount"`
	CollinearOverlapLength  float64 `json:"collinearOverlapLength"`
	CongestionOverflow      float64 `json:"congestionOverflow"`
	Bends                   int     `json:"bends"`
	StraightWiresCount      int     `json:"straightWiresCount"`
	StraightEdgeRatio       float64 `json:"straightEdgeRatio"`
	PortMisalignmentScore   float64 `json:"portMisalignmentScore"`
	PortAlignmentScore      float64 `json:"portAlignmentScore"`
	AreaRatio               float64 `json:"areaRatio"`
	DensityDeviation        float64 `json:"densityDeviation"`
	VoidRatio               float64 `json:"voidRatio"`
	AspectPenalty           float64 `json:"aspectPenalty"`
	NormalizedWirelength    float64 `json:"normalizedWirelength"`
	LabelCollisions         int     `json:"labelCollisions"`
	LabelsOnArrowPercentage float64 `json:"labelsOnArrowPercentage"`
	CompositeScore          float64 `json:"compositeScore"`
}

type LabelPlacement struct {
	EdgeID          string  `json:"edgeId"`
	Label           string  `json:"label"`
	X               float64 `json:"x"`
	Y               float64 `json:"y"`
	Width           float64 `json:"width"`
	Height          float64 `json:"height"`
	SegmentIndex    int     `json:"segmentIndex"`
	IsHorizontal    bool    `json:"isHorizontal"`
	IsOnArrow       bool    `json:"isOnArrow"`
	IsCollisionFree bool    `json:"isCollisionFree"`
	Penalty         float64 `json:"penalty"`
}

type BenchmarkMetrics struct {
	TotalWirelength        float64       `json:"totalWirelength"`
	BendCount              int           `json:"bendCount"`
	CrossingsCount         int           `json:"crossingsCount"`
	CollinearOverlapCount  int           `json:"collinearOverlapCount"`
	CollinearOverlapLength float64       `json:"collinearOverlapLength"`
	LabelsOnArrowCount     int           `json:"labelsOnArrowCount"`
	TotalLabelsCount       int           `json:"totalLabelsCount"`
	LabelsOnArrowRatio     float64       `json:"labelsOnArrowRatio"`
	LabelCollisionCount    int           `json:"labelCollisionCount"`
	ExecutionTimeMs        float64       `json:"executionTimeMs"`
	CompositeScore         float64       `json:"compositeOptimalityScore"`
	LayoutAlgorithm        string        `json:"layoutAlgorithm"`
	RoutingAlgorithm       string        `json:"routingAlgorithm"`
	QualityVector          QualityVector `json:"qualityVector,omitempty"`
}

type Scene struct {
	Revision   int                    `json:"revision"`
	Nodes      []BlockNode            `json:"nodes"`
	Edges      []EdgeConnection       `json:"edges"`
	Geometries []DerivedBlockGeometry `json:"geometries"`
	Metrics    BenchmarkMetrics       `json:"metrics"`
}

type ScenePatch struct {
	BaseRevision    int              `json:"baseRevision"`
	Revision        int              `json:"revision"`
	ChangedBlocks   []BlockNode      `json:"changedBlocks"`
	ChangedEdges    []EdgeConnection `json:"changedEdges"`
	RemovedBlockIDs []string         `json:"removedBlockIds,omitempty"`
	RemovedEdgeIDs  []string         `json:"removedEdgeIds,omitempty"`
}
