package core

import "math"

const MaxLabelOffArrowPenalty = 50000.0

// OptimizedLabelPosition represents strict on-arrow label placement output.
type OptimizedLabelPosition struct {
	EdgeID            string  `json:"edgeId"`
	X                 float64 `json:"x"`
	Y                 float64 `json:"y"`
	Width             float64 `json:"width"`
	Height            float64 `json:"height"`
	AnchorPoint       Point   `json:"anchorPoint"`
	IsOnArrow         bool    `json:"isOnArrow"`
	SegmentIndex      int     `json:"segmentIndex"`
	Penalty           float64 `json:"penalty"`
	HasLeaderLine     bool    `json:"hasLeaderLine"`
	Angle             float64 `json:"angle"`
	IsCollisionFree   bool    `json:"isCollisionFree"`
	ClearanceDistance float64 `json:"clearanceDistance"`
}

type segmentItem struct {
	p1, p2       Point
	length       float64
	isHorizontal bool
	edgeID       string
	segIndex     int
}

type labelAABB struct {
	minX, maxX, minY, maxY float64
}

func isSegmentIntersectingAABB(p1, p2 Point, box labelAABB) bool {
	if (p1.X >= box.minX && p1.X <= box.maxX && p1.Y >= box.minY && p1.Y <= box.maxY) ||
		(p2.X >= box.minX && p2.X <= box.maxX && p2.Y >= box.minY && p2.Y <= box.maxY) {
		return true
	}

	segMinX := math.Min(p1.X, p2.X)
	segMaxX := math.Max(p1.X, p2.X)
	segMinY := math.Min(p1.Y, p2.Y)
	segMaxY := math.Max(p1.Y, p2.Y)

	if segMaxX < box.minX || segMinX > box.maxX || segMaxY < box.minY || segMinY > box.maxY {
		return false
	}

	if math.Abs(p1.X-p2.X) < 0.5 || math.Abs(p1.Y-p2.Y) < 0.5 {
		return true
	}

	// Liang-Barsky parametric line clipping
	t0 := 0.0
	t1 := 1.0
	dx := p2.X - p1.X
	dy := p2.Y - p1.Y

	p := []float64{-dx, dx, -dy, dy}
	q := []float64{p1.X - box.minX, box.maxX - p1.X, p1.Y - box.minY, box.maxY - p1.Y}

	for i := 0; i < 4; i++ {
		if math.Abs(p[i]) < 1e-6 {
			if q[i] < 0 {
				return false
			}
		} else {
			t := q[i] / p[i]
			if p[i] < 0 {
				if t > t1 {
					return false
				}
				if t > t0 {
					t0 = t
				}
			} else {
				if t < t0 {
					return false
				}
				if t < t1 {
					t1 = t
				}
			}
		}
	}
	return t0 <= t1
}

var candidateT = []float64{0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65, 0.3, 0.7, 0.25, 0.75, 0.2, 0.8}

func checkLabelCollisionStrict(cx, cy, width, height float64, currentEdgeID string, nodes []BlockNode, allSegments []segmentItem, placedBoxes []labelAABB, clearance float64) bool {
	halfW := width / 2.0
	halfH := height / 2.0

	boxMinX := cx - halfW - clearance
	boxMaxX := cx + halfW + clearance
	boxMinY := cy - halfH - clearance
	boxMaxY := cy + halfH + clearance

	// 1. Block nodes collision
	for _, node := range nodes {
		nodeLeft := node.X - clearance
		nodeRight := node.X + node.Width + clearance
		nodeTop := node.Y - clearance
		nodeBottom := node.Y + node.Height + clearance

		overlaps := !(boxMaxX < nodeLeft || boxMinX > nodeRight || boxMaxY < nodeTop || boxMinY > nodeBottom)
		if overlaps {
			return true
		}
	}

	// 2. Other wire segments collision
	box := labelAABB{minX: boxMinX, maxX: boxMaxX, minY: boxMinY, maxY: boxMaxY}
	for _, seg := range allSegments {
		if seg.edgeID == currentEdgeID {
			continue
		}
		if isSegmentIntersectingAABB(seg.p1, seg.p2, box) {
			return true
		}
	}

	// 3. Other placed labels collision
	for _, placed := range placedBoxes {
		overlaps := !(boxMaxX < placed.minX || boxMinX > placed.maxX || boxMaxY < placed.minY || boxMinY > placed.maxY)
		if overlaps {
			return true
		}
	}

	return false
}

