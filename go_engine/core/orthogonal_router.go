package core

import (
	"container/heap"
	"math"
)

type routeState struct {
	x, y int
	dx, dy int
	g, f float64
	parent *routeState
	index int
}

type routeQueue []*routeState
func (q routeQueue) Len() int { return len(q) }
func (q routeQueue) Less(i,j int) bool { if q[i].f == q[j].f { return q[i].g < q[j].g }; return q[i].f < q[j].f }
func (q routeQueue) Swap(i,j int) { q[i],q[j]=q[j],q[i]; q[i].index=i; q[j].index=j }
func (q *routeQueue) Push(v any) { item:=v.(*routeState); item.index=len(*q); *q=append(*q,item) }
func (q *routeQueue) Pop() any { old:=*q; n:=len(old); item:=old[n-1]; old[n-1]=nil; *q=old[:n-1]; return item }

type routeKey struct { x,y,dx,dy int }

func GetPortCoordinates(node BlockNode, portID string, outputHint bool) PortCoordinates {
	return GetPortCoordinatesAccurate(node, portID, outputHint)
}

// RouteOrthogonalAStar is the first public importable AutoTrace Core router.
// It is deterministic for identical inputs/options and preserves edge order.
func RouteOrthogonalAStar(nodes []BlockNode, edges []EdgeConnection, options RoutingOptions) []EdgeConnection {
	if len(edges)==0 { return append([]EdgeConnection(nil), edges...) }
	grid:=options.GridSize; if grid<=0 { grid=10 }
	clearance:=options.ObstacleClearance; if clearance<=0 { clearance=15 }
	bendPenalty:=options.BendPenalty; if bendPenalty<=0 { bendPenalty=35 }
	nodeMap:=make(map[string]BlockNode,len(nodes)); for _,node:=range nodes { nodeMap[node.ID]=node }
	result:=make([]EdgeConnection,len(edges))
	for i,edge:=range edges {
		source,okS:=nodeMap[edge.SourceBlockID]; target,okT:=nodeMap[edge.TargetBlockID]
		if !okS||!okT { result[i]=edge; continue }
		s:=GetPortCoordinates(source,edge.SourcePortID,true); t:=GetPortCoordinates(target,edge.TargetPortID,false)
		path:=routeOne(nodes,source.ID,target.ID,s,t,grid,clearance,bendPenalty)
		if options.ArtifactCleaning { path=CleanOrthogonalArtifacts(path,&s,&t,nodes,clearance,options.PortExitOffset,options.PortExitOffset) }
		edge.Path=path; edge.Bends=countBends(path); edge.Length=pathLength(path); result[i]=edge
	}
	return result
}

func routeOne(nodes []BlockNode, sourceID,targetID string, source,target PortCoordinates, grid,clearance,bendPenalty float64) []Point {
	startX,startY:=int(math.Round(source.X/grid)),int(math.Round(source.Y/grid))
	goalX,goalY:=int(math.Round(target.X/grid)),int(math.Round(target.Y/grid))
	stub:=int(math.Max(2,math.Round((clearance+10)/grid)))
	entryX,entryY:=startX+source.Normal.Dx*stub,startY+source.Normal.Dy*stub
	exitX,exitY:=goalX+target.Normal.Dx*stub,goalY+target.Normal.Dy*stub
	minX,maxX:=minmax(entryX,exitX); minY,maxY:=minmax(entryY,exitY)
	for _,node:=range nodes { a:=int(math.Floor((node.X-clearance)/grid)); b:=int(math.Ceil((node.X+node.Width+clearance)/grid)); c:=int(math.Floor((node.Y-clearance)/grid)); d:=int(math.Ceil((node.Y+node.Height+clearance)/grid)); if a<minX{minX=a}; if b>maxX{maxX=b}; if c<minY{minY=c}; if d>maxY{maxY=d} }
	minX-=16; maxX+=16; minY-=16; maxY+=16
	blocked:=func(x,y int) bool { px,py:=float64(x)*grid,float64(y)*grid; for _,node:=range nodes { if node.ID==sourceID||node.ID==targetID { if px>node.X+2&&px<node.X+node.Width-2&&py>node.Y+2&&py<node.Y+node.Height-2 { return true }; continue }; if px>=node.X-clearance&&px<=node.X+node.Width+clearance&&py>=node.Y-clearance&&py<=node.Y+node.Height+clearance { return true } }; return false }
	heuristic:=func(x,y int) float64 { return (math.Abs(float64(x-exitX))+math.Abs(float64(y-exitY)))*grid }
	q:=routeQueue{}; heap.Init(&q); start:=&routeState{x:entryX,y:entryY,dx:source.Normal.Dx,dy:source.Normal.Dy,f:heuristic(entryX,entryY)}; heap.Push(&q,start)
	best:=map[routeKey]float64{{entryX,entryY,start.dx,start.dy}:0}; closed:=map[routeKey]bool{}; dirs:=[][2]int{{1,0},{-1,0},{0,1},{0,-1}}; var goal *routeState
	for q.Len()>0 && len(closed)<30000 { current:=heap.Pop(&q).(*routeState); key:=routeKey{current.x,current.y,current.dx,current.dy}; if closed[key]{continue}; closed[key]=true; if current.x==exitX&&current.y==exitY { goal=current; break }; for _,d:=range dirs { dx,dy:=d[0],d[1]; if current.dx!=0||current.dy!=0 { if dx==-current.dx&&dy==-current.dy { continue } }; nx,ny:=current.x+dx,current.y+dy; if nx<minX||nx>maxX||ny<minY||ny>maxY||blocked(nx,ny){continue}; cost:=current.g+grid; if current.dx!=0||current.dy!=0 { if dx!=current.dx||dy!=current.dy { cost+=bendPenalty } }; nk:=routeKey{nx,ny,dx,dy}; if previous,ok:=best[nk]; ok&&previous<=cost { continue }; best[nk]=cost; heap.Push(&q,&routeState{x:nx,y:ny,dx:dx,dy:dy,g:cost,f:cost+heuristic(nx,ny),parent:current}) } }
	points:=[]Point{{X:source.X,Y:source.Y},{X:float64(entryX)*grid,Y:float64(entryY)*grid}}
	if goal!=nil { rev:=[]Point{}; for cur:=goal; cur!=nil&&(cur.x!=entryX||cur.y!=entryY); cur=cur.parent { rev=append(rev,Point{X:float64(cur.x)*grid,Y:float64(cur.y)*grid}) }; for i:=len(rev)-1;i>=0;i-- { points=append(points,rev[i]) } } else { points=append(points,Point{X:float64(entryX)*grid,Y:float64(exitY)*grid},Point{X:float64(exitX)*grid,Y:float64(exitY)*grid}) }
	points=append(points,Point{X:target.X,Y:target.Y}); return mergeCollinearAndZeroLength(points)
}

func minmax(a,b int)(int,int){ if a<b{return a,b}; return b,a }
func pathLength(path []Point) float64 { total:=0.0; for i:=0;i+1<len(path);i++ { total+=math.Hypot(path[i+1].X-path[i].X,path[i+1].Y-path[i].Y) }; return total }
func countBends(path []Point) int { bends:=0; for i:=1;i+1<len(path);i++ { a,b,c:=path[i-1],path[i],path[i+1]; if (!almost(a.X,b.X)&&!almost(b.X,c.X))||(!almost(a.Y,b.Y)&&!almost(b.Y,c.Y)) { bends++ } else if (almost(a.X,b.X)&&almost(b.Y,c.Y))||(almost(a.Y,b.Y)&&almost(b.X,c.X)) { bends++ } }; return bends }
