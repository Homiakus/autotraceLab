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
		Options: RoutingOptions{GridSize: 10, ObstacleClearance: 10, ArtifactCleaning: OptBool(true)},
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

func TestSceneEngine_IncrementalMathematicalEquivalence(t *testing.T) {
	engine := NewEngine()
	initReq := incrementalFixture()
	initReq.GraphID = "scene-equiv"

	// Open initial
	_, err := engine.Open(initReq)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}

	// Apply patch 1: Move block C
	patch1, err := engine.Patch(ScenePatchRequest{
		GraphID: "scene-equiv",
		Patch: ScenePatch{
			BaseRevision: 1,
			Revision:     2,
			ChangedBlocks: []BlockNode{
				{ID: "c", Title: "C moved", X: 160, Y: 10, Width: 80, Height: 60},
			},
		},
	})
	if err != nil {
		t.Fatalf("Patch 1 failed: %v", err)
	}
	if patch1.Revision != 2 {
		t.Errorf("Expected revision 2, got %d", patch1.Revision)
	}

	// Apply patch 2: Add new block D and edge e2
	patch2, err := engine.Patch(ScenePatchRequest{
		GraphID: "scene-equiv",
		Patch: ScenePatch{
			BaseRevision: 2,
			Revision:     3,
			ChangedBlocks: []BlockNode{
				{
					ID: "d", Title: "D", X: 500, Y: 200, Width: 100, Height: 60,
					Inputs: []Port{{ID: "in_d", Side: SideLeft, Type: "input"}},
				},
			},
			ChangedEdges: []EdgeConnection{
				{ID: "e2", SourceBlockID: "b", SourcePortID: "in", TargetBlockID: "d", TargetPortID: "in_d"},
			},
		},
	})
	if err != nil {
		t.Fatalf("Patch 2 failed: %v", err)
	}
	if patch2.Revision != 3 {
		t.Errorf("Expected revision 3, got %d", patch2.Revision)
	}

	// Fresh full open of the final state
	freshReq := SceneOpenRequest{
		GraphID:  "scene-fresh",
		Revision: 1,
		Nodes:    patch2.Nodes,
		Edges:    patch2.Edges,
		Options:  initReq.Options,
	}
	engineFresh := NewEngine()
	freshRes, err := engineFresh.Open(freshReq)
	if err != nil {
		t.Fatalf("Fresh open failed: %v", err)
	}

	// Verify mathematical equivalence between incremental final state and fresh open state
	if len(patch2.Nodes) != len(freshRes.Nodes) {
		t.Fatalf("Node counts differ: incremental=%d, fresh=%d", len(patch2.Nodes), len(freshRes.Nodes))
	}
	if len(patch2.Edges) != len(freshRes.Edges) {
		t.Fatalf("Edge counts differ: incremental=%d, fresh=%d", len(patch2.Edges), len(freshRes.Edges))
	}

	for i := range patch2.Nodes {
		nInc := patch2.Nodes[i]
		nFresh := freshRes.Nodes[i]
		if nInc.ID != nFresh.ID || nInc.X != nFresh.X || nInc.Y != nFresh.Y {
			t.Errorf("Node mismatch at %d: inc=(%s, %.1f, %.1f) vs fresh=(%s, %.1f, %.1f)",
				i, nInc.ID, nInc.X, nInc.Y, nFresh.ID, nFresh.X, nFresh.Y)
		}
	}

	for i := range patch2.Edges {
		eInc := patch2.Edges[i]
		eFresh := freshRes.Edges[i]
		if eInc.ID != eFresh.ID || len(eInc.Path) != len(eFresh.Path) {
			t.Errorf("Edge mismatch at %d: inc=(%s, %d pts) vs fresh=(%s, %d pts)",
				i, eInc.ID, len(eInc.Path), eFresh.ID, len(eFresh.Path))
		}
	}
}

func TestSceneEngine_UpdateOptionsAndRevisions(t *testing.T) {
	engine := NewEngine()
	req := incrementalFixture()
	req.GraphID = "scene-opt"
	opened, err := engine.Open(req)
	if err != nil {
		t.Fatal(err)
	}
	if opened.Revision != 1 {
		t.Errorf("Expected revision 1, got %d", opened.Revision)
	}

	newOpts := req.Options
	newOpts.GridSize = 20
	newOpts.ObstacleClearance = 25

	updated, err := engine.UpdateOptions("scene-opt", newOpts)
	if err != nil {
		t.Fatal(err)
	}
	if updated.Revision != 2 {
		t.Errorf("Expected revision 2 after options update, got %d", updated.Revision)
	}
	if updated.ReroutedEdges != len(req.Edges) {
		t.Errorf("Expected all %d edges rerouted on options update, got %d", len(req.Edges), updated.ReroutedEdges)
	}
}

func BenchmarkScenePatchReuse(b *testing.B) {
	for i := 0; i < b.N; i++ {
		engine := NewEngine()
		if _, err := engine.Open(incrementalFixture()); err != nil { b.Fatal(err) }
		if _, err := engine.Patch(ScenePatchRequest{GraphID: "scene-1", Patch: ScenePatch{BaseRevision: 1, Revision: 2, ChangedBlocks: []BlockNode{{ID: "c", X: 700, Y: 400, Width: 80, Height: 60}}}}); err != nil { b.Fatal(err) }
	}
}
