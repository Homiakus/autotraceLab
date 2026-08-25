package main

import (
	"encoding/json"
	"testing"

	core "github.com/Homiakus/autotraceLab/go_engine/core"
)

func sceneProtocolCall(t *testing.T, requestID, operation string, payload any) graphProtocolResponse {
	t.Helper()
	encodedPayload, err := json.Marshal(payload)
	if err != nil { t.Fatal(err) }
	encodedRequest, err := json.Marshal(graphProtocolRequest{Protocol: graphProtocolVersion, RequestID: requestID, Operation: operation, Payload: encodedPayload})
	if err != nil { t.Fatal(err) }
	var response graphProtocolResponse
	if err := json.Unmarshal(handleGraphProtocol(encodedRequest), &response); err != nil { t.Fatal(err) }
	return response
}

func TestGraphProtocolAdvertisesIncrementalScenes(t *testing.T) {
	response := sceneProtocolCall(t, "hello-scene", "hello", map[string]any{})
	if !response.OK { t.Fatalf("hello failed: %#v", response.Error) }
	value, ok := response.Value.(map[string]any)
	if !ok { // interface maps are materialized only after a JSON roundtrip; inspect serialized value instead.
		raw, _ := json.Marshal(response)
		var decoded struct { Value struct { Capabilities map[string]any `json:"capabilities"` } `json:"value"` }
		if err := json.Unmarshal(raw, &decoded); err != nil { t.Fatal(err) }
		if decoded.Value.Capabilities["incrementalScenes"] != true || decoded.Value.Capabilities["scenePatch"] != true { t.Fatalf("capabilities = %#v", decoded.Value.Capabilities) }
		return
	}
	caps, _ := value["capabilities"].(map[string]any)
	if caps["incrementalScenes"] != true { t.Fatalf("capabilities = %#v", caps) }
}

func TestGraphProtocolSceneLifecycle(t *testing.T) {
	graphID := "protocol-scene-lifecycle"
	graphSceneEngine.Close(graphID)
	defer graphSceneEngine.Close(graphID)
	open := core.SceneOpenRequest{
		GraphID: graphID,
		Revision: 1,
		Nodes: []core.BlockNode{
			{ID: "a", X: 0, Y: 0, Width: 80, Height: 50, Outputs: []core.Port{{ID: "out", Side: core.SideRight, Type: "output"}}},
			{ID: "b", X: 360, Y: 0, Width: 80, Height: 50, Inputs: []core.Port{{ID: "in", Side: core.SideLeft, Type: "input"}}},
			{ID: "c", X: 160, Y: 220, Width: 80, Height: 60},
		},
		Edges: []core.EdgeConnection{{ID: "e1", SourceBlockID: "a", SourcePortID: "out", TargetBlockID: "b", TargetPortID: "in"}},
		Options: core.RoutingOptions{GridSize: 10, ObstacleClearance: 10, ArtifactCleaning: true},
	}
	response := sceneProtocolCall(t, "open", "scene.open", open)
	if !response.OK || response.Error != nil { t.Fatalf("open failed: %#v", response.Error) }

	patch := core.ScenePatchRequest{GraphID: graphID, Patch: core.ScenePatch{
		BaseRevision: 1,
		Revision: 2,
		ChangedBlocks: []core.BlockNode{{ID: "c", X: 700, Y: 400, Width: 80, Height: 60}},
	}}
	response = sceneProtocolCall(t, "patch", "scene.patch", patch)
	if !response.OK || response.Error != nil { t.Fatalf("patch failed: %#v", response.Error) }
	raw, _ := json.Marshal(response.Value)
	var scene core.SceneResult
	if err := json.Unmarshal(raw, &scene); err != nil { t.Fatal(err) }
	if scene.Revision != 2 || scene.ReusedEdges != 1 || scene.ReroutedEdges != 0 { t.Fatalf("unexpected scene result: %#v", scene) }

	response = sceneProtocolCall(t, "snapshot", "scene.snapshot", map[string]any{"graphId": graphID})
	if !response.OK { t.Fatalf("snapshot failed: %#v", response.Error) }

	response = sceneProtocolCall(t, "close", "scene.close", map[string]any{"graphId": graphID})
	if !response.OK { t.Fatalf("close failed: %#v", response.Error) }
	response = sceneProtocolCall(t, "missing", "scene.snapshot", map[string]any{"graphId": graphID})
	if response.OK || response.Error == nil || response.Error.Code != "AUTOTRACE_SCENE_NOT_FOUND" { t.Fatalf("expected not found: %#v", response) }
}

func TestGraphProtocolSceneRejectsStaleRevision(t *testing.T) {
	graphID := "protocol-scene-stale"
	graphSceneEngine.Close(graphID)
	defer graphSceneEngine.Close(graphID)
	open := core.SceneOpenRequest{GraphID: graphID, Revision: 4, Nodes: []core.BlockNode{{ID: "a", Width: 10, Height: 10}}}
	if response := sceneProtocolCall(t, "open-stale", "scene.open", open); !response.OK { t.Fatalf("open failed: %#v", response.Error) }
	response := sceneProtocolCall(t, "stale", "scene.patch", core.ScenePatchRequest{GraphID: graphID, Patch: core.ScenePatch{BaseRevision: 3, Revision: 4}})
	if response.OK || response.Error == nil || response.Error.Code != "AUTOTRACE_REVISION_CONFLICT" || !response.Error.Retryable { t.Fatalf("expected retryable conflict: %#v", response) }
	if response.Error.Details["actualRevision"] != float64(4) && response.Error.Details["actualRevision"] != 4 { t.Fatalf("missing actual revision: %#v", response.Error.Details) }
}
