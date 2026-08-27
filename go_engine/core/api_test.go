package core

import "testing"

func TestRouteSimpleGraph(t *testing.T) {
	nodes:=[]BlockNode{
		{ID:"a",Title:"A",X:0,Y:0,Width:80,Height:50,Outputs:[]Port{{ID:"out",Name:"out",Side:SideRight,Type:"output"}}},
		{ID:"b",Title:"B",X:300,Y:0,Width:80,Height:50,Inputs:[]Port{{ID:"in",Name:"in",Side:SideLeft,Type:"input"}}},
	}
	edges:=[]EdgeConnection{{ID:"e1",SourceBlockID:"a",SourcePortID:"out",TargetBlockID:"b",TargetPortID:"in"}}
	result, err := Route(RouteRequest{GraphID: "g", Nodes: nodes, Edges: edges, Options: RoutingOptions{GridSize: 10, ObstacleClearance: 10, ArtifactCleaning: OptBool(true)}})
	if err!=nil { t.Fatal(err) }
	if result.ContractVersion!=ContractVersion || result.Engine!=EngineID { t.Fatalf("unexpected identity: %#v",result) }
	if len(result.Edges)!=1 || len(result.Edges[0].Path)<2 { t.Fatalf("route missing: %#v",result.Edges) }
	if result.Metrics.TotalWirelength<=0 { t.Fatalf("metrics not calculated: %#v",result.Metrics) }
}

func TestValidateSceneRejectsDanglingPort(t *testing.T) {
	nodes:=[]BlockNode{{ID:"a",Width:10,Height:10,Outputs:[]Port{{ID:"out"}}},{ID:"b",Width:10,Height:10}}
	edges:=[]EdgeConnection{{ID:"e",SourceBlockID:"a",SourcePortID:"missing",TargetBlockID:"b"}}
	if err:=ValidateScene(nodes,edges); err==nil { t.Fatal("expected dangling port error") }
}

func TestRouteIsDeterministicIgnoringDuration(t *testing.T) {
	nodes:=[]BlockNode{{ID:"a",X:0,Y:0,Width:80,Height:50,Outputs:[]Port{{ID:"out",Side:SideRight,Type:"output"}}},{ID:"b",X:260,Y:120,Width:80,Height:50,Inputs:[]Port{{ID:"in",Side:SideLeft,Type:"input"}}}}
	edges:=[]EdgeConnection{{ID:"e",SourceBlockID:"a",SourcePortID:"out",TargetBlockID:"b",TargetPortID:"in"}}
	a,err:=Route(RouteRequest{Nodes:nodes,Edges:edges}); if err!=nil {t.Fatal(err)}
	b,err:=Route(RouteRequest{Nodes:nodes,Edges:edges}); if err!=nil {t.Fatal(err)}
	if len(a.Edges[0].Path)!=len(b.Edges[0].Path) { t.Fatalf("path length differs") }
	for i:=range a.Edges[0].Path { if a.Edges[0].Path[i]!=b.Edges[0].Path[i] { t.Fatalf("non-deterministic point %d: %#v vs %#v",i,a.Edges[0].Path[i],b.Edges[0].Path[i]) } }
}
