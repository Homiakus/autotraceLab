package core

import (
	"fmt"
	"math"
	"sort"
	"strings"
)

// Kappa is the standard cubic Bézier circular approximation constant: 4/3 * (sqrt(2)-1) ≈ 0.55228475.
const Kappa = 0.55228475

// PathSegmentType defines renderer-neutral path element primitives.
type PathSegmentType string

const (
	SegmentLine        PathSegmentType = "line"
	SegmentArc         PathSegmentType = "arc"
	SegmentCubicBezier PathSegmentType = "cubic_bezier"
)

// PathPrimitive represents a renderer-neutral geometric primitive (Line, Arc/Hop, CubicBezier fillet).
type PathPrimitive struct {
	Type             PathSegmentType `json:"type"`
	Start            Point           `json:"start"`
	End              Point           `json:"end"`
	Control1         *Point          `json:"control1,omitempty"`
	Control2         *Point          `json:"control2,omitempty"`
	Radius           float64         `json:"radius,omitempty"`
	IsBridgeHop      bool            `json:"isBridgeHop,omitempty"`
	IsFilletBoundary bool            `json:"isFilletBoundary,omitempty"`
	SweepFlag        int             `json:"sweepFlag,omitempty"`
}

type wireSegmentBox struct {
	edgeID       string
	p1, p2       Point
	isHorizontal bool
	minX, maxX   float64
	minY, maxY   float64
}

func formatCoord(v float64) string {
	if math.Abs(v-math.Round(v)) < 1e-6 {
		return fmt.Sprintf("%.0f", v)
	}
	s := fmt.Sprintf("%.2f", v)
	s = strings.TrimRight(strings.TrimRight(s, "0"), ".")
	return s
}

// GenerateRendererNeutralPathWithBridges calculates IEEE 315 / IEC 60617 bridge jump arcs and G¹ fillets.
func GenerateRendererNeutralPathWithBridges(
	points []Point,
	edgeID string,
	allEdges []EdgeConnection,
	enableBridges bool,
	smoothCorners bool,
	weights *OptimizationWeights,
	options *RoutingOptions,
) []PathPrimitive {
	if len(points) <= 1 {
		return nil
	}

	if !enableBridges || len(points) < 2 {
		return RenderG1ContinuousPrimitives(points, smoothCorners, weights, options)
	}

	// 1. Collect all other edge segments (prioritizing horizontal wires over vertical wires for hopping)
	var otherSegments []wireSegmentBox
	for _, other := range allEdges {
		if other.ID == edgeID || len(other.Path) < 2 {
			continue
		}
		for i := 0; i < len(other.Path)-1; i++ {
			a := other.Path[i]
			b := other.Path[i+1]
			isH := math.Abs(a.Y-b.Y) < 1.0
			otherSegments = append(otherSegments, wireSegmentBox{
				edgeID:       other.ID,
				p1:           a,
				p2:           b,
				isHorizontal: isH,
				minX:         math.Min(a.X, b.X),
				maxX:         math.Max(a.X, b.X),
				minY:         math.Min(a.Y, b.Y),
				maxY:         math.Max(a.Y, b.Y),
			})
		}
	}

	bridgeRadius := 5.5
	minClearanceFromCorner := bridgeRadius + 8.0
	var primitives []PathPrimitive

	for i := 0; i < len(points)-1; i++ {
		p1 := points[i]
		p2 := points[i+1]
		isVertical := math.Abs(p1.X-p2.X) < 1.0
		isHorizontal := math.Abs(p1.Y-p2.Y) < 1.0

		if isVertical {
			segMinY := math.Min(p1.Y, p2.Y)
			segMaxY := math.Max(p1.Y, p2.Y)
			segX := p1.X
			isMovingDown := p2.Y > p1.Y

			var hops []float64
			for _, other := range otherSegments {
				if other.isHorizontal &&
					other.minX < segX-3.0 &&
					other.maxX > segX+3.0 &&
					other.p1.Y > segMinY+minClearanceFromCorner &&
					other.p1.Y < segMaxY-minClearanceFromCorner {
					hops = append(hops, other.p1.Y)
				}
			}

			if isMovingDown {
				sort.Float64s(hops)
			} else {
				sort.Slice(hops, func(a, b int) bool { return hops[a] > hops[b] })
			}

			currentPos := p1
			for _, hopY := range hops {
				startArcY := hopY - bridgeRadius
				endArcY := hopY + bridgeRadius
				sweepFlag := 1
				if !isMovingDown {
					startArcY = hopY + bridgeRadius
					endArcY = hopY - bridgeRadius
					sweepFlag = 0
				}

				// Line to start of bridge hop
				if math.Abs(currentPos.Y-startArcY) > 0.01 {
					primitives = append(primitives, PathPrimitive{
						Type:  SegmentLine,
						Start: currentPos,
						End:   Point{X: segX, Y: startArcY},
					})
				}

				// Semicircular bridge hop arc jumping to the right (+X)
				primitives = append(primitives, PathPrimitive{
					Type:        SegmentArc,
					Start:       Point{X: segX, Y: startArcY},
					End:         Point{X: segX, Y: endArcY},
					Radius:      bridgeRadius,
					IsBridgeHop: true,
					SweepFlag:   sweepFlag,
				})
				currentPos = Point{X: segX, Y: endArcY}
			}

			// Final segment to p2
			if math.Abs(currentPos.Y-p2.Y) > 0.01 {
				primitives = append(primitives, PathPrimitive{
					Type:  SegmentLine,
					Start: currentPos,
					End:   p2,
				})
			}
		} else if isHorizontal {
			primitives = append(primitives, PathPrimitive{
				Type:  SegmentLine,
				Start: p1,
				End:   p2,
			})
		} else {
			primitives = append(primitives, PathPrimitive{
				Type:  SegmentLine,
				Start: p1,
				End:   p2,
			})
		}
	}

	return primitives
}

