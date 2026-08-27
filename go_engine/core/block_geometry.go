package core

import (
	"math"
	"sort"
	"strings"
)

const (
	BaseGrid            = 4.0
	PlacementGrid       = 10.0
	RoutingGrid         = 10.0
	DefaultCornerMargin = 14.0
	DefaultPortPitch    = 20.0
	MinBlockWidth       = 120.0
	MinBlockHeight      = 72.0
	HeaderHeight        = 24.0
	BodyPadding         = 12.0
)

func CalculateMinimumBlockSize(node BlockNode, cornerMargin, portPitch float64) (minWidth, minHeight, wPorts, hPorts float64) {
	if cornerMargin <= 0 { cornerMargin = DefaultCornerMargin }
	if portPitch <= 0 { portPitch = DefaultPortPitch }
	var allPorts []Port
	allPorts = append(allPorts, node.Inputs...)
	allPorts = append(allPorts, node.Outputs...)
	allPorts = append(allPorts, node.Ports...)
	nLeft, nRight, nTop, nBottom := 0, 0, 0, 0
	for _, p := range allPorts {
		side := p.Side
		if side == "" { if p.Type == "output" { side = SideRight } else { side = SideLeft } }
		switch side { case SideLeft: nLeft++; case SideRight: nRight++; case SideTop: nTop++; case SideBottom: nBottom++ }
	}
	nVertical := nLeft; if nRight > nVertical { nVertical = nRight }
	nHorizontal := nTop; if nBottom > nHorizontal { nHorizontal = nBottom }
	vCount := nVertical-1; if vCount < 0 { vCount = 0 }
	hCount := nHorizontal-1; if hCount < 0 { hCount = 0 }
	hPorts = 2*cornerMargin + float64(vCount)*portPitch
	wPorts = 2*cornerMargin + float64(hCount)*portPitch
	wTitle := float64(len(node.Title))*7.5 + 48
	wSubtitle := float64(len(node.Subtitle))*6.5 + 24
	wContent := math.Max(wTitle, math.Max(wSubtitle, MinBlockWidth))
	hContent := HeaderHeight + BodyPadding*2 + 24
	snap := func(v float64) float64 { return math.Ceil(v/PlacementGrid)*PlacementGrid }
	minWidth = snap(math.Max(MinBlockWidth, math.Max(wPorts, wContent)))
	minHeight = snap(math.Max(MinBlockHeight, math.Max(hPorts, hContent)))
	return
}

func SortPortsDeterministically(ports []Port) []Port {
	sorted := append([]Port(nil), ports...)
	sort.SliceStable(sorted, func(i, j int) bool {
		a, b := sorted[i], sorted[j]
		if a.GroupID != "" && b.GroupID == "" { return true }
		if a.GroupID == "" && b.GroupID != "" { return false }
		if a.GroupID != "" && b.GroupID != "" && a.GroupID != b.GroupID { return a.GroupID < b.GroupID }
		if a.Order != nil && b.Order == nil { return true }
		if a.Order == nil && b.Order != nil { return false }
		if a.Order != nil && b.Order != nil && *a.Order != *b.Order { return *a.Order < *b.Order }
		if a.PinNumber != nil && b.PinNumber == nil { return true }
		if a.PinNumber == nil && b.PinNumber != nil { return false }
		if a.PinNumber != nil && b.PinNumber != nil && *a.PinNumber != *b.PinNumber { return *a.PinNumber < *b.PinNumber }
		return a.ID < b.ID
	})
	return sorted
}

