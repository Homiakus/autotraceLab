//go:build js && wasm

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"syscall/js"

	"github.com/Homiakus/autotraceLab/go_engine/core"
)

var graphSceneEngine = core.NewEngine()

func main() {
	c := make(chan struct{}, 0)

	// Stable protocol endpoint for production consumers
	js.Global().Set("businessOSAutoTraceRequest", js.FuncOf(goBusinessOSAutoTraceRequest))

	// Direct utility bindings
	js.Global().Set("goAutoTraceRoute", js.FuncOf(goAutoTraceRoute))
	js.Global().Set("goAutoTraceNLP", js.FuncOf(goAutoTraceNLP))
	js.Global().Set("goAutoTracePing", js.FuncOf(func(this js.Value, args []js.Value) any { return "pong_go_wasm_v2" }))

	fmt.Println("🚀 [Go Core WASM] AutoTrace protocol v2 engine initialized")
	<-c
}

func goBusinessOSAutoTraceRequest(this js.Value, args []js.Value) any {
	if len(args) != 1 {
		return `{"protocol":2,"ok":false,"error":{"code":"AUTOTRACE_ARGUMENT","message":"one JSON request argument is required"}}`
	}
	return string(handleProtocolRequest([]byte(args[0].String())))
}

func goAutoTraceRoute(this js.Value, args []js.Value) any {
	if len(args) < 3 {
		return "[]"
	}
	var nodes []core.BlockNode
	var edges []core.EdgeConnection
	var options core.RoutingOptions
	if err := json.Unmarshal([]byte(args[0].String()), &nodes); err != nil {
		return "[]"
	}
	if err := json.Unmarshal([]byte(args[1].String()), &edges); err != nil {
		return "[]"
	}
	if err := json.Unmarshal([]byte(args[2].String()), &options); err != nil {
		return "[]"
	}
	routed := core.RouteOrthogonalAStar(nodes, edges, options)
	bytes, err := json.Marshal(routed)
	if err != nil {
		return "[]"
	}
	return string(bytes)
}

func goAutoTraceNLP(this js.Value, args []js.Value) any {
	if len(args) < 4 {
		return "{}"
	}
	var nodes []core.BlockNode
	var edges []core.EdgeConnection
	var routingOpts core.RoutingOptions
	var params core.NLPOptimizationParams
	if json.Unmarshal([]byte(args[0].String()), &nodes) != nil ||
		json.Unmarshal([]byte(args[1].String()), &edges) != nil ||
		json.Unmarshal([]byte(args[2].String()), &routingOpts) != nil ||
		json.Unmarshal([]byte(args[3].String()), &params) != nil {
		return "{}"
	}
	res := core.RunNLPOptimization(nodes, edges, routingOpts, &params)
	bytes, err := json.Marshal(res)
	if err != nil {
		return "{}"
	}
	return string(bytes)
}

type protocolReq struct {
	Protocol  int             `json:"protocol"`
	RequestID string          `json:"requestId"`
	Operation string          `json:"operation"`
	Payload   json.RawMessage `json:"payload"`
}

type protocolRes struct {
	Protocol  int            `json:"protocol"`
	RequestID string         `json:"requestId,omitempty"`
	OK        bool           `json:"ok"`
	Value     any            `json:"value,omitempty"`
	Error     *protocolError `json:"error,omitempty"`
}

type protocolError struct {
	Code      string         `json:"code"`
	Message   string         `json:"message"`
	Retryable bool           `json:"retryable,omitempty"`
	Details   map[string]any `json:"details,omitempty"`
}

