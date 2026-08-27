//go:build !js || !wasm

package main

import (
	"context"
	"fmt"
	"time"

	"github.com/Homiakus/autotraceLab/go_engine/core"
)

func main() {
	fmt.Println("================================================================")
	fmt.Println("  AUTOTRACE LAB - HIGH-PERFORMANCE COMPUTATIONAL ENGINE")
	fmt.Println("================================================================")

	nodes := []core.BlockNode{
		{
			ID: "A", Title: "Source Node", X: 50, Y: 100, Width: 120, Height: 60,
			Outputs: []core.Port{{ID: "p1", Name: "Out 1", Side: core.SideRight, Type: "output"}},
		},
		{
			ID: "B", Title: "Target Node", X: 450, Y: 150, Width: 120, Height: 60,
			Inputs: []core.Port{{ID: "p2", Name: "In 1", Side: core.SideLeft, Type: "input"}},
		},
		{
			ID: "C", Title: "Obstacle Node", X: 250, Y: 80, Width: 100, Height: 100,
		},
	}

	edges := []core.EdgeConnection{
		{ID: "e1", SourceBlockID: "A", SourcePortID: "p1", TargetBlockID: "B", TargetPortID: "p2"},
	}

	opts := core.NewRoutingOptionsBuilder().
		WithGridSize(10.0).
		WithObstacleClearance(15.0).
		WithBendPenalty(35.0).
		WithCrossingPenalty(50.0).
		WithSmoothCorners(true, 8.0).
		WithJumpBridges(true).
		Build()

	fmt.Printf("⚡ Executing A* Orthogonal Routing with %d nodes and %d edges...\n", len(nodes), len(edges))
	t0 := time.Now()
	res, err := core.RouteWithContext(context.Background(), core.RouteRequest{
		GraphID: "cli-demo",
		Nodes:   nodes,
		Edges:   edges,
		Options: opts,
	})
	dur := time.Since(t0)

	if err != nil {
		fmt.Printf("❌ Routing failed: %v\n", err)
		return
	}

	fmt.Printf("✅ Routing succeeded in %v (Engine: %s, Contract v%d)\n", dur, res.Engine, res.ContractVersion)
	fmt.Printf("   Waypoints for edge '%s': %d points\n", res.Edges[0].ID, len(res.Edges[0].Path))
	fmt.Printf("   Wirelength: %.1f px, Bends: %d, Crossings: %d\n", res.Metrics.TotalWirelength, res.Metrics.BendCount, res.Metrics.CrossingsCount)
	fmt.Println("================================================================")
}