// RenderG1ContinuousPrimitives produces renderer-neutral linear segments and cubic Bézier corner fillets.
func RenderG1ContinuousPrimitives(
	points []Point,
	smoothCorners bool,
	weights *OptimizationWeights,
	options *RoutingOptions,
) []PathPrimitive {
	if len(points) <= 1 {
		return nil
	}

	if len(points) == 2 {
		return []PathPrimitive{
			{
				Type:  SegmentLine,
				Start: points[0],
				End:   points[1],
			},
		}
	}

	explicitRadius := 12.0
	if options != nil {
		if options.CornerRadius != nil {
			explicitRadius = *options.CornerRadius
		} else if options.SmoothCorners != nil && !*options.SmoothCorners {
			explicitRadius = 0.0
		}
	}

	isAdaptive := true
	if options != nil && options.AdaptiveCornerRadius != nil {
		isAdaptive = *options.AdaptiveCornerRadius
	}

	g1Weight := 65.0
	if weights != nil {
		g1Weight = weights.G1SplineWeight
	}

	if !smoothCorners || explicitRadius <= 0 || g1Weight <= 0 {
		var prims []PathPrimitive
		for i := 0; i < len(points)-1; i++ {
			prims = append(prims, PathPrimitive{
				Type:  SegmentLine,
				Start: points[i],
				End:   points[i+1],
			})
		}
		return prims
	}

	baseRadius := math.Max(2.0, explicitRadius*(g1Weight/70.0))
	var primitives []PathPrimitive
	currentStart := points[0]

	for i := 1; i < len(points)-1; i++ {
		pPrev := points[i-1]
		pCurr := points[i]
		pNext := points[i+1]

		d1x := pCurr.X - pPrev.X
		d1y := pCurr.Y - pPrev.Y
		len1 := math.Hypot(d1x, d1y)

		d2x := pNext.X - pCurr.X
		d2y := pNext.Y - pCurr.Y
		len2 := math.Hypot(d2x, d2y)

		if len1 < 1.0 || len2 < 1.0 {
			primitives = append(primitives, PathPrimitive{
				Type:  SegmentLine,
				Start: currentStart,
				End:   pCurr,
			})
			currentStart = pCurr
			continue
		}

		u1x := d1x / len1
		u1y := d1y / len1
		u2x := d2x / len2
		u2y := d2y / len2

		dot := u1x*u2x + u1y*u2y
		if math.Abs(dot) > 0.98 {
			primitives = append(primitives, PathPrimitive{
				Type:  SegmentLine,
				Start: currentStart,
				End:   pCurr,
			})
			currentStart = pCurr
			continue
		}

		// Safety: each corner can NEVER take more than 45% of incoming or outgoing span.
		maxRadius := math.Min(baseRadius, math.Min(len1*0.45, len2*0.45))
		if isAdaptive {
			maxRadius = math.Min(baseRadius, math.Min(len1*0.45, len2*0.45))
		}

		if maxRadius > 1.5 {
			startX := pCurr.X - u1x*maxRadius
			startY := pCurr.Y - u1y*maxRadius
			endX := pCurr.X + u2x*maxRadius
			endY := pCurr.Y + u2y*maxRadius

			cp1X := startX + u1x*(maxRadius*Kappa)
			cp1Y := startY + u1y*(maxRadius*Kappa)
			cp2X := endX - u2x*(maxRadius*Kappa)
			cp2Y := endY - u2y*(maxRadius*Kappa)

			filletStart := Point{X: math.Round(startX*100.0) / 100.0, Y: math.Round(startY*100.0) / 100.0}
			filletEnd := Point{X: math.Round(endX*100.0) / 100.0, Y: math.Round(endY*100.0) / 100.0}
			cp1 := Point{X: math.Round(cp1X*100.0) / 100.0, Y: math.Round(cp1Y*100.0) / 100.0}
			cp2 := Point{X: math.Round(cp2X*100.0) / 100.0, Y: math.Round(cp2Y*100.0) / 100.0}

			// Straight line leading up to the fillet
			if math.Hypot(filletStart.X-currentStart.X, filletStart.Y-currentStart.Y) > 0.01 {
				primitives = append(primitives, PathPrimitive{
					Type:             SegmentLine,
					Start:            currentStart,
					End:              filletStart,
					IsFilletBoundary: true,
				})
			}

			// G^1 Cubic Bézier fillet
			primitives = append(primitives, PathPrimitive{
				Type:     SegmentCubicBezier,
				Start:    filletStart,
				End:      filletEnd,
				Control1: &cp1,
				Control2: &cp2,
			})

			currentStart = filletEnd
		} else {
			primitives = append(primitives, PathPrimitive{
				Type:  SegmentLine,
				Start: currentStart,
				End:   pCurr,
			})
			currentStart = pCurr
		}
	}

	// Final segment to destination
	pDest := points[len(points)-1]
	if math.Hypot(pDest.X-currentStart.X, pDest.Y-currentStart.Y) > 0.01 {
		primitives = append(primitives, PathPrimitive{
			Type:  SegmentLine,
			Start: currentStart,
			End:   pDest,
		})
	}

	return primitives
}

