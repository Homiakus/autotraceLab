package core

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"
)

var (
	ErrSceneNotFound    = errors.New("autotrace scene not found")
	ErrRevisionConflict = errors.New("autotrace scene revision conflict")
)

type RevisionConflictError struct {
	GraphID  string
	Expected int
	Actual   int
}

func (e *RevisionConflictError) Error() string {
	return fmt.Sprintf("scene %q revision conflict: expected base %d, current %d", e.GraphID, e.Expected, e.Actual)
}

func (e *RevisionConflictError) Unwrap() error { return ErrRevisionConflict }

type SceneOpenRequest struct {
	GraphID  string         `json:"graphId"`
	Revision int            `json:"revision"`
	Nodes    []BlockNode    `json:"nodes"`
	Edges    []EdgeConnection `json:"edges"`
	Options  RoutingOptions `json:"options"`
}

type ScenePatchRequest struct {
	GraphID string     `json:"graphId"`
	Patch   ScenePatch `json:"patch"`
}

type SceneResult struct {
	GraphID          string             `json:"graphId"`
	Revision         int                `json:"revision"`
	Nodes            []BlockNode        `json:"nodes"`
	Edges            []EdgeConnection   `json:"edges"`
	Metrics          BenchmarkMetrics   `json:"metrics"`
	DurationMs       float64            `json:"durationMs"`
	ReusedEdges      int                `json:"reusedEdges"`
	ReroutedEdges    int                `json:"reroutedEdges"`
	ReroutedEdgeIDs  []string           `json:"reroutedEdgeIds,omitempty"`
	Engine           string             `json:"engine"`
	ContractVersion  int                `json:"contractVersion"`
}

type sceneState struct {
	revision int
	nodes    map[string]BlockNode
	nodeOrder []string
	edges    map[string]EdgeConnection
	edgeOrder []string
	options  RoutingOptions
	metrics  BenchmarkMetrics
}

// Engine owns revisioned graph scenes and reuses routes that remain valid after
// a patch. It is safe for concurrent native callers; the WASM bridge uses one
// process-wide instance so scene state survives across protocol calls.
type Engine struct {
	mu     sync.RWMutex
	scenes map[string]*sceneState
}

func NewEngine() *Engine { return &Engine{scenes: make(map[string]*sceneState)} }

func (e *Engine) Open(request SceneOpenRequest) (SceneResult, error) {
	return e.OpenWithContext(context.Background(), request)
}

func (e *Engine) OpenWithContext(ctx context.Context, request SceneOpenRequest) (SceneResult, error) {
	if err := ctx.Err(); err != nil {
		return SceneResult{}, err
	}
	if request.GraphID == "" {
		return SceneResult{}, fmt.Errorf("graph id is required")
	}
	if request.Revision <= 0 {
		request.Revision = 1
	}
	if err := ValidateScene(request.Nodes, request.Edges); err != nil {
		return SceneResult{}, err
	}
	started := time.Now()
	routed := RouteOrthogonalAStar(request.Nodes, request.Edges, request.Options)
	if err := ctx.Err(); err != nil {
		return SceneResult{}, err
	}
	duration := elapsedMs(started)
	metrics := CalculateDetailedMetrics(request.Nodes, routed, "preserve-input-layout", "orthogonal-a-star", duration, &request.Options)
	state := newSceneState(request.Revision, request.Nodes, routed, request.Options, metrics)
	e.mu.Lock()
	e.scenes[request.GraphID] = state
	e.mu.Unlock()
	ids := make([]string, 0, len(routed))
	for _, edge := range routed { ids = append(ids, edge.ID) }
	return sceneResult(request.GraphID, state, duration, 0, len(routed), ids), nil
}

func (e *Engine) Patch(request ScenePatchRequest) (SceneResult, error) {
	return e.PatchWithContext(context.Background(), request)
}

