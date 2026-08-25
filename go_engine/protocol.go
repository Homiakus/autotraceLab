package main

import (
	"encoding/json"
	"errors"
	"fmt"

	core "github.com/Homiakus/autotraceLab/go_engine/core"
)

const graphProtocolVersion = core.ContractVersion

var graphSceneEngine = core.NewEngine()

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

type graphLayoutPayload = core.RouteRequest

type graphLayoutValue struct {
	GraphID         string                `json:"graphId"`
	Edges           []core.EdgeConnection `json:"edges"`
	Metrics         core.BenchmarkMetrics `json:"metrics"`
	DurationMs      float64               `json:"durationMs"`
	Engine          string                `json:"engine"`
	Protocol        int                   `json:"protocol"`
	ContractVersion int                   `json:"contractVersion"`
}

type graphSceneRefPayload struct {
	GraphID string `json:"graphId"`
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
			"engine": core.EngineID,
			"capabilities": map[string]any{
				"runtime": "go-wasm",
				"protocolVersion": graphProtocolVersion,
				"importableCore": true,
				"orthogonalRouting": true,
				"metrics": true,
				"labels": true,
				"incrementalScenes": true,
				"scenePatch": true,
				"strictRevisions": true,
				"nlpOptimization": false,
			},
		}
	case "layout":
		var payload graphLayoutPayload
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &graphProtocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		value, err := core.Route(payload)
		if err != nil {
			res.Error = graphErrorFrom(err)
			break
		}
		res.OK = true
		res.Value = graphLayoutValue{
			GraphID: value.GraphID,
			Edges: value.Edges,
			Metrics: value.Metrics,
			DurationMs: value.DurationMs,
			Engine: value.Engine,
			Protocol: graphProtocolVersion,
			ContractVersion: value.ContractVersion,
		}
	case "scene.open":
		var payload core.SceneOpenRequest
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &graphProtocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		value, err := graphSceneEngine.Open(payload)
		if err != nil { res.Error = graphErrorFrom(err); break }
		res.OK = true
		res.Value = value
	case "scene.patch":
		var payload core.ScenePatchRequest
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &graphProtocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		value, err := graphSceneEngine.Patch(payload)
		if err != nil { res.Error = graphErrorFrom(err); break }
		res.OK = true
		res.Value = value
	case "scene.snapshot":
		var payload graphSceneRefPayload
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &graphProtocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		value, err := graphSceneEngine.Snapshot(payload.GraphID)
		if err != nil { res.Error = graphErrorFrom(err); break }
		res.OK = true
		res.Value = value
	case "scene.close":
		var payload graphSceneRefPayload
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &graphProtocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		if !graphSceneEngine.Close(payload.GraphID) {
			res.Error = &graphProtocolError{Code: "AUTOTRACE_SCENE_NOT_FOUND", Message: fmt.Sprintf("scene %q does not exist", payload.GraphID)}
			break
		}
		res.OK = true
		res.Value = map[string]any{"graphId": payload.GraphID, "closed": true}
	default:
		res.Error = &graphProtocolError{Code: "AUTOTRACE_UNSUPPORTED_OPERATION", Message: fmt.Sprintf("operation %q is unsupported", req.Operation)}
	}
	return marshalGraphResponse(res)
}

func graphErrorFrom(err error) *graphProtocolError {
	if err == nil { return nil }
	var conflict *core.RevisionConflictError
	if errors.As(err, &conflict) {
		return &graphProtocolError{
			Code: "AUTOTRACE_REVISION_CONFLICT",
			Message: err.Error(),
			Retryable: true,
			Details: map[string]any{"graphId": conflict.GraphID, "expectedBaseRevision": conflict.Expected, "actualRevision": conflict.Actual},
		}
	}
	if errors.Is(err, core.ErrSceneNotFound) {
		return &graphProtocolError{Code: "AUTOTRACE_SCENE_NOT_FOUND", Message: err.Error()}
	}
	return &graphProtocolError{Code: "AUTOTRACE_INVALID_GRAPH", Message: err.Error()}
}

func validateGraphPayload(payload graphLayoutPayload) error {
	return core.ValidateScene(payload.Nodes, payload.Edges)
}

func marshalGraphResponse(res graphProtocolResponse) []byte {
	data, err := json.Marshal(res)
	if err == nil { return data }
	fallback, _ := json.Marshal(graphProtocolResponse{Protocol: graphProtocolVersion, RequestID: res.RequestID, OK: false, Error: &graphProtocolError{Code: "AUTOTRACE_ENCODE_FAILED", Message: err.Error()}})
	return fallback
}