func GetPortCoordinatesAccurate(node BlockNode, portID string, isOutputHint bool) PortCoordinates {
	var allPorts []Port
	allPorts = append(allPorts, node.Inputs...)
	allPorts = append(allPorts, node.Outputs...)
	allPorts = append(allPorts, node.Ports...)
	var p Port
	found := false
	for _, candidate := range allPorts {
		if candidate.ID == portID {
			p = candidate
			found = true
			break
		}
	}
	if !found {
		isDirect := portID == "left" || portID == "right" || portID == "top" || portID == "bottom"
		side := SideRight
		if isDirect {
			side = PortSide(portID)
		} else if !isOutputHint {
			side = SideLeft
		}
		p = Port{ID: portID, Name: portID, Side: side, Type: "input", PlacementMode: "adaptive"}
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
	var same []Port
	for _, pt := range allPorts {
		s := pt.Side
		if s == "" {
			if pt.Type == "output" {
				s = SideRight
			} else {
				s = SideLeft
			}
		}
		if s == side {
			same = append(same, pt)
		}
	}
	same = SortPortsDeterministically(same)
	idx := 0
	for i, pt := range same {
		if pt.ID == p.ID {
			idx = i
			break
		}
	}
	count := len(same)
	if count <= 0 {
		count = 1
	}
	isHorizontal := side == SideTop || side == SideBottom
	sideLength := node.Height
	if isHorizontal {
		sideLength = node.Width
	}
	pos := 0.0
	if p.PlacementMode == "fixed" && p.RelativePosition != nil && *p.RelativePosition >= 0 && *p.RelativePosition <= 1 {
		pos = math.Max(DefaultCornerMargin, math.Min(sideLength-DefaultCornerMargin, sideLength*(*p.RelativePosition)))
		if p.CustomOffset != nil {
			pos = math.Max(DefaultCornerMargin, math.Min(sideLength-DefaultCornerMargin, *p.CustomOffset))
		}
	} else {
		t := float64(idx+1) / float64(count+1)
		pos = math.Max(DefaultCornerMargin, math.Min(sideLength-DefaultCornerMargin, math.Round(sideLength*t)))
	}
	var x,y float64; normal:=Direction{Dx:1}
	switch node.Shape {
	case "diamond":
		hw,hh:=node.Width/2,node.Height/2
		switch side { case SideLeft: d:=math.Abs(pos-hh)/hh; x=node.X+d*hw; y=node.Y+pos; normal=Direction{Dx:-1}; case SideRight: d:=math.Abs(pos-hh)/hh; x=node.X+node.Width-d*hw; y=node.Y+pos; normal=Direction{Dx:1}; case SideTop: d:=math.Abs(pos-hw)/hw; x=node.X+pos; y=node.Y+d*hh; normal=Direction{Dy:-1}; case SideBottom: d:=math.Abs(pos-hw)/hw; x=node.X+pos; y=node.Y+node.Height-d*hh; normal=Direction{Dy:1} }
	case "hexagon":
		hh:=node.Height/2; cw:=node.Width*.16
		switch side { case SideLeft: d:=math.Abs(pos-hh)/hh; x=node.X+d*cw; y=node.Y+pos; normal=Direction{Dx:-1}; case SideRight: d:=math.Abs(pos-hh)/hh; x=node.X+node.Width-d*cw; y=node.Y+pos; normal=Direction{Dx:1}; case SideTop: cp:=math.Max(cw,math.Min(node.Width-cw,pos)); x=node.X+cp; y=node.Y; normal=Direction{Dy:-1}; case SideBottom: cp:=math.Max(cw,math.Min(node.Width-cw,pos)); x=node.X+cp; y=node.Y+node.Height; normal=Direction{Dy:1} }
	case "circle":
		r:=math.Min(node.Width,node.Height)/2; cx,cy:=node.X+node.Width/2,node.Y+node.Height/2; frac:=pos/sideLength; span:=math.Pi/2
		switch side { case SideLeft: th:=math.Pi+(frac-.5)*span; x=cx+r*math.Cos(th); y=cy+r*math.Sin(th); normal=Direction{Dx:-1}; case SideRight: th:=(frac-.5)*span; x=cx+r*math.Cos(th); y=cy+r*math.Sin(th); normal=Direction{Dx:1}; case SideTop: th:=-math.Pi/2+(frac-.5)*span; x=cx+r*math.Cos(th); y=cy+r*math.Sin(th); normal=Direction{Dy:-1}; case SideBottom: th:=math.Pi/2+(frac-.5)*span; x=cx+r*math.Cos(th); y=cy+r*math.Sin(th); normal=Direction{Dy:1} }
	default:
		switch side { case SideLeft: x=node.X; y=node.Y+pos; normal=Direction{Dx:-1}; case SideRight: x=node.X+node.Width; y=node.Y+pos; normal=Direction{Dx:1}; case SideTop: x=node.X+pos; y=node.Y; normal=Direction{Dy:-1}; case SideBottom: x=node.X+pos; y=node.Y+node.Height; normal=Direction{Dy:1}; default: x=node.X+node.Width; y=node.Y+node.Height/2; normal=Direction{Dx:1} }
	}
	return PortCoordinates{X:math.Round(x*10)/10,Y:math.Round(y*10)/10,Normal:normal,Side:side,Port:p}
}

func BuildDerivedBlockGeometry(node BlockNode, clearance float64) DerivedBlockGeometry {
	if clearance<=0 { clearance=15 }
	minW,minH,_,_:=CalculateMinimumBlockSize(node,DefaultCornerMargin,DefaultPortPitch)
	w,h:=math.Max(minW,node.Width),math.Max(minH,node.Height); cp:=node; cp.Width=w; cp.Height=h
	all:=append(append([]Port(nil),node.Inputs...),node.Outputs...); anchors:=make([]PortCoordinates,len(all))
	for i,p:=range all { anchors[i]=GetPortCoordinatesAccurate(cp,p.ID,p.Type=="output") }
	return DerivedBlockGeometry{BlockID:node.ID,VisualBounds:[4]float64{node.X,node.Y,w,h},RoutingBounds:[4]float64{node.X,node.X+w,node.Y,node.Y+h},ObstacleBounds:[4]float64{node.X-clearance,node.X+w+clearance,node.Y-clearance,node.Y+h+clearance},PortAnchors:anchors,MinWidth:minW,MinHeight:minH,Valid:true}
}

func NormalizeModel(nodes []BlockNode, edges []EdgeConnection) ([]BlockNode, []EdgeConnection, []string) {
	var warnings []string; nodeMap:=map[string]bool{}; portMap:=map[string]bool{}
	for _,n:=range nodes { if nodeMap[n.ID] { warnings=append(warnings,"Duplicate block ID: "+n.ID) }; nodeMap[n.ID]=true; all:=append(append([]Port(nil),n.Inputs...),n.Outputs...); for _,p:=range all { key:=n.ID+"::"+p.ID; if portMap[key] { warnings=append(warnings,"Duplicate port ID in block: "+key) }; portMap[key]=true } }
	valid:=make([]EdgeConnection,0,len(edges)); for _,e:=range edges { if !nodeMap[e.SourceBlockID]||!nodeMap[e.TargetBlockID] { warnings=append(warnings,"Edge connects to nonexistent block: "+e.ID); continue }; if e.SourceBlockID==e.TargetBlockID && !strings.HasPrefix(e.ID,"loop_") { /* feedback allowed */ }; valid=append(valid,e) }
	return nodes,valid,warnings
}