// ComputeOptimizedLabels determines optimal on-arrow collision-free label placements.
func ComputeOptimizedLabels(nodes []BlockNode, edges []EdgeConnection, customOffsets map[string]Point, labelClearance float64) map[string]OptimizedLabelPosition {
	resultMap := make(map[string]OptimizedLabelPosition, len(edges))
	clearance := math.Max(4.0, labelClearance)
	if clearance <= 0 {
		clearance = 8.0
	}

	var allSegments []segmentItem
	edgeSegmentsMap := make(map[string][]segmentItem, len(edges))

	for _, edge := range edges {
		pts := edge.Path
		if len(pts) < 2 {
			continue
		}
		var segs []segmentItem
		for i := 0; i+1 < len(pts); i++ {
			p1, p2 := pts[i], pts[i+1]
			l := math.Hypot(p2.X-p1.X, p2.Y-p1.Y)
			if l > 1.0 {
				seg := segmentItem{
					p1:           p1,
					p2:           p2,
					length:       l,
					isHorizontal: math.Abs(p2.Y-p1.Y) < 1.5,
					edgeID:       edge.ID,
					segIndex:     i,
				}
				allSegments = append(allSegments, seg)
				segs = append(segs, seg)
			}
		}
		edgeSegmentsMap[edge.ID] = segs
	}

	var placedBoxes []labelAABB

	for _, edge := range edges {
		if edge.Label == "" || len(edge.Path) < 2 {
			continue
		}

		labelText := edge.Label
		textWidth := math.Max(52.0, float64(len(labelText))*7.2+18.0)
		textHeight := 22.0

		// Handle custom offset
		if customPos, hasCustom := customOffsets[edge.ID]; hasCustom {
			defaultAnchor := edge.Path[len(edge.Path)/2]
			distFromAnchor := math.Hypot(customPos.X-defaultAnchor.X, customPos.Y-defaultAnchor.Y)

			edgeSegs := edgeSegmentsMap[edge.ID]
			isOnWire := false
			for _, seg := range edgeSegs {
				minX := math.Min(seg.p1.X, seg.p2.X) - 4.0
				maxX := math.Max(seg.p1.X, seg.p2.X) + 4.0
				minY := math.Min(seg.p1.Y, seg.p2.Y) - 4.0
				maxY := math.Max(seg.p1.Y, seg.p2.Y) + 4.0
				if seg.isHorizontal && math.Abs(customPos.Y-seg.p1.Y) < 5.0 && customPos.X >= minX && customPos.X <= maxX {
					isOnWire = true
					break
				} else if !seg.isHorizontal && math.Abs(customPos.X-seg.p1.X) < 5.0 && customPos.Y >= minY && customPos.Y <= maxY {
					isOnWire = true
					break
				}
			}

			isColliding := checkLabelCollisionStrict(customPos.X, customPos.Y, textWidth, textHeight, edge.ID, nodes, allSegments, placedBoxes, clearance)
			penalty := 0.0
			if !isOnWire || isColliding {
				penalty = MaxLabelOffArrowPenalty
			}

			placedBoxes = append(placedBoxes, labelAABB{
				minX: customPos.X - textWidth/2.0,
				maxX: customPos.X + textWidth/2.0,
				minY: customPos.Y - textHeight/2.0,
				maxY: customPos.Y + textHeight/2.0,
			})

			resultMap[edge.ID] = OptimizedLabelPosition{
				EdgeID:            edge.ID,
				X:                 customPos.X,
				Y:                 customPos.Y,
				Width:             textWidth,
				Height:            textHeight,
				AnchorPoint:       defaultAnchor,
				IsOnArrow:         isOnWire,
				SegmentIndex:      0,
				Penalty:           penalty,
				HasLeaderLine:     !isOnWire && distFromAnchor > 14.0,
				Angle:             0,
				IsCollisionFree:   !isColliding,
				ClearanceDistance: clearance,
			}
			continue
		}

		edgeSegments := edgeSegmentsMap[edge.ID]
		if len(edgeSegments) == 0 {
			continue
		}

		// Sort candidate segments by suitability (prefer long, prefer horizontal)
		sortedSegments := make([]segmentItem, len(edgeSegments))
		copy(sortedSegments, edgeSegments)

		for i := 0; i < len(sortedSegments); i++ {
			for j := i + 1; j < len(sortedSegments); j++ {
				scoreA := sortedSegments[i].length
				if sortedSegments[i].isHorizontal {
					scoreA *= 1.5
				}
				scoreB := sortedSegments[j].length
				if sortedSegments[j].isHorizontal {
					scoreB *= 1.5
				}
				if scoreB > scoreA {
					sortedSegments[i], sortedSegments[j] = sortedSegments[j], sortedSegments[i]
				}
			}
		}

		var bestPlacement *struct {
			pos             Point
			segIndex        int
			isCollisionFree bool
			isOnArrow       bool
			penalty         float64
		}

		for _, seg := range sortedSegments {
			for _, t := range candidateT {
				cx := math.Round(seg.p1.X + (seg.p2.X-seg.p1.X)*t)
				cy := math.Round(seg.p1.Y + (seg.p2.Y-seg.p1.Y)*t)

				isColliding := checkLabelCollisionStrict(cx, cy, textWidth, textHeight, edge.ID, nodes, allSegments, placedBoxes, clearance)
				if !isColliding {
					bestPlacement = &struct {
						pos             Point
						segIndex        int
						isCollisionFree bool
						isOnArrow       bool
						penalty         float64
					}{
						pos:             Point{X: cx, Y: cy},
						segIndex:        seg.segIndex,
						isCollisionFree: true,
						isOnArrow:       true,
						penalty:         0,
					}
					break
				}
			}
			if bestPlacement != nil {
				break
			}
		}

		if bestPlacement != nil {
			placedBoxes = append(placedBoxes, labelAABB{
				minX: bestPlacement.pos.X - textWidth/2.0,
				maxX: bestPlacement.pos.X + textWidth/2.0,
				minY: bestPlacement.pos.Y - textHeight/2.0,
				maxY: bestPlacement.pos.Y + textHeight/2.0,
			})

			resultMap[edge.ID] = OptimizedLabelPosition{
				EdgeID:            edge.ID,
				X:                 bestPlacement.pos.X,
				Y:                 bestPlacement.pos.Y,
				Width:             textWidth,
				Height:            textHeight,
				AnchorPoint:       bestPlacement.pos,
				IsOnArrow:         true,
				SegmentIndex:      bestPlacement.segIndex,
				Penalty:           0,
				HasLeaderLine:     false,
				Angle:             0,
				IsCollisionFree:   true,
				ClearanceDistance: clearance,
			}
		} else {
			// Fallback: place on middle of longest segment with penalty
			fallbackSeg := sortedSegments[0]
			cx := math.Round((fallbackSeg.p1.X + fallbackSeg.p2.X) / 2.0)
			cy := math.Round((fallbackSeg.p1.Y + fallbackSeg.p2.Y) / 2.0)

			placedBoxes = append(placedBoxes, labelAABB{
				minX: cx - textWidth/2.0,
				maxX: cx + textWidth/2.0,
				minY: cy - textHeight/2.0,
				maxY: cy + textHeight/2.0,
			})

			resultMap[edge.ID] = OptimizedLabelPosition{
				EdgeID:            edge.ID,
				X:                 cx,
				Y:                 cy,
				Width:             textWidth,
				Height:            textHeight,
				AnchorPoint:       Point{X: cx, Y: cy},
				IsOnArrow:         true,
				SegmentIndex:      fallbackSeg.segIndex,
				Penalty:           MaxLabelOffArrowPenalty,
				HasLeaderLine:     false,
				Angle:             0,
				IsCollisionFree:   false,
				ClearanceDistance: clearance,
			}
		}
	}

	return resultMap
}
