package core

import (
	"errors"
	"testing"
)

func incrementalFixture() SceneOpenRequest {
	return SceneOpenRequest{
		GraphID: "scene-1",
		Revision: 1,
		Nodes: []BlockNode{
			{ID: "a", Title: "A", X: 0, Y: 0, Width: 80, Height: 50, Outputs: []Port{{ID: "out", Side: SideRight, Type: "output"}}},
			{ID: "b", Title: "B", X: 360, Y: 0, Width: 80, Height: 50, Inputs: []Port{{ID: "in", Side: SideLeft, Type: "input"}}},
			{ID: "c", Title: "C", X: 160, Y: 220, Width: 80, Height: 60},
		},
		Edges: []EdgeConnection{{ID: "e1", SourceBlockID: "a", SourcePortID: "out", TargetBlockID: "b", TargetPortID: "in"}},
		Options: RoutingOptions{GridSize: 10, ObstacleClearance: 10, ArtifactCleaning: true},
	}
}

func TestSceneEngineReusesUnaffectedRoute(t *testing.T) {
	engine := NewEngine()
	opened, err := engine.Open(incrementalFixture())
	if err != nil { t.Fatal(err) }
	if opened.ReroutedEdges != 1 || opened.ReusedEdges != 0 { t.Fatalf("unexpected open stats: %#v", opened) }
	patched, err := engine.Patch(ScenePatchRequest{GraphID: "scene-1", Patch: ScenePatch{
		BaseRevision: 1,
		Revision: 2,
		ChangedBlocks: []BlockNode{{ID: "c", Title: "C moved far away", X: 700, Y: 400, Width: 80, Height: 60}},
	}})
	if err != nil { t.Fatal(err) }
	if patched.ReusedEdges != 1 || patched.ReroutedEdges != 0 { t.Fatalf("expected reuse, got %#v", patched) }
	if len(patched.Edges) != 1 || len(patched.Edges[0].Path) < 2 { t.Fatalf("route disappeared: %#v", patched.Edges) }
}

func TestSceneEngineReroutesWhenObstacleEntersPath(t *testing.T) {
	engine := NewEngine()
	if _, err := engine.Open(incrementalFixture()); err != nil { t.Fatal(err) }
	patched, err := engine.Patch(ScenePatchRequest{GraphID: "scene-1", Patch: ScenePatch{
		BaseRevision: 1,
		Revision: 2,
		ChangedBlocks: []BlockNode{{ID: "c", Title: "C", X: 150, Y: -20, Width: 100, Height: 90}},
	}})
	if err != nil { t.Fatal(err) }
	if patched.ReroutedEdges != 1 || patched.ReusedEdges != 0 { t.Fatalf("expected reroute, got %#v", patched) }
	if len(patched.ReroutedEdgeIDs) != 1 || patched.ReroutedEdgeIDs[0] != "e1" { t.Fatalf("unexpected ids: %#v", patched.ReroutedEdgeIDs) }
	if pathTouchesObstacle(patched.Edges[0].Path, patched.Nodes[2], 9) { t.Fatalf("rerouted path still crosses obstacle: %#v", patched.Edges[0].Path) }
}

func TestSceneEngineRejectsStalePatch(t *testing.T) {
	engine := NewEngine()
	if _, err := engine.Open(incrementalFixture()); err != nil { t.Fatal(err) }
	_, err := engine.Patch(ScenePatchRequest{GraphID: "scene-1", Patch: ScenePatch{BaseRevision: 0, Revision: 1}})
	if !errors.Is(err, ErrRevisionConflict) { t.Fatalf("expected revision conflict, got %v", err) }
}

func TestSceneEngineRejectsDanglingEdgeAfterBlockRemoval(t *testing.T) {
	engine := NewEngine()
	if _, err := engine.Open(incrementalFixture()); err != nil { t.Fatal(err) }
	_, err := engine.Patch(ScenePatchRequest{GraphID: "scene-1", Patch: ScenePatch{BaseRevision: 1, Revision: 2, RemovedBlockIDs: []string{"b"}}})
	if err == nil { t.Fatal("expected dangling edge validation error") }
}

func TestSceneEngineCloseAndSnapshotIsolation(t *testing.T) {
	engine := NewEngine()
	if _, err := engine.Open(incrementalFixture()); err != nil { t.Fatal(err) }
	first, err := engine.Snapshot("scene-1")
	if err != nil { t.Fatal(err) }
	first.Nodes[0].Title = "mutated outside"
	first.Edges[0].Path[0].X = 99999
	second, err := engine.Snapshot("scene-1")
	if err != nil { t.Fatal(err) }
	if second.Nodes[0].Title == "mutated outside" || second.Edges[0].Path[0].X == 99999 { t.Fatal("snapshot leaked mutable state") }
	if !engine.Close("scene-1") { t.Fatal("expected close to remove scene") }
	if _, err := engine.Snapshot("scene-1"); !errors.Is(err, ErrSceneNotFound) { t.Fatalf("expected scene not found, got %v", err) }
}

func BenchmarkScenePatchReuse(b *testing.B) {
	for i := 0; i < b.N; i++ {
		engine := NewEngine()
		if _, err := engine.Open(incrementalFixture()); err != nil { b.Fatal(err) }
		if _, err := engine.Patch(ScenePatchRequest{GraphID: "scene-1", Patch: ScenePatch{BaseRevision: 1, Revision: 2, ChangedBlocks: []BlockNode{{ID: "c", X: 700, Y: 400, Width: 80, Height: 60}}}}); err != nil { b.Fatal(err) }
	}
}
