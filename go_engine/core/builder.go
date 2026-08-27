package core

// RoutingOptionsBuilder provides a fluent, idiomatic builder for RoutingOptions.
type RoutingOptionsBuilder struct {
	opts RoutingOptions
}

// NewRoutingOptionsBuilder initializes a builder with canonical production defaults.
func NewRoutingOptionsBuilder() *RoutingOptionsBuilder {
	return &RoutingOptionsBuilder{
		opts: DefaultRoutingOptions(),
	}
}

// WithGridSize sets the discrete spatial routing grid granularity.
func (b *RoutingOptionsBuilder) WithGridSize(gridSize float64) *RoutingOptionsBuilder {
	b.opts.GridSize = gridSize
	return b
}

// WithObstacleClearance sets the margin buffer around block bounding boxes.
func (b *RoutingOptionsBuilder) WithObstacleClearance(clearance float64) *RoutingOptionsBuilder {
	b.opts.ObstacleClearance = clearance
	return b
}

// WithBendPenalty sets penalty weight for line direction changes.
func (b *RoutingOptionsBuilder) WithBendPenalty(penalty float64) *RoutingOptionsBuilder {
	b.opts.BendPenalty = penalty
	return b
}

// WithCrossingPenalty sets penalty weight for crossing other routed wires.
func (b *RoutingOptionsBuilder) WithCrossingPenalty(penalty float64) *RoutingOptionsBuilder {
	b.opts.CrossingPenalty = penalty
	return b
}

// WithChannelSpacing sets separation distance between parallel wire corridors.
func (b *RoutingOptionsBuilder) WithChannelSpacing(spacing float64) *RoutingOptionsBuilder {
	b.opts.ChannelSpacing = spacing
	return b
}

// WithPortExitOffset sets default straight perpendicular exit distance from a pin.
func (b *RoutingOptionsBuilder) WithPortExitOffset(offset float64) *RoutingOptionsBuilder {
	b.opts.PortExitOffset = offset
	return b
}

// WithAdaptivePortExitOffset enables or disables dynamic port stub sizing based on local congestion.
func (b *RoutingOptionsBuilder) WithAdaptivePortExitOffset(adaptive bool) *RoutingOptionsBuilder {
	b.opts.AdaptivePortExitOffset = OptBool(adaptive)
	return b
}

// WithSmoothCorners enables G1 continuous circular arc fillets at wire corners.
func (b *RoutingOptionsBuilder) WithSmoothCorners(smooth bool, radius float64) *RoutingOptionsBuilder {
	b.opts.SmoothCorners = OptBool(smooth)
	b.opts.CornerRadius = OptFloat(radius)
	return b
}

// WithJumpBridges enables bridge hop arcs when wires intersect orthogonally.
func (b *RoutingOptionsBuilder) WithJumpBridges(enable bool) *RoutingOptionsBuilder {
	b.opts.JumpBridges = OptBool(enable)
	return b
}

// WithArtifactCleaning enables or disables redundant waypoint and collinear segment simplification.
func (b *RoutingOptionsBuilder) WithArtifactCleaning(enable bool) *RoutingOptionsBuilder {
	b.opts.ArtifactCleaning = OptBool(enable)
	return b
}

// WithPinAlignment enables micro-shifting wires to align collinearly with facing pins.
func (b *RoutingOptionsBuilder) WithPinAlignment(enable bool) *RoutingOptionsBuilder {
	b.opts.PinAlignment = OptBool(enable)
	return b
}

// WithOptimizationWeights configures sub-objective penalty weights.
func (b *RoutingOptionsBuilder) WithOptimizationWeights(weights OptimizationWeights) *RoutingOptionsBuilder {
	b.opts.Weights = weights
	return b
}

// Build returns the finalized RoutingOptions structure.
func (b *RoutingOptionsBuilder) Build() RoutingOptions {
	return b.opts
}

// NLPOptimizationParamsBuilder provides a fluent builder for NLPOptimizationParams.
type NLPOptimizationParamsBuilder struct {
	params NLPOptimizationParams
}

// NewNLPOptimizationParamsBuilder initializes with canonical solver defaults.
func NewNLPOptimizationParamsBuilder() *NLPOptimizationParamsBuilder {
	return &NLPOptimizationParamsBuilder{
		params: DefaultNLPParams(),
	}
}

// WithIterations sets max gradient descent iterations.
func (b *NLPOptimizationParamsBuilder) WithIterations(iterations int) *NLPOptimizationParamsBuilder {
	b.params.Iterations = iterations
	return b
}

// WithLearningRate sets optimization gradient step size.
func (b *NLPOptimizationParamsBuilder) WithLearningRate(rate float64) *NLPOptimizationParamsBuilder {
	b.params.LearningRate = rate
	return b
}

// WithMomentum sets heavy-ball momentum coefficient.
func (b *NLPOptimizationParamsBuilder) WithMomentum(momentum float64) *NLPOptimizationParamsBuilder {
	b.params.Momentum = momentum
	return b
}

// WithFreezePinnedNodes sets whether pinned blocks remain locked in place during optimization.
func (b *NLPOptimizationParamsBuilder) WithFreezePinnedNodes(freeze bool) *NLPOptimizationParamsBuilder {
	b.params.FreezePinnedNodes = freeze
	return b
}

// Build returns the finalized NLPOptimizationParams structure.
func (b *NLPOptimizationParamsBuilder) Build() NLPOptimizationParams {
	return b.params
}
