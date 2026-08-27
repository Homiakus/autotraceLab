package core

import (
	"context"
	"fmt"
	"sync"
	"testing"
)

func TestEngine_ConcurrentMultiSceneExecution(t *testing.T) {
	engine := NewEngine()
	numScenes := 20
	numWorkers := 10
	var wg sync.WaitGroup

	// Pre-open scenes
	for i := 0; i < numScenes; i++ {
		graphID := fmt.Sprintf("scene-%d", i)
		nodes := []BlockNode{
			{ID: "n1", X: 50, Y: 50, Width: 100, Height: 80, Outputs: []Port{{ID: "out1"}}},
			{ID: "n2", X: 300, Y: 50, Width: 100, Height: 80, Inputs: []Port{{ID: "in1"}}},
		}
		edges := []EdgeConnection{
			{ID: "e1", SourceBlockID: "n1", SourcePortID: "out1", TargetBlockID: "n2", TargetPortID: "in1"},
		}
		opts := DefaultRoutingOptions()
		_, err := engine.Open(SceneOpenRequest{
			GraphID:  graphID,
			Revision: 1,
			Nodes:    nodes,
			Edges:    edges,
			Options:  opts,
		})
		if err != nil {
			t.Fatalf("failed to open scene %s: %v", graphID, err)
		}
	}

	// Concurrently patch, snapshot, and update options across different scenes
	for w := 0; w < numWorkers; w++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for iter := 0; iter < 15; iter++ {
				sceneIdx := (workerID*15 + iter) % numScenes
				graphID := fmt.Sprintf("scene-%d", sceneIdx)

				// Snapshot
				snap, err := engine.Snapshot(graphID)
				if err != nil {
					t.Errorf("snapshot error on %s: %v", graphID, err)
					return
				}

				// Patch
				baseRev := snap.Revision
				patch := ScenePatch{
					BaseRevision: baseRev,
					Revision:     baseRev + 1,
					ChangedBlocks: []BlockNode{
						{ID: "n2", X: 320.0 + float64(iter)*5.0, Y: 60.0 + float64(iter)*2.0, Width: 100, Height: 80, Inputs: []Port{{ID: "in1"}}},
					},
				}
				_, err = engine.Patch(ScenePatchRequest{
					GraphID: graphID,
					Patch:   patch,
				})
				if err != nil && err != ErrRevisionConflict {
					// Revision conflict can happen under high contention for same scene, which is valid optimistic concurrency behavior
					if !IsRevisionConflict(err) {
						t.Errorf("unexpected patch error on %s: %v", graphID, err)
					}
				}
			}
		}(w)
	}

	wg.Wait()

	// Verify all scenes can be snapshotted and closed cleanly
	for i := 0; i < numScenes; i++ {
		graphID := fmt.Sprintf("scene-%d", i)
		snap, err := engine.Snapshot(graphID)
		if err != nil {
			t.Errorf("final snapshot failed on %s: %v", graphID, err)
		}
		if snap.Revision < 1 {
			t.Errorf("expected revision >= 1, got %d on %s", snap.Revision, graphID)
		}
		if !engine.Close(graphID) {
			t.Errorf("failed to close %s", graphID)
		}
	}
}

func TestEngine_CancellationAbortsEarly(t *testing.T) {
	engine := NewEngine()
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	nodes := []BlockNode{
		{ID: "n1", X: 50, Y: 50, Width: 100, Height: 80, Outputs: []Port{{ID: "out1"}}},
		{ID: "n2", X: 400, Y: 200, Width: 100, Height: 80, Inputs: []Port{{ID: "in1"}}},
	}
	edges := []EdgeConnection{
		{ID: "e1", SourceBlockID: "n1", SourcePortID: "out1", TargetBlockID: "n2", TargetPortID: "in1"},
	}

	_, err := engine.OpenWithContext(ctx, SceneOpenRequest{
		GraphID:  "cancel-scene",
		Revision: 1,
		Nodes:    nodes,
		Edges:    edges,
		Options:  DefaultRoutingOptions(),
	})
	if err == nil {
		t.Fatal("expected cancellation error, got nil")
	}

	// Verify scene was not created
	_, err = engine.Snapshot("cancel-scene")
	if err == nil {
		t.Fatal("expected scene not found after cancelled open")
	}
}

func IsRevisionConflict(err error) bool {
	if err == nil {
		return false
	}
	if err == ErrRevisionConflict {
		return true
	}
	_, ok := err.(*RevisionConflictError)
	return ok
}
