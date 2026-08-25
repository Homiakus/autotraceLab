package core

import "math"

const MaxLabelOffArrowPenalty = 50000.0

func ComputeOptimizedLabels(nodes []BlockNode, edges []EdgeConnection, customOffsets map[string]Point, clearance float64) map[string]LabelPlacement {
	if clearance<=0 { clearance=6 }
	result:=make(map[string]LabelPlacement,len(edges))
	for _,edge:=range edges {
		label:=edge.Label; if label=="" { label=edge.ID }
		width:=float64(len(label))*7.2+14; height:=18.0
		if off,ok:=customOffsets[edge.ID]; ok && (math.Abs(off.X)>200||math.Abs(off.Y)>200) { result[edge.ID]=LabelPlacement{EdgeID:edge.ID,Label:label,X:off.X,Y:off.Y,Width:width,Height:height,SegmentIndex:-1,IsOnArrow:false,IsCollisionFree:false,Penalty:MaxLabelOffArrowPenalty}; continue }
		if len(edge.Path)<2 { result[edge.ID]=LabelPlacement{EdgeID:edge.ID,Label:label,Width:width,Height:height,IsHorizontal:true,IsOnArrow:true,IsCollisionFree:true}; continue }
		bestIndex:=0; bestLen:=-1.0; bestHorizontal:=false
		for i:=0;i+1<len(edge.Path);i++ { a,b:=edge.Path[i],edge.Path[i+1]; length:=math.Hypot(b.X-a.X,b.Y-a.Y); horizontal:=almost(a.Y,b.Y); score:=length; if horizontal { score+=25 }; if score>bestLen { bestLen=score; bestIndex=i; bestHorizontal=horizontal } }
		a,b:=edge.Path[bestIndex],edge.Path[bestIndex+1]; x:=(a.X+b.X)/2-width/2; y:=(a.Y+b.Y)/2-height/2; collision:=false
		for _,node:=range nodes { if x+width>node.X-clearance&&x<node.X+node.Width+clearance&&y+height>node.Y-clearance&&y<node.Y+node.Height+clearance { collision=true; break } }
		result[edge.ID]=LabelPlacement{EdgeID:edge.ID,Label:label,X:x,Y:y,Width:width,Height:height,SegmentIndex:bestIndex,IsHorizontal:bestHorizontal,IsOnArrow:true,IsCollisionFree:!collision}
	}
	return result
}