// RenderSVGPathString converts renderer-neutral primitives to a standard SVG path data string ("d" attribute).
func RenderSVGPathString(primitives []PathPrimitive) string {
	if len(primitives) == 0 {
		return ""
	}

	d := fmt.Sprintf("M %s %s", formatCoord(primitives[0].Start.X), formatCoord(primitives[0].Start.Y))
	for _, prim := range primitives {
		switch prim.Type {
		case SegmentLine:
			if prim.IsFilletBoundary {
				d += fmt.Sprintf(" L %.2f %.2f", prim.End.X, prim.End.Y)
			} else {
				d += fmt.Sprintf(" L %s %s", formatCoord(prim.End.X), formatCoord(prim.End.Y))
			}
		case SegmentArc:
			d += fmt.Sprintf(" A %s %s 0 0 %d %s %s", formatCoord(prim.Radius), formatCoord(prim.Radius), prim.SweepFlag, formatCoord(prim.End.X), formatCoord(prim.End.Y))
		case SegmentCubicBezier:
			if prim.Control1 != nil && prim.Control2 != nil {
				d += fmt.Sprintf(" C %.2f %.2f, %.2f %.2f, %.2f %.2f",
					prim.Control1.X, prim.Control1.Y, prim.Control2.X, prim.Control2.Y, prim.End.X, prim.End.Y)
			}
		}
	}
	return d
}

// GenerateOrthogonalPathWithBridgesSVG provides direct drop-in SVG string generation matching TypeScript oracle.
func GenerateOrthogonalPathWithBridgesSVG(
	points []Point,
	edgeID string,
	allEdges []EdgeConnection,
	enableBridges bool,
	smoothCorners bool,
	weights *OptimizationWeights,
	options *RoutingOptions,
) string {
	primitives := GenerateRendererNeutralPathWithBridges(points, edgeID, allEdges, enableBridges, smoothCorners, weights, options)
	return RenderSVGPathString(primitives)
}
