package main

import (
	"math"
	"sort"
	"strings"
)

const (
	BaseGrid           = 4.0
	PlacementGrid      = 10.0
	RoutingGrid        = 10.0
	DefaultCornerMargin = 14.0
	DefaultPortPitch    = 20.0
	MinBlockWidth       = 120.0
	MinBlockHeight      = 72.0
	HeaderHeight        = 24.0
	BodyPadding         = 12.0
)

// CalculateMinimumBlockSize calculates required dimensions for a block (rule/2.md §7, §8, §9)
func CalculateMinimumBlockSize(node BlockNode, cornerMargin, portPitch float64) (minWidth, minHeight, wPorts, hPorts float64) {
	if cornerMargin <= 0 {
		cornerMargin = DefaultCornerMargin
	}
	if portPitch <= 0 {
		portPitch = DefaultPortPitch
	}

	var allPorts []Port
	allPorts = append(allPorts, node.Inputs...)
	allPorts = append(allPorts, node.Outputs...)

	nLeft, nRight, nTop, nBottom := 0, 0, 0, 0
	for _, p := range allPorts {
		side := p.Side
		if side == "" {
			if p.Type == "output" {
				side = SideRight
			} else {
				side = SideLeft
			}
		}
		switch side {
		case SideLeft:
			nLeft++
		case SideRight:
			nRight++
		case SideTop:
			nTop++
		case SideBottom:
			nBottom++
		}
	}

	nVertical := nLeft
	if nRight > nVertical {
		nVertical = nRight
	}
	nHorizontal := nTop
	if nBottom > nHorizontal {
		nHorizontal = nBottom
	}

	vCount := nVertical - 1
	if vCount < 0 {
		vCount = 0
	}
	hCount := nHorizontal - 1
	if hCount < 0 {
		hCount = 0
	}

	hPorts = 2*cornerMargin + float64(vCount)*portPitch
	wPorts = 2*cornerMargin + float64(hCount)*portPitch

	titleLen := float64(len(node.Title))
	wTitle := titleLen*7.5 + 48.0
	subtitleLen := float64(len(node.Subtitle))
	wSubtitle := subtitleLen*6.5 + 24.0

	wContent := math.Max(wTitle, math.Max(wSubtitle, MinBlockWidth))
	hContent := HeaderHeight + BodyPadding*2 + 24.0

	snap := func(v float64) float64 {
		return math.Ceil(v/PlacementGrid) * PlacementGrid
	}

	minWidth = snap(math.Max(MinBlockWidth, math.Max(wPorts, wContent)))
	minHeight = snap(math.Max(MinBlockHeight, math.Max(hPorts, hContent)))
	return
}

// SortPortsDeterministically sorts ports according to rule/2.md §20, §21
func SortPortsDeterministically(ports []Port) []Port {
	sorted := make([]Port, len(ports))
	copy(sorted, ports)

	sort.SliceStable(sorted, func(i, j int) bool {
		a, b := sorted[i], sorted[j]
		if a.GroupID != "" && b.GroupID == "" {
			return true
		}
		if a.GroupID == "" && b.GroupID != "" {
			return false
		}
		if a.GroupID != "" && b.GroupID != "" && a.GroupID != b.GroupID {
			return a.GroupID < b.GroupID
		}
		if a.Order != b.Order {
			return a.Order < b.Order
		}
		if a.PinNumber != b.PinNumber {
			return a.PinNumber < b.PinNumber
		}
		return a.ID < b.ID
	})
	return sorted
}

