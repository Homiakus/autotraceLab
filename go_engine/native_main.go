//go:build !js || !wasm

package main

import (
	"fmt"
	"time"
)

func main() {
	fmt.Println("================================================================")
	fmt.Println("  AUTOTRACE CORE - HIGH-PERFORMANCE GO COMPUTATIONAL ENGINE")
	fmt.Println("================================================================")

	summary := RunAllGoVerificationTests()
	for _, res := range summary.Results {
		status := "✅ PASSED"
		if !res.Passed {
			status = "❌ FAILED"
		}
		fmt.Printf("%s [%s] %s\n   %s\n", status, res.Suite, res.Name, res.Message)
	}

	fmt.Println("----------------------------------------------------------------")
	fmt.Printf("Summary: %d/%d passed (%d failed) in %.2f ms\n", summary.Passed, summary.Total, summary.Failed, summary.DurationMs)
	fmt.Println("================================================================")

	// Quick benchmark
	runQuickBenchmark()
}

func runQuickBenchmark() {
	fmt.Println("\n⚡ Running Go Micro-Benchmark (1,000 net routes & NLP iterations)...")
	nodes := []BlockNode{
		{ID: "A", X: 50, Y: 100, Width: 100, Height: 60, Outputs: []Port{{ID: "p1", Name: "o1", Side: SideRight}}},
		{ID: "B", X: 450, Y: 120, Width: 100, Height: 60, Inputs: []Port{{ID: "p2", Name: "i1", Side: SideLeft}}},
		{ID: "C", X: 250, Y: 300, Width: 100, Height: 60, Inputs: []Port{{ID: "p3", Name: "i2", Side: SideTop}}},
	}
	edges := []EdgeConnection{
		{ID: "e1", SourceBlockID: "A", SourcePortID: "p1", TargetBlockID: "B", TargetPortID: "p2"},
		{ID: "e2", SourceBlockID: "A", SourcePortID: "p1", TargetBlockID: "C", TargetPortID: "p3"},
	}

	opts := RoutingOptions{
		GridSize:          10,
		ObstacleClearance: 15,
		BendPenalty:       35,
		CrossingPenalty:   25,
		ArtifactCleaning:  true,
	}

	t0 := time.Now()
	for i := 0; i < 50; i++ {
		_ = RouteOrthogonalAStar(nodes, edges, opts)
	}
	dur := time.Since(t0)
	fmt.Printf("🚀 50 A* routes completed in %v (avg %.3f ms / route batch)\n", dur, float64(dur.Microseconds())/50.0/1000.0)
}
