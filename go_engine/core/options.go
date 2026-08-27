package core

// OptFloat returns a pointer to a float64 value.
func OptFloat(v float64) *float64 {
	return &v
}

// OptInt returns a pointer to an int value.
func OptInt(v int) *int {
	return &v
}

// OptBool returns a pointer to a bool value.
func OptBool(v bool) *bool {
	return &v
}

// FloatVal safely unwraps *float64 or returns the default fallback.
func FloatVal(p *float64, defaultVal float64) float64 {
	if p == nil {
		return defaultVal
	}
	return *p
}

// IntVal safely unwraps *int or returns the default fallback.
func IntVal(p *int, defaultVal int) int {
	if p == nil {
		return defaultVal
	}
	return *p
}

// BoolVal safely unwraps *bool or returns the default fallback.
func BoolVal(p *bool, defaultVal bool) bool {
	if p == nil {
		return defaultVal
	}
	return *p
}

// DefaultOptimizationWeights returns the canonical default optimization weights.
func DefaultOptimizationWeights() OptimizationWeights {
	return OptimizationWeights{
		CrossingWeight:      95.0,
		StraightnessWeight:  90.0,
		G1SplineWeight:      65.0,
		PortAlignmentWeight: 80.0,
		ClearanceWeight:     90.0,
		WirelengthWeight:    15.0,
		BendWeight:          25.0,
		LabelOverlapWeight:  75.0,
	}
}

// DefaultRoutingOptions returns canonical production routing defaults.
func DefaultRoutingOptions() RoutingOptions {
	return RoutingOptions{
		GridSize:               10.0,
		ObstacleClearance:      10.0,
		BendPenalty:            35.0,
		CrossingPenalty:        50.0,
		ChannelSpacing:         16.0,
		PortExitOffset:         24.0,
		AdaptivePortExitOffset: OptBool(true),
		SmoothCorners:          OptBool(false),
		CornerRadius:           OptFloat(8.0),
		AdaptiveCornerRadius:   OptBool(true),
		LabelClearance:         OptFloat(8.0),
		StrictLabels:           OptBool(true),
		MinWireDistance:        OptFloat(16.0),
		OptimalBlockDistance:   OptFloat(200.0),
		OptimalWireDistance:    OptFloat(20.0),
		JumpBridges:            OptBool(false),
		PinAlignment:           OptBool(true),
		ArtifactCleaning:       OptBool(true),
		Weights:                DefaultOptimizationWeights(),
	}
}