// GetPortCoordinatesAccurate calculates port position on block (rule/2.md §17-§19)
func GetPortCoordinatesAccurate(node BlockNode, portID string, isOutputHint bool) PortCoordinates {
	var allPorts []Port
	allPorts = append(allPorts, node.Inputs...)
	allPorts = append(allPorts, node.Outputs...)

	var foundPort *Port
	for i := range allPorts {
		if allPorts[i].ID == portID {
			foundPort = &allPorts[i]
			break
		}
	}

	var p Port
	if foundPort != nil {
		p = *foundPort
	} else {
		isDirectSide := portID == "left" || portID == "right" || portID == "top" || portID == "bottom"
		fallbackSide := SideRight
		if isDirectSide {
			fallbackSide = PortSide(portID)
		} else if !isOutputHint {
			fallbackSide = SideLeft
		}
		p = Port{
			ID:            portID,
			Name:          portID,
			Side:          fallbackSide,
			Type:          "input",
			PlacementMode: "adaptive",
		}
		if isOutputHint {
			p.Type = "output"
		}
	}

	side := p.Side
	if side == "" {
		if p.Type == "output" {
			side = SideRight
		} else {
			side = SideLeft
		}
	}

	var sameSidePorts []Port
	for _, pt := range allPorts {
		ptSide := pt.Side
		if ptSide == "" {
			if pt.Type == "output" {
				ptSide = SideRight
			} else {
				ptSide = SideLeft
			}
		}
		if ptSide == side {
			sameSidePorts = append(sameSidePorts, pt)
		}
	}

	sameSidePorts = SortPortsDeterministically(sameSidePorts)
	portIndex := 0
	for idx, pt := range sameSidePorts {
		if pt.ID == p.ID {
			portIndex = idx
			break
		}
	}

	count := len(sameSidePorts)
	if count <= 0 {
		count = 1
	}

	cornerMargin := DefaultCornerMargin
	isHorizontal := side == SideTop || side == SideBottom
	sideLength := node.Height
	if isHorizontal {
		sideLength = node.Width
	}

	var posOnSide float64
	isFixed := p.PlacementMode == "fixed"

	if isFixed && p.RelativePosition > 0 && p.RelativePosition <= 1.0 {
		rawPos := sideLength * p.RelativePosition
		posOnSide = math.Max(cornerMargin, math.Min(sideLength-cornerMargin, rawPos))
		if p.CustomOffset > 0 {
			posOnSide = math.Max(cornerMargin, math.Min(sideLength-cornerMargin, p.CustomOffset))
		}
	} else {
		t := float64(portIndex+1) / float64(count+1)
		rawPos := sideLength * t
		posOnSide = math.Max(cornerMargin, math.Min(sideLength-cornerMargin, math.Round(rawPos)))
	}

	var x, y float64
	normal := Direction{Dx: 1, Dy: 0}

	shape := node.Shape
	if shape == "diamond" {
		halfW := node.Width / 2.0
		halfH := node.Height / 2.0
		switch side {
		case SideLeft:
			distFromCenterY := math.Abs(posOnSide-halfH) / halfH
			x = node.X + distFromCenterY*halfW
			y = node.Y + posOnSide
			normal = Direction{Dx: -1, Dy: 0}
		case SideRight:
			distFromCenterY := math.Abs(posOnSide-halfH) / halfH
			x = node.X + node.Width - distFromCenterY*halfW
			y = node.Y + posOnSide
			normal = Direction{Dx: 1, Dy: 0}
		case SideTop:
			distFromCenterX := math.Abs(posOnSide-halfW) / halfW
			x = node.X + posOnSide
			y = node.Y + distFromCenterX*halfH
			normal = Direction{Dx: 0, Dy: -1}
		case SideBottom:
			distFromCenterX := math.Abs(posOnSide-halfW) / halfW
			x = node.X + posOnSide
			y = node.Y + node.Height - distFromCenterX*halfH
			normal = Direction{Dx: 0, Dy: 1}
		}
	} else if shape == "hexagon" {
		halfH := node.Height / 2.0
		chamferW := node.Width * 0.16
		switch side {
		case SideLeft:
			distFromCenterY := math.Abs(posOnSide-halfH) / halfH
			x = node.X + distFromCenterY*chamferW
			y = node.Y + posOnSide
			normal = Direction{Dx: -1, Dy: 0}
		case SideRight:
			distFromCenterY := math.Abs(posOnSide-halfH) / halfH
			x = node.X + node.Width - distFromCenterY*chamferW
			y = node.Y + posOnSide
			normal = Direction{Dx: 1, Dy: 0}
		case SideTop:
			clampedPos := math.Max(chamferW, math.Min(node.Width-chamferW, posOnSide))
			x = node.X + clampedPos
			y = node.Y
			normal = Direction{Dx: 0, Dy: -1}
		case SideBottom:
			clampedPos := math.Max(chamferW, math.Min(node.Width-chamferW, posOnSide))
			x = node.X + clampedPos
			y = node.Y + node.Height
			normal = Direction{Dx: 0, Dy: 1}
		}
	} else if shape == "circle" {
		radius := math.Min(node.Width, node.Height) / 2.0
		cx := node.X + node.Width/2.0
		cy := node.Y + node.Height/2.0
		frac := posOnSide / sideLength
		angleSpan := math.Pi / 2.0

		switch side {
		case SideLeft:
			theta := math.Pi + (frac-0.5)*angleSpan
			x = cx + radius*math.Cos(theta)
			y = cy + radius*math.Sin(theta)
			normal = Direction{Dx: -1, Dy: 0}
		case SideRight:
			theta := 0.0 + (frac-0.5)*angleSpan
			x = cx + radius*math.Cos(theta)
			y = cy + radius*math.Sin(theta)
			normal = Direction{Dx: 1, Dy: 0}
		case SideTop:
			theta := -math.Pi/2.0 + (frac-0.5)*angleSpan
			x = cx + radius*math.Cos(theta)
			y = cy + radius*math.Sin(theta)
			normal = Direction{Dx: 0, Dy: -1}
		case SideBottom:
			theta := math.Pi/2.0 + (frac-0.5)*angleSpan
			x = cx + radius*math.Cos(theta)
			y = cy + radius*math.Sin(theta)
			normal = Direction{Dx: 0, Dy: 1}
		}
	} else {
		switch side {
		case SideLeft:
			x = node.X
			y = node.Y + posOnSide
			normal = Direction{Dx: -1, Dy: 0}
		case SideRight:
			x = node.X + node.Width
			y = node.Y + posOnSide
			normal = Direction{Dx: 1, Dy: 0}
		case SideTop:
			x = node.X + posOnSide
			y = node.Y
			normal = Direction{Dx: 0, Dy: -1}
		case SideBottom:
			x = node.X + posOnSide
			y = node.Y + node.Height
			normal = Direction{Dx: 0, Dy: 1}
		default:
			x = node.X + node.Width
			y = node.Y + node.Height/2.0
			normal = Direction{Dx: 1, Dy: 0}
		}
	}

	return PortCoordinates{
		X:      math.Round(x*10) / 10,
		Y:      math.Round(y*10) / 10,
		Normal: normal,
		Side:   side,
		Port:   p,
	}
}