func (e *Engine) PatchWithContext(ctx context.Context, request ScenePatchRequest) (SceneResult, error) {
	if err := ctx.Err(); err != nil {
		return SceneResult{}, err
	}
	if request.GraphID == "" {
		return SceneResult{}, fmt.Errorf("graph id is required")
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	state, ok := e.scenes[request.GraphID]
	if !ok {
		return SceneResult{}, fmt.Errorf("%w: %s", ErrSceneNotFound, request.GraphID)
	}
	patch := request.Patch
	if patch.BaseRevision != state.revision {
		return SceneResult{}, &RevisionConflictError{GraphID: request.GraphID, Expected: patch.BaseRevision, Actual: state.revision}
	}
	if patch.Revision != patch.BaseRevision+1 {
		return SceneResult{}, fmt.Errorf("scene %q revision must advance exactly by one: base=%d next=%d", request.GraphID, patch.BaseRevision, patch.Revision)
	}

	started := time.Now()
	nodes := cloneNodeMap(state.nodes)
	nodeOrder := append([]string(nil), state.nodeOrder...)
	edges := cloneEdgeMap(state.edges)
	edgeOrder := append([]string(nil), state.edgeOrder...)
	dirtyNodes := make(map[string]struct{})
	dirtyEdges := make(map[string]struct{})

	for _, id := range patch.RemovedEdgeIDs {
		delete(edges, id)
		edgeOrder = removeID(edgeOrder, id)
		dirtyEdges[id] = struct{}{}
	}
	for _, id := range patch.RemovedBlockIDs {
		delete(nodes, id)
		nodeOrder = removeID(nodeOrder, id)
		dirtyNodes[id] = struct{}{}
	}
	for _, node := range patch.ChangedBlocks {
		if node.ID == "" { return SceneResult{}, fmt.Errorf("changed block id is required") }
		if _, exists := nodes[node.ID]; !exists { nodeOrder = append(nodeOrder, node.ID) }
		nodes[node.ID] = cloneNode(node)
		dirtyNodes[node.ID] = struct{}{}
	}
	for _, edge := range patch.ChangedEdges {
		if edge.ID == "" { return SceneResult{}, fmt.Errorf("changed edge id is required") }
		if _, exists := edges[edge.ID]; !exists { edgeOrder = append(edgeOrder, edge.ID) }
		edges[edge.ID] = cloneEdge(edge)
		dirtyEdges[edge.ID] = struct{}{}
	}

	nodeList := orderedNodes(nodes, nodeOrder)
	edgeList := orderedEdges(edges, edgeOrder)
	if err := ValidateScene(nodeList, edgeList); err != nil {
		return SceneResult{}, err
	}

	clearance := state.options.ObstacleClearance
	if clearance <= 0 { clearance = 15 }
	dirtyObstacles := make([]BlockNode, 0, len(dirtyNodes))
	for id := range dirtyNodes {
		if node, exists := nodes[id]; exists { dirtyObstacles = append(dirtyObstacles, node) }
	}

	routed := make([]EdgeConnection, 0, len(edgeList))
	reroutedIDs := make([]string, 0)
	reused := 0
	for _, edge := range edgeList {
		previous, hadPrevious := state.edges[edge.ID]
		_, explicitlyChanged := dirtyEdges[edge.ID]
		needsRoute := explicitlyChanged || !hadPrevious || len(previous.Path) < 2
		if !needsRoute {
			_, sourceDirty := dirtyNodes[edge.SourceBlockID]
			_, targetDirty := dirtyNodes[edge.TargetBlockID]
			needsRoute = sourceDirty || targetDirty
		}
		if !needsRoute {
			for _, obstacle := range dirtyObstacles {
				if obstacle.ID == edge.SourceBlockID || obstacle.ID == edge.TargetBlockID { continue }
				if pathTouchesObstacle(previous.Path, obstacle, clearance) { needsRoute = true; break }
			}
		}
		if needsRoute {
			one := RouteOrthogonalAStar(nodeList, []EdgeConnection{edge}, state.options)
			if len(one) == 1 { edge = one[0] }
			reroutedIDs = append(reroutedIDs, edge.ID)
		} else {
			edge = cloneEdge(previous)
			reused++
		}
		routed = append(routed, edge)
	}

	duration := elapsedMs(started)
	metrics := CalculateDetailedMetrics(nodeList, routed, "incremental-preserve-layout", "orthogonal-a-star", duration, &state.options)
	state.revision = patch.Revision
	state.nodes = nodes
	state.nodeOrder = nodeOrder
	state.edges = make(map[string]EdgeConnection, len(routed))
	state.edgeOrder = edgeOrder
	for _, edge := range routed { state.edges[edge.ID] = cloneEdge(edge) }
	state.metrics = metrics
	return sceneResult(request.GraphID, state, duration, reused, len(reroutedIDs), reroutedIDs), nil
}

func (e *Engine) UpdateOptions(graphID string, options RoutingOptions) (SceneResult, error) {
	return e.UpdateOptionsWithContext(context.Background(), graphID, options)
}

func (e *Engine) UpdateOptionsWithContext(ctx context.Context, graphID string, options RoutingOptions) (SceneResult, error) {
	if err := ctx.Err(); err != nil {
		return SceneResult{}, err
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	state, ok := e.scenes[graphID]
	if !ok {
		return SceneResult{}, fmt.Errorf("%w: %s", ErrSceneNotFound, graphID)
	}

	started := time.Now()
	state.options = options
	nodeList := orderedNodes(state.nodes, state.nodeOrder)
	edgeList := orderedEdges(state.edges, state.edgeOrder)

	routed := RouteOrthogonalAStar(nodeList, edgeList, options)
	if err := ctx.Err(); err != nil {
		return SceneResult{}, err
	}
	duration := elapsedMs(started)
	metrics := CalculateDetailedMetrics(nodeList, routed, "preserve-input-layout", "orthogonal-a-star", duration, &options)

	state.revision++
	state.edges = make(map[string]EdgeConnection, len(routed))
	for _, edge := range routed {
		state.edges[edge.ID] = cloneEdge(edge)
	}
	state.metrics = metrics

	ids := make([]string, 0, len(routed))
	for _, edge := range routed {
		ids = append(ids, edge.ID)
	}

	return sceneResult(graphID, state, duration, 0, len(routed), ids), nil
}

func (e *Engine) Snapshot(graphID string) (SceneResult, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	state, ok := e.scenes[graphID]
	if !ok { return SceneResult{}, fmt.Errorf("%w: %s", ErrSceneNotFound, graphID) }
	return sceneResult(graphID, state, 0, len(state.edges), 0, nil), nil
}

func (e *Engine) Close(graphID string) bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	if _, ok := e.scenes[graphID]; !ok { return false }
	delete(e.scenes, graphID)
	return true
}

func newSceneState(revision int, nodes []BlockNode, edges []EdgeConnection, options RoutingOptions, metrics BenchmarkMetrics) *sceneState {
	state := &sceneState{revision: revision, nodes: make(map[string]BlockNode, len(nodes)), edges: make(map[string]EdgeConnection, len(edges)), options: options, metrics: metrics}
	for _, node := range nodes { state.nodes[node.ID] = cloneNode(node); state.nodeOrder = append(state.nodeOrder, node.ID) }
	for _, edge := range edges { state.edges[edge.ID] = cloneEdge(edge); state.edgeOrder = append(state.edgeOrder, edge.ID) }
	return state
}

func sceneResult(graphID string, state *sceneState, duration float64, reused, rerouted int, reroutedIDs []string) SceneResult {
	return SceneResult{
		GraphID: graphID,
		Revision: state.revision,
		Nodes: orderedNodes(state.nodes, state.nodeOrder),
		Edges: orderedEdges(state.edges, state.edgeOrder),
		Metrics: state.metrics,
		DurationMs: duration,
		ReusedEdges: reused,
		ReroutedEdges: rerouted,
		ReroutedEdgeIDs: append([]string(nil), reroutedIDs...),
		Engine: EngineID,
		ContractVersion: ContractVersion,
	}
}

func orderedNodes(values map[string]BlockNode, order []string) []BlockNode {
	result := make([]BlockNode, 0, len(values))
	for _, id := range order { if value, ok := values[id]; ok { result = append(result, cloneNode(value)) } }
	return result
}

func orderedEdges(values map[string]EdgeConnection, order []string) []EdgeConnection {
	result := make([]EdgeConnection, 0, len(values))
	for _, id := range order { if value, ok := values[id]; ok { result = append(result, cloneEdge(value)) } }
	return result
}

func cloneNodeMap(input map[string]BlockNode) map[string]BlockNode {
	result := make(map[string]BlockNode, len(input)); for id, value := range input { result[id] = cloneNode(value) }; return result
}
func cloneEdgeMap(input map[string]EdgeConnection) map[string]EdgeConnection {
	result := make(map[string]EdgeConnection, len(input)); for id, value := range input { result[id] = cloneEdge(value) }; return result
}
func cloneNode(node BlockNode) BlockNode {
	node.Inputs = append([]Port(nil), node.Inputs...)
	node.Outputs = append([]Port(nil), node.Outputs...)
	node.Ports = append([]Port(nil), node.Ports...)
	return node
}
func cloneEdge(edge EdgeConnection) EdgeConnection { edge.Path = append([]Point(nil), edge.Path...); return edge }
func removeID(values []string, target string) []string {
	result := values[:0]; for _, value := range values { if value != target { result = append(result, value) } }; return result
}
func elapsedMs(started time.Time) float64 { return float64(time.Since(started).Microseconds()) / 1000 }

func pathTouchesObstacle(path []Point, node BlockNode, clearance float64) bool {
	minX, maxX := node.X-clearance, node.X+node.Width+clearance
	minY, maxY := node.Y-clearance, node.Y+node.Height+clearance
	for i := 0; i+1 < len(path); i++ {
		a, b := path[i], path[i+1]
		segMinX, segMaxX := math.Min(a.X, b.X), math.Max(a.X, b.X)
		segMinY, segMaxY := math.Min(a.Y, b.Y), math.Max(a.Y, b.Y)
		if segMaxX >= minX && segMinX <= maxX && segMaxY >= minY && segMinY <= maxY { return true }
	}
	return false
}
