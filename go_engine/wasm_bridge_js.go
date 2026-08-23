//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"syscall/js"
)

func main() {
	c := make(chan struct{}, 0)

	js.Global().Set("goAutoTraceRoute", js.FuncOf(goAutoTraceRoute))
	js.Global().Set("goAutoTraceNLP", js.FuncOf(goAutoTraceNLP))
	js.Global().Set("goAutoTraceCleanArtifacts", js.FuncOf(goAutoTraceCleanArtifacts))
	js.Global().Set("goAutoTraceLabels", js.FuncOf(goAutoTraceLabels))
	js.Global().Set("goAutoTraceMetrics", js.FuncOf(goAutoTraceMetrics))
	js.Global().Set("goAutoTraceRunAllTests", js.FuncOf(goAutoTraceRunAllTests))
	js.Global().Set("goAutoTracePing", js.FuncOf(func(this js.Value, args []js.Value) any {
		return "pong_go_wasm_v1"
	}))

	fmt.Println("🚀 [Go Core WASM] AutoTrace High-Performance Computational Core Loaded Successfully!")
	<-c
}

func goAutoTraceRoute(this js.Value, args []js.Value) any {
	if len(args) < 3 {
		return "{}"
	}
	nodesJSON := args[0].String()
	edgesJSON := args[1].String()
	optionsJSON := args[2].String()

	var nodes []BlockNode
	var edges []EdgeConnection
	var options RoutingOptions

	_ = json.Unmarshal([]byte(nodesJSON), &nodes)
	_ = json.Unmarshal([]byte(edgesJSON), &edges)
	_ = json.Unmarshal([]byte(optionsJSON), &options)

	routed := RouteOrthogonalAStar(nodes, edges, options)
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
	nodesJSON := args[0].String()
	edgesJSON := args[1].String()
	routingOptsJSON := args[2].String()
	paramsJSON := args[3].String()

	var nodes []BlockNode
	var edges []EdgeConnection
	var routingOpts RoutingOptions
	var params NLPOptimizationParams

	_ = json.Unmarshal([]byte(nodesJSON), &nodes)
	_ = json.Unmarshal([]byte(edgesJSON), &edges)
	_ = json.Unmarshal([]byte(routingOptsJSON), &routingOpts)
	_ = json.Unmarshal([]byte(paramsJSON), &params)

	res := RunNLPOptimization(nodes, edges, routingOpts, params)
	bytes, err := json.Marshal(res)
	if err != nil {
		return "{}"
	}
	return string(bytes)
}

func goAutoTraceCleanArtifacts(this js.Value, args []js.Value) any {
	if len(args) < 1 {
		return "[]"
	}
	pointsJSON := args[0].String()
	var rawPoints []Point
	_ = json.Unmarshal([]byte(pointsJSON), &rawPoints)

	var sPos *PortCoordinates
	var tPos *PortCoordinates
	if len(args) > 1 && !args[1].IsNull() && !args[1].IsUndefined() {
		var sp PortCoordinates
		if err := json.Unmarshal([]byte(args[1].String()), &sp); err == nil {
			sPos = &sp
		}
	}
	if len(args) > 2 && !args[2].IsNull() && !args[2].IsUndefined() {
		var tp PortCoordinates
		if err := json.Unmarshal([]byte(args[2].String()), &tp); err == nil {
			tPos = &tp
		}
	}

	var nodes []BlockNode
	if len(args) > 3 && !args[3].IsNull() && !args[3].IsUndefined() {
		_ = json.Unmarshal([]byte(args[3].String()), &nodes)
	}

	clearance := 10.0
	if len(args) > 4 && !args[4].IsNull() && !args[4].IsUndefined() {
		clearance = args[4].Float()
	}

	cleaned := CleanOrthogonalArtifacts(rawPoints, sPos, tPos, nodes, clearance, 15, 15)
	bytes, _ := json.Marshal(cleaned)
	return string(bytes)
}

func goAutoTraceLabels(this js.Value, args []js.Value) any {
	if len(args) < 2 {
		return "{}"
	}
	var nodes []BlockNode
	var edges []EdgeConnection
	_ = json.Unmarshal([]byte(args[0].String()), &nodes)
	_ = json.Unmarshal([]byte(args[1].String()), &edges)

	labels := ComputeOptimizedLabels(nodes, edges, nil, 6.0)
	bytes, _ := json.Marshal(labels)
	return string(bytes)
}

func goAutoTraceMetrics(this js.Value, args []js.Value) any {
	if len(args) < 5 {
		return "{}"
	}
	var nodes []BlockNode
	var edges []EdgeConnection
	_ = json.Unmarshal([]byte(args[0].String()), &nodes)
	_ = json.Unmarshal([]byte(args[1].String()), &edges)
	dur := args[2].Float()
	layoutAlgo := args[3].String()
	routingAlgo := args[4].String()

	metrics := CalculateBenchmarkMetrics(nodes, edges, dur, layoutAlgo, routingAlgo)
	bytes, _ := json.Marshal(metrics)
	return string(bytes)
}

func goAutoTraceRunAllTests(this js.Value, args []js.Value) any {
	summary := RunAllGoVerificationTests()
	bytes, _ := json.Marshal(summary)
	return string(bytes)
}
