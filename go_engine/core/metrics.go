package core

import "math"

func CalculateBenchmarkMetrics(nodes []BlockNode, edges []EdgeConnection, durationMs float64, layoutAlgo, routingAlgo string) BenchmarkMetrics {
	totalWirelength:=0.0; totalBends:=0; straight:=0
	for _,edge:=range edges { totalWirelength+=pathLength(edge.Path); totalBends+=countBends(edge.Path); if len(edge.Path)==2 { straight++ } }
	crossings:=countCrossings(edges); labels:=ComputeOptimizedLabels(nodes,edges,nil,6); labelCollisions:=0; onArrow:=0
	for _,label:=range labels { if !label.IsCollisionFree { labelCollisions++ }; if label.IsOnArrow { onArrow++ } }
	labelRatio:=1.0; if len(edges)>0 { labelRatio=float64(onArrow)/float64(len(edges)) }
	normWire:=totalWirelength/math.Max(1,float64(len(edges))*200)
	hard:=labelCollisions
	score:=100-(float64(totalBends)*4+float64(crossings)*8+float64(labelCollisions)*50+(1-labelRatio)*40+math.Max(0,normWire-1)*5); if score<0 {score=0}; if score>100 {score=100}
	quality:=QualityVector{HardViolations:hard,Crossings:crossings,Bends:totalBends,StraightWiresCount:straight,StraightEdgeRatio:float64(straight)/math.Max(1,float64(len(edges))),NormalizedWirelength:math.Round(normWire*100)/100,LabelCollisions:labelCollisions,LabelsOnArrowPercentage:math.Round(labelRatio*100),CompositeScore:math.Round(score*10)/10,PortAlignmentScore:100}
	return BenchmarkMetrics{TotalWirelength:math.Round(totalWirelength*10)/10,BendCount:totalBends,CrossingsCount:crossings,LabelsOnArrowCount:onArrow,TotalLabelsCount:len(edges),LabelsOnArrowRatio:labelRatio,LabelCollisionCount:labelCollisions,ExecutionTimeMs:math.Round(durationMs*100)/100,CompositeScore:quality.CompositeScore,LayoutAlgorithm:layoutAlgo,RoutingAlgorithm:routingAlgo,QualityVector:quality}
}

func countCrossings(edges []EdgeConnection) int {
	type segment struct{ edge string; a,b Point }
	segments:=[]segment{}; for _,edge:=range edges { for i:=0;i+1<len(edge.Path);i++ { segments=append(segments,segment{edge:edge.ID,a:edge.Path[i],b:edge.Path[i+1]}) } }
	count:=0
	for i:=0;i<len(segments);i++ { for j:=i+1;j<len(segments);j++ { a,b:=segments[i],segments[j]; if a.edge==b.edge {continue}; ah:=almost(a.a.Y,a.b.Y); av:=almost(a.a.X,a.b.X); bh:=almost(b.a.Y,b.b.Y); bv:=almost(b.a.X,b.b.X); if ah&&bv { if betweenStrict(b.a.X,a.a.X,a.b.X)&&betweenStrict(a.a.Y,b.a.Y,b.b.Y){count++} } else if av&&bh { if betweenStrict(a.a.X,b.a.X,b.b.X)&&betweenStrict(b.a.Y,a.a.Y,a.b.Y){count++} } } }
	return count
}
func betweenStrict(v,a,b float64) bool { min,max:=math.Min(a,b),math.Max(a,b); return v>min+2&&v<max-2 }
