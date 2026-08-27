package core

import (
	"context"
	"fmt"
	"sync"
)

// Router defines the unified behavioral contract for diagram wiring algorithms.
type Router interface {
	// Name returns the unique identifier of the router (e.g. "orthogonal-a-star", "manhattan-channel").
	Name() string
	// Route executes path planning for the given nodes and edges with respect to context cancellation.
	Route(ctx context.Context, nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) ([]EdgeConnection, error)
}

// RouterRegistry manages dynamically pluggable routing algorithms.
type RouterRegistry struct {
	mu      sync.RWMutex
	routers map[string]Router
}

var (
	defaultRegistryInstance *RouterRegistry
	registryOnce            sync.Once
)

// DefaultRouterRegistry returns the global singleton router registry initialized with built-in algorithms.
func DefaultRouterRegistry() *RouterRegistry {
	registryOnce.Do(func() {
		defaultRegistryInstance = &RouterRegistry{
			routers: make(map[string]Router),
		}
		defaultRegistryInstance.Register(&OrthogonalAStarRouter{})
		defaultRegistryInstance.Register(&ManhattanChannelRouter{})
		defaultRegistryInstance.Register(&LeeWaveRouter{})
		defaultRegistryInstance.Register(&SmoothSplineRouter{})
		defaultRegistryInstance.Register(&GlobalCoordinatedRouter{})
	})
	return defaultRegistryInstance
}

// Register adds or replaces a router in the registry.
func (r *RouterRegistry) Register(router Router) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.routers[router.Name()] = router
}

// Get retrieves a registered router by name.
func (r *RouterRegistry) Get(name string) (Router, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	router, ok := r.routers[name]
	return router, ok
}

// OrthogonalAStarRouter wraps RouteOrthogonalAStar.
type OrthogonalAStarRouter struct{}

func (r *OrthogonalAStarRouter) Name() string { return "orthogonal-a-star" }
func (r *OrthogonalAStarRouter) Route(ctx context.Context, nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) ([]EdgeConnection, error) {
	return RouteOrthogonalAStarWithContext(ctx, nodes, edges, options)
}

// ManhattanChannelRouter wraps RouteManhattanChannel.
type ManhattanChannelRouter struct{}

func (r *ManhattanChannelRouter) Name() string { return "manhattan-channel" }
func (r *ManhattanChannelRouter) Route(ctx context.Context, nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) ([]EdgeConnection, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return RouteManhattanChannel(nodes, edges, options), nil
}

// LeeWaveRouter wraps RouteLeeWave.
type LeeWaveRouter struct{}

func (r *LeeWaveRouter) Name() string { return "lee-wave" }
func (r *LeeWaveRouter) Route(ctx context.Context, nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) ([]EdgeConnection, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	routed, _ := RouteLeeWave(nodes, edges, options)
	return routed, nil
}

// SmoothSplineRouter wraps RouteSmoothSplines.
type SmoothSplineRouter struct{}

func (r *SmoothSplineRouter) Name() string { return "smooth-splines" }
func (r *SmoothSplineRouter) Route(ctx context.Context, nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) ([]EdgeConnection, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return RouteSmoothSplines(nodes, edges, options), nil
}

// GlobalCoordinatedRouter wraps RouteGlobalCoordinated.
type GlobalCoordinatedRouter struct{}

func (r *GlobalCoordinatedRouter) Name() string { return "global-coordinated" }
func (r *GlobalCoordinatedRouter) Route(ctx context.Context, nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) ([]EdgeConnection, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return RouteGlobalCoordinated(nodes, edges, options, nil), nil
}

// RouteWithAlgorithm executes routing using the named algorithm from the default registry.
func RouteWithAlgorithm(ctx context.Context, algorithm string, nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) ([]EdgeConnection, error) {
	router, ok := DefaultRouterRegistry().Get(algorithm)
	if !ok {
		return nil, fmt.Errorf("autotrace router %q is not registered", algorithm)
	}
	return router.Route(ctx, nodes, edges, options)
}