// BuildDerivedBlockGeometry builds derived geometry for Go engine (rule/2.md §79)
func BuildDerivedBlockGeometry(node BlockNode, clearance float64) DerivedBlockGeometry {
	if clearance <= 0 {
		clearance = 15.0
	}
	minW, minH, _, _ := CalculateMinimumBlockSize(node, DefaultCornerMargin, DefaultPortPitch)
	w := math.Max(minW, node.Width)
	h := math.Max(minH, node.Height)

	nodeCopy := node
	nodeCopy.Width = w
	nodeCopy.Height = h

	var allPorts []Port
	allPorts = append(allPorts, node.Inputs...)
	allPorts = append(allPorts, node.Outputs...)

	anchors := make([]PortCoordinates, len(allPorts))
	for i, p := range allPorts {
		anchors[i] = GetPortCoordinatesAccurate(nodeCopy, p.ID, p.Type == "output")
	}

	return DerivedBlockGeometry{
		BlockID:        node.ID,
		VisualBounds:   [4]float64{node.X, node.Y, w, h},
		RoutingBounds:  [4]float64{node.X, node.X + w, node.Y, node.Y + h},
		ObstacleBounds: [4]float64{node.X - clearance, node.X + w + clearance, node.Y - clearance, node.Y + h + clearance},
		PortAnchors:    anchors,
		MinWidth:       minW,
		MinHeight:      minH,
		Valid:          true,
		Violations:     nil,
	}
}

// NormalizeModel validates block IDs, port IDs and connections (rule/2.md §30, §103)
func NormalizeModel(nodes []BlockNode, edges []EdgeConnection) ([]BlockNode, []EdgeConnection, []string) {
	var warnings []string
	nodeMap := make(map[string]bool)
	portMap := make(map[string]bool)

	for _, n := range nodes {
		if nodeMap[n.ID] {
			warnings = append(warnings, "Duplicate block ID: "+n.ID)
		}
		nodeMap[n.ID] = true
		for _, p := range append(n.Inputs, n.Outputs...) {
			key := n.ID + "::" + p.ID
			if portMap[key] {
				warnings = append(warnings, "Duplicate port ID in block: "+key)
			}
			portMap[key] = true
		}
	}

	var validEdges []EdgeConnection
	for _, e := range edges {
		if !nodeMap[e.SourceBlockID] || !nodeMap[e.TargetBlockID] {
			warnings = append(warnings, "Edge connects to nonexistent block: "+e.ID)
			continue
		}
		if e.SourceBlockID == e.TargetBlockID {
			// Self loop
			if !strings.HasPrefix(e.ID, "loop_") {
				// handled as feedback
			}
		}
		validEdges = append(validEdges, e)
	}

	return nodes, validEdges, warnings
}
