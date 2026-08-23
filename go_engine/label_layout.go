package main

import (
	"math"
)

const MaxLabelOffArrowPenalty = 50000.0

// ComputeOptimizedLabels calculates optimal positions for wire labels
func ComputeOptimizedLabels(
	nodes []BlockNode,
	edges []EdgeConnection,
	customOffsets map[string]Point,
	clearance float64,
) map[string]LabelPlacement {
	result := make(map[string]LabelPlacement, len(edges))

	if clearance <= 0 {
		clearance = 6.0
	}

	obstacleBoxes := make([]ObstacleBox, len(nodes))
	for i, n := range nodes {
		obstacleBoxes[i] = ObstacleBox{
			ID:   n.ID,
			MinX: n.X - clearance,
			MaxX: n.X + n.Width + clearance,
			MinY: n.Y - clearance,
			MaxY: n.Y + n.Height + clearance,
		}
	}

	for _, e := range edges {
		labelStr := e.Label
		if labelStr == "" {
			labelStr = e.ID
		}

		charWidth := 7.2
		labelWidth := float64(len(labelStr))*charWidth + 14.0
		labelHeight := 18.0

		// Check if manually offset off arrow
		if customOffsets != nil {
			if off, ok := customOffsets[e.ID]; ok && (math.Abs(off.X) > 200 || math.Abs(off.Y) > 200) {
				result[e.ID] = LabelPlacement{
					EdgeID:          e.ID,
					Label:           labelStr,
					X:               off.X,
					Y:               off.Y,
					Width:           labelWidth,
					Height:          labelHeight,
					SegmentIndex:    -1,
					IsHorizontal:    true,
					IsOnArrow:       false,
					IsCollisionFree: false,
					Penalty:         MaxLabelOffArrowPenalty,
				}
				continue
			}
		}

		path := e.Path
		if len(path) < 2 {
			result[e.ID] = LabelPlacement{
				EdgeID:          e.ID,
				Label:           labelStr,
				X:               0,
				Y:               0,
				Width:           labelWidth,
				Height:          labelHeight,
				SegmentIndex:    0,
				IsHorizontal:    true,
				IsOnArrow:       true,
				IsCollisionFree: true,
				Penalty:         0,
			}
			continue
		}

		type Candidate struct {
			index        int
			x, y         float64
			length       float64
			isHorizontal bool
			hasCollision bool
		}

		var candidates []Candidate

		for i := 0; i < len(path)-1; i++ {
			p1 := path[i]
			p2 := path[i+1]
			segLen := math.Hypot(p2.X-p1.X, p2.Y-p1.Y)
			if segLen < 8.0 {
				continue
			}

			isHoriz := math.Abs(p1.Y-p2.Y) < 0.001
			midX := (p1.X + p2.X) / 2.0
			midY := (p1.Y + p2.Y) / 2.0

			candX := midX - labelWidth/2.0
			candY := midY - labelHeight/2.0

			hasCol := false
			for _, box := range obstacleBoxes {
				if candX+labelWidth > box.MinX && candX < box.MaxX &&
					candY+labelHeight > box.MinY && candY < box.MaxY {
					hasCol = true
					break
				}
			}

			candidates = append(candidates, Candidate{
				index:        i,
				x:            candX,
				y:            candY,
				length:       segLen,
				isHorizontal: isHoriz,
				hasCollision: hasCol,
			})
		}

		if len(candidates) == 0 {
			p1 := path[0]
			p2 := path[len(path)-1]
			result[e.ID] = LabelPlacement{
				EdgeID:          e.ID,
				Label:           labelStr,
				X:               (p1.X+p2.X)/2.0 - labelWidth/2.0,
				Y:               (p1.Y+p2.Y)/2.0 - labelHeight/2.0,
				Width:           labelWidth,
				Height:          labelHeight,
				SegmentIndex:    0,
				IsHorizontal:    true,
				IsOnArrow:       true,
				IsCollisionFree: true,
				Penalty:         0,
			}
			continue
		}

		// Prefer collision-free, horizontal, longer segments
		best := candidates[0]
		for _, c := range candidates {
			if !c.hasCollision && best.hasCollision {
				best = c
				continue
			}
			if c.hasCollision && !best.hasCollision {
				continue
			}
			if c.isHorizontal && !best.isHorizontal {
				best = c
				continue
			}
			if c.length > best.length {
				best = c
			}
		}

		result[e.ID] = LabelPlacement{
			EdgeID:          e.ID,
			Label:           labelStr,
			X:               best.x,
			Y:               best.y,
			Width:           labelWidth,
			Height:          labelHeight,
			SegmentIndex:    best.index,
			IsHorizontal:    best.isHorizontal,
			IsOnArrow:       true,
			IsCollisionFree: !best.hasCollision,
			Penalty:         0,
		}
	}

	return result
}