func handleProtocolRequest(raw []byte) []byte {
	var req protocolReq
	if err := json.Unmarshal(raw, &req); err != nil {
		res, _ := json.Marshal(protocolRes{Protocol: core.ProtocolVersion, OK: false, Error: &protocolError{Code: "AUTOTRACE_INVALID_JSON", Message: err.Error()}})
		return res
	}

	res := protocolRes{Protocol: core.ProtocolVersion, RequestID: req.RequestID}
	if req.Protocol != core.ProtocolVersion {
		res.Error = &protocolError{Code: "AUTOTRACE_PROTOCOL_MISMATCH", Message: fmt.Sprintf("protocol %d is unsupported, expected %d", req.Protocol, core.ProtocolVersion)}
		out, _ := json.Marshal(res)
		return out
	}

	switch req.Operation {
	case "hello":
		res.OK = true
		res.Value = map[string]any{
			"service": "autotrace-lab",
			"engine":  core.EngineID,
			"capabilities": map[string]any{
				"runtime":           "go-wasm",
				"protocolVersion":   core.ProtocolVersion,
				"contractVersion":   core.ContractVersion,
				"importableCore":    true,
				"orthogonalRouting": true,
				"metrics":           true,
				"labels":            true,
				"incrementalScenes": true,
				"scenePatch":        true,
				"strictRevisions":   true,
				"nlpOptimization":   true,
				"bridgeJumps":       true,
				"g1Splines":         true,
				"unifiedCoOpt":      true,
			},
		}
	case "layout":
		var payload core.RouteRequest
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &protocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		val, err := core.Route(payload)
		if err != nil {
			res.Error = &protocolError{Code: "AUTOTRACE_INVALID_GRAPH", Message: err.Error()}
			break
		}
		res.OK = true
		res.Value = val
	case "nlp.optimize":
		var payload struct {
			Nodes   []core.BlockNode            `json:"nodes"`
			Edges   []core.EdgeConnection       `json:"edges"`
			Options core.RoutingOptions         `json:"options"`
			Params  *core.NLPOptimizationParams `json:"params,omitempty"`
		}
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &protocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		res.OK = true
		res.Value = core.RunNLPOptimization(payload.Nodes, payload.Edges, payload.Options, payload.Params)
	case "unified.co_optimize":
		var payload struct {
			Nodes   []core.BlockNode      `json:"nodes"`
			Edges   []core.EdgeConnection `json:"edges"`
			Options core.RoutingOptions   `json:"options"`
		}
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &protocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		res.OK = true
		res.Value = core.RunUnifiedCoOptimization(payload.Nodes, payload.Edges, payload.Options)
	case "scene.open":
		var payload core.SceneOpenRequest
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &protocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		val, err := graphSceneEngine.Open(payload)
		if err != nil {
			res.Error = &protocolError{Code: "AUTOTRACE_ERROR", Message: err.Error()}
			break
		}
		res.OK = true
		res.Value = val
	case "scene.patch":
		var payload core.ScenePatchRequest
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &protocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		val, err := graphSceneEngine.Patch(payload)
		if err != nil {
			var revErr *core.RevisionConflictError
			if errors.As(err, &revErr) {
				res.Error = &protocolError{
					Code:      "AUTOTRACE_REVISION_CONFLICT",
					Message:   revErr.Error(),
					Retryable: true,
					Details: map[string]any{
						"graphId":  revErr.GraphID,
						"expected": revErr.Expected,
						"actual":   revErr.Actual,
					},
				}
			} else if errors.Is(err, core.ErrSceneNotFound) {
				res.Error = &protocolError{Code: "AUTOTRACE_SCENE_NOT_FOUND", Message: err.Error()}
			} else {
				res.Error = &protocolError{Code: "AUTOTRACE_ERROR", Message: err.Error()}
			}
			break
		}
		res.OK = true
		res.Value = val
	case "scene.update_options":
		var payload struct {
			GraphID string              `json:"graphId"`
			Options core.RoutingOptions `json:"options"`
		}
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &protocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		val, err := graphSceneEngine.UpdateOptions(payload.GraphID, payload.Options)
		if err != nil {
			if errors.Is(err, core.ErrSceneNotFound) {
				res.Error = &protocolError{Code: "AUTOTRACE_SCENE_NOT_FOUND", Message: err.Error()}
			} else {
				res.Error = &protocolError{Code: "AUTOTRACE_ERROR", Message: err.Error()}
			}
			break
		}
		res.OK = true
		res.Value = val
	case "scene.snapshot":
		var payload struct {
			GraphID string `json:"graphId"`
		}
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &protocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		val, err := graphSceneEngine.Snapshot(payload.GraphID)
		if err != nil {
			if errors.Is(err, core.ErrSceneNotFound) {
				res.Error = &protocolError{Code: "AUTOTRACE_SCENE_NOT_FOUND", Message: err.Error()}
			} else {
				res.Error = &protocolError{Code: "AUTOTRACE_ERROR", Message: err.Error()}
			}
			break
		}
		res.OK = true
		res.Value = val
	case "scene.close":
		var payload struct {
			GraphID string `json:"graphId"`
		}
		if err := json.Unmarshal(req.Payload, &payload); err != nil {
			res.Error = &protocolError{Code: "AUTOTRACE_INVALID_PAYLOAD", Message: err.Error()}
			break
		}
		if !graphSceneEngine.Close(payload.GraphID) {
			res.Error = &protocolError{Code: "AUTOTRACE_SCENE_NOT_FOUND", Message: fmt.Sprintf("scene %q not found", payload.GraphID)}
			break
		}
		res.OK = true
		res.Value = map[string]any{"graphId": payload.GraphID, "closed": true}
	default:
		res.Error = &protocolError{Code: "AUTOTRACE_UNSUPPORTED_OPERATION", Message: fmt.Sprintf("operation %q is unsupported", req.Operation)}
	}

	out, _ := json.Marshal(res)
	return out
}
