package main

import (
	"encoding/json"
	"fmt"
	"time"
)

const graphProtocolVersion = 1

type graphProtocolRequest struct {
	Protocol  int             `json:"protocol"`
	RequestID string          `json:"requestId"`
	Operation string          `json:"operation"`
	Payload   json.RawMessage `json:"payload"`
}

type graphProtocolResponse struct {
	Protocol  int                 `json:"protocol"`
	RequestID string              `json:"requestId,omitempty"`
	OK        bool                `json:"ok"`
	Value     any                 `json:"value,omitempty"`
	Error     *graphProtocolError `json:"error,omitempty"`
}

type graphProtocolError struct {
	Code      string         `json:"code"`
	Message   string         `json:"message"`
	Retryable bool           `json:"retryable,omitempty"`
	Details   map[string]any `json:"details,omitempty"`
}

type graphLayoutPayload struct {
	GraphID string           `json:"graphId"`
	Nodes   []BlockNode      `json:"nodes"`
	Edges   []EdgeConnection `json:"edges"`
	Options RoutingOptions   `json:"options"`
}

type graphLayoutValue struct {
	GraphID     string           `json:"graphId"`
	Edges       []EdgeConnection `json:"edges"`
	Metrics     BenchmarkMetrics `json:"metrics"`
	DurationMs  float64          `json:"durationMs"`
	Engine      string           `json:"engine"`
	Protocol    int              `json:"protocol"`
}

func handleGraphProtocol(raw []byte) (out []byte) {
	defer func() {
		if recovered := recover(); recovered != nil {
			out = marshalGraphResponse(graphProtocolResponse{Protocol: graphProtocolVersion, OK: false, Error: &graphProtocolError{Code: "AUTOTRACE_PANIC", Message: fmt.Sprint(recovered)}})
		}
	}()
	var req graphProtocolRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return marshalGraphResponse(graphProtocolResponse{Protocol: graphProtocolVersion, OK: false, Error: &graphProtocolError{Code: "AUTOTRACE_INVALID_JSON", Message: err.Error()}})
	}
	res := graphProtocolResponse{Protocol: graphProtocolVersion, RequestID: req.RequestID}
	if req.Protocol != graphProtocolVersion {
		res.Error = &graphProtocolError{Code: "AUTOTRACE_PROTOCOL_MISMATCH", Message: fmt.Sprintf("protocol %d is unsupported", req.Protocol)}
		return marshalGraphResponse(res)
	}
	switch req.Operation {
	case "hello":
		res.OK = true
		res.Value = map[string]any{
			"service": "autotrace-lab",
			"capabilities": map[string]any{
				"runtime": "go-wasm",
				"protocolVersion": graphProtocolVersion,
				"orthogonalRouting": true,
				"metrics": true,
				"labels": true,
				"nlpOptimization": true,
			},
		}
	case "layout":
		var payload graphLayoutPayload
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &graphProtocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		if err := validateGraphPayload(payload); err != nil {
			res.Error = &graphProtocolError{Code: "AUTOTRACE_INVALID_GRAPH", Message: err.Error()}
			break
		}
		started := time.Now()
		routed := RouteOrthogonalAStar(payload.Nodes, payload.Edges, payload.Options)
		duration := float64(time.Since(started).Microseconds()) / 1000.0
		metrics := CalculateBenchmarkMetrics(payload.Nodes, routed, duration, "businessos", "orthogonal-a-star")
		res.OK = true
		res.Value = graphLayoutValue{GraphID: payload.GraphID, Edges: routed, Metrics: metrics, DurationMs: duration, Engine: "autotrace-go", Protocol: graphProtocolVersion}
	default:
		res.Error = &graphProtocolError{Code: "AUTOTRACE_UNSUPPORTED_OPERATION", Message: fmt.Sprintf("operation %q is unsupported", req.Operation)}
	}
	return marshalGraphResponse(res)
}

func validateGraphPayload(payload graphLayoutPayload) error {
	ids := make(map[string]struct{}, len(payload.Nodes))
	for _, node := range payload.Nodes {
		if node.ID == "" { return fmt.Errorf("node id is required") }
		if _, exists := ids[node.ID]; exists { return fmt.Errorf("duplicate node id %q", node.ID) }
		ids[node.ID] = struct{}{}
	}
	for _, edge := range payload.Edges {
		if edge.ID == "" { return fmt.Errorf("edge id is required") }
		if _, ok := ids[edge.SourceBlockID]; !ok { return fmt.Errorf("edge %q source %q does not exist", edge.ID, edge.SourceBlockID) }
		if _, ok := ids[edge.TargetBlockID]; !ok { return fmt.Errorf("edge %q target %q does not exist", edge.ID, edge.TargetBlockID) }
	}
	return nil
}

func marshalGraphResponse(res graphProtocolResponse) []byte {
	data, err := json.Marshal(res)
	if err == nil { return data }
	fallback, _ := json.Marshal(graphProtocolResponse{Protocol: graphProtocolVersion, RequestID: res.RequestID, OK: false, Error: &graphProtocolError{Code: "AUTOTRACE_ENCODE_FAILED", Message: err.Error()}})
	return fallback
}
