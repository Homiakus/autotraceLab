//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"syscall/js"
)

func main() {
	c := make(chan struct{}, 0)

	// Stable protocol endpoint for production consumers such as BusinessOS.
	js.Global().Set("businessOSAutoTraceRequest", js.FuncOf(goBusinessOSAutoTraceRequest))

	// Legacy globals remain available for current AutoTraceLab UI compatibility.
	js.Global().Set("goAutoTraceRoute", js.FuncOf(goAutoTraceRoute))
	js.Global().Set("goAutoTraceNLP", js.FuncOf(goAutoTraceNLP))
	js.Global().Set("goAutoTraceCleanArtifacts", js.FuncOf(goAutoTraceCleanArtifacts))
	js.Global().Set("goAutoTraceLabels", js.FuncOf(goAutoTraceLabels))
	js.Global().Set("goAutoTraceMetrics", js.FuncOf(goAutoTraceMetrics))
	js.Global().Set("goAutoTraceRunAllTests", js.FuncOf(goAutoTraceRunAllTests))
	js.Global().Set("goAutoTracePing", js.FuncOf(func(this js.Value, args []js.Value) any { return "pong_go_wasm_v2" }))

	fmt.Println("🚀 [Go Core WASM] AutoTrace protocol v1 + legacy bridge loaded")
	<-c
}

func goBusinessOSAutoTraceRequest(this js.Value, args []js.Value) any {
	if len(args) != 1 {
		return string(marshalGraphResponse(graphProtocolResponse{Protocol: graphProtocolVersion, OK: false, Error: &graphProtocolError{Code: "AUTOTRACE_ARGUMENT", Message: "one JSON request argument is required"}}))
	}
	return string(handleGraphProtocol([]byte(args[0].String())))
}

func goAutoTraceRoute(this js.Value, args []js.Value) any {
	if len(args) < 3 { return "[]" }
	var nodes []BlockNode
	var edges []EdgeConnection
	var options RoutingOptions
	if err := json.Unmarshal([]byte(args[0].String()), &nodes); err != nil { return "[]" }
	if err := json.Unmarshal([]byte(args[1].String()), &edges); err != nil { return "[]" }
	if err := json.Unmarshal([]byte(args[2].String()), &options); err != nil { return "[]" }
	// This compatibility endpoint intentionally stays on the legacy root types.
	// New production consumers use businessOSAutoTraceRequest, which validates
	// against the importable core contract before routing.
	routed := RouteOrthogonalAStar(nodes, edges, options)
	bytes, err := json.Marshal(routed); if err != nil { return "[]" }; return string(bytes)
}

func goAutoTraceNLP(this js.Value, args []js.Value) any {
	if len(args) < 4 { return "{}" }
	var nodes []BlockNode; var edges []EdgeConnection; var routingOpts RoutingOptions; var params NLPOptimizationParams
	if json.Unmarshal([]byte(args[0].String()), &nodes) != nil || json.Unmarshal([]byte(args[1].String()), &edges) != nil || json.Unmarshal([]byte(args[2].String()), &routingOpts) != nil || json.Unmarshal([]byte(args[3].String()), &params) != nil { return "{}" }
	res := RunNLPOptimization(nodes, edges, routingOpts, params); bytes, err := json.Marshal(res); if err != nil { return "{}" }; return string(bytes)
}

func goAutoTraceCleanArtifacts(this js.Value, args []js.Value) any {
	if len(args) < 1 { return "[]" }
	var rawPoints []Point; if json.Unmarshal([]byte(args[0].String()), &rawPoints) != nil { return "[]" }
	var sPos *PortCoordinates; var tPos *PortCoordinates
	if len(args) > 1 && !args[1].IsNull() && !args[1].IsUndefined() { var sp PortCoordinates; if err := json.Unmarshal([]byte(args[1].String()), &sp); err == nil { sPos = &sp } }
	if len(args) > 2 && !args[2].IsNull() && !args[2].IsUndefined() { var tp PortCoordinates; if err := json.Unmarshal([]byte(args[2].String()), &tp); err == nil { tPos = &tp } }
	var nodes []BlockNode; if len(args) > 3 && !args[3].IsNull() && !args[3].IsUndefined() { if json.Unmarshal([]byte(args[3].String()), &nodes) != nil { return "[]" } }
	clearance := 10.0; if len(args) > 4 && !args[4].IsNull() && !args[4].IsUndefined() { clearance = args[4].Float() }
	cleaned := CleanOrthogonalArtifacts(rawPoints, sPos, tPos, nodes, clearance, 15, 15); bytes, err := json.Marshal(cleaned); if err != nil { return "[]" }; return string(bytes)
}

func goAutoTraceLabels(this js.Value, args []js.Value) any {
	if len(args) < 2 { return "{}" }
	var nodes []BlockNode; var edges []EdgeConnection
	if json.Unmarshal([]byte(args[0].String()), &nodes) != nil || json.Unmarshal([]byte(args[1].String()), &edges) != nil { return "{}" }
	labels := ComputeOptimizedLabels(nodes, edges, nil, 6.0); bytes, err := json.Marshal(labels); if err != nil { return "{}" }; return string(bytes)
}

func goAutoTraceMetrics(this js.Value, args []js.Value) any {
	if len(args) < 5 { return "{}" }
	var nodes []BlockNode; var edges []EdgeConnection
	if json.Unmarshal([]byte(args[0].String()), &nodes) != nil || json.Unmarshal([]byte(args[1].String()), &edges) != nil { return "{}" }
	metrics := CalculateBenchmarkMetrics(nodes, edges, args[2].Float(), args[3].String(), args[4].String()); bytes, err := json.Marshal(metrics); if err != nil { return "{}" }; return string(bytes)
}

func goAutoTraceRunAllTests(this js.Value, args []js.Value) any { summary := RunAllGoVerificationTests(); bytes, err := json.Marshal(summary); if err != nil { return "{}" }; return string(bytes) }
