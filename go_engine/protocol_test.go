package main

import (
	"encoding/json"
	"testing"

	core "github.com/Homiakus/autotraceLab/go_engine/core"
)

func TestGraphProtocolRejectsVersionMismatch(t *testing.T) {
	var res graphProtocolResponse
	if err := json.Unmarshal(handleGraphProtocol([]byte(`{"protocol":9,"requestId":"x","operation":"hello","payload":{}}`)), &res); err != nil {
		t.Fatal(err)
	}
	if res.OK || res.Error == nil || res.Error.Code != "AUTOTRACE_PROTOCOL_MISMATCH" {
		t.Fatalf("response = %#v", res)
	}
}

func TestGraphProtocolRoutesSimpleGraph(t *testing.T) {
	payload := graphLayoutPayload{
		GraphID: "g1",
		Nodes: []core.BlockNode{
			{ID: "a", Title: "A", Category: "source", X: 0, Y: 0, Width: 80, Height: 50, Outputs: []core.Port{{ID: "out", Name: "out", Side: core.SideRight, Type: "output"}}},
			{ID: "b", Title: "B", Category: "sink", X: 300, Y: 0, Width: 80, Height: 50, Inputs: []core.Port{{ID: "in", Name: "in", Side: core.SideLeft, Type: "input"}}},
		},
		Edges:   []core.EdgeConnection{{ID: "e1", SourceBlockID: "a", SourcePortID: "out", TargetBlockID: "b", TargetPortID: "in"}},
		Options: core.RoutingOptions{GridSize: 10, ObstacleClearance: 10, ArtifactCleaning: true},
	}
	encoded, _ := json.Marshal(payload)
	req, _ := json.Marshal(graphProtocolRequest{Protocol: graphProtocolVersion, RequestID: "r1", Operation: "layout", Payload: encoded})
	var envelope struct {
		OK    bool                `json:"ok"`
		Value graphLayoutValue    `json:"value"`
		Error *graphProtocolError `json:"error"`
	}
	if err := json.Unmarshal(handleGraphProtocol(req), &envelope); err != nil {
		t.Fatal(err)
	}
	if !envelope.OK || envelope.Error != nil {
		t.Fatalf("layout failed: %#v", envelope.Error)
	}
	if len(envelope.Value.Edges) != 1 || len(envelope.Value.Edges[0].Path) < 2 {
		t.Fatalf("unexpected routed result: %#v", envelope.Value.Edges)
	}
}

func TestGraphProtocolRejectsDanglingEdge(t *testing.T) {
	payload := graphLayoutPayload{
		Nodes: []core.BlockNode{{ID: "a"}},
		Edges: []core.EdgeConnection{{ID: "e", SourceBlockID: "a", TargetBlockID: "missing"}},
	}
	encoded, _ := json.Marshal(payload)
	req, _ := json.Marshal(graphProtocolRequest{Protocol: 1, RequestID: "x", Operation: "layout", Payload: encoded})
	var res graphProtocolResponse
	if err := json.Unmarshal(handleGraphProtocol(req), &res); err != nil {
		t.Fatal(err)
	}
	if res.OK || res.Error == nil || res.Error.Code != "AUTOTRACE_INVALID_GRAPH" {
		t.Fatalf("response = %#v", res)
	}
}

func FuzzGraphProtocolNeverPanics(f *testing.F) {
	f.Add([]byte(`{"protocol":1,"requestId":"x","operation":"hello","payload":{}}`))
	f.Add([]byte(`{`))
	f.Fuzz(func(t *testing.T, input []byte) {
		output := handleGraphProtocol(input)
		if !json.Valid(output) {
			t.Fatalf("handler returned invalid JSON: %q", output)
		}
	})
}

func BenchmarkGraphProtocolLayout(b *testing.B) {
	payload := graphLayoutPayload{
		GraphID: "bench",
		Nodes: []core.BlockNode{
			{ID: "a", X: 0, Y: 0, Width: 80, Height: 50, Outputs: []core.Port{{ID: "out", Side: core.SideRight, Type: "output"}}},
			{ID: "b", X: 400, Y: 120, Width: 80, Height: 50, Inputs: []core.Port{{ID: "in", Side: core.SideLeft, Type: "input"}}},
		},
		Edges:   []core.EdgeConnection{{ID: "e", SourceBlockID: "a", SourcePortID: "out", TargetBlockID: "b", TargetPortID: "in"}},
		Options: core.RoutingOptions{GridSize: 10, ObstacleClearance: 10, ArtifactCleaning: true},
	}
	encoded, _ := json.Marshal(payload)
	req, _ := json.Marshal(graphProtocolRequest{Protocol: 1, RequestID: "bench", Operation: "layout", Payload: encoded})
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = handleGraphProtocol(req)
	}
}
