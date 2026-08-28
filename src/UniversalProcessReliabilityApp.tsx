import React, { useMemo, useState } from 'react';
import { ProcessScenarioProfile, cloneProcessScenario } from './processDomain';
import { formatDuration, roundSmart } from './processMath';
import { parseProcessScenario, serializeProcessScenario } from './processProfileIO';
import { PROCESS_SIMULATION_PROFILE_STORAGE_KEY, createBlankProcessSimulationScenario } from './processSimulationProfile';
import { RepairDistributionKind } from './processReliability';
import {
  failurePolicyForResource,
  runUniversalReliabilityMonteCarlo,
  setResourceFailurePolicy,
} from './processUniversalReliability';

const HOUR = 3600;

function persist(profile: ProcessScenarioProfile): void {
  try { localStorage.setItem(PROCESS_SIMULATION_PROFILE_STORAGE_KEY, serializeProcessScenario(profile)); } catch { /* in-memory fallback */ }
}

function loadProfile(): ProcessScenarioProfile {
  try {
    const raw = localStorage.getItem(PROCESS_SIMULATION_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = parseProcessScenario(raw);
      if (parsed.ok && parsed.value) return parsed.value;
    }
  } catch { /* fallback */ }
  return createBlankProcessSimulationScenario();
}

export default function UniversalProcessReliabilityApp() {
  const initial = useMemo(loadProfile, []);
  const [profile, setProfile] = useState(initial);
  const [snapshot, setSnapshot] = useState(() => cloneProcessScenario(initial));
  const [iterations, setIterations] = useState(300);
  const [runIterations, setRunIterations] = useState(300);
  const [seed, setSeed] = useState(20260828);
  const [runSeed, setRunSeed] = useState(20260828);
  const [slaHours, setSlaHours] = useState(8);
  const [runSlaHours, setRunSlaHours] = useState(8);

  const result = useMemo(() => runUniversalReliabilityMonteCarlo(snapshot, {
    iterations: runIterations,
    seed: runSeed,
    slaMakespanSeconds: runSlaHours > 0 ? runSlaHours * HOUR : null,
  }), [snapshot, runIterations, runSeed, runSlaHours]);

  const commit = (next: ProcessScenarioProfile) => { setProfile(next); persist(next); };
  const run = () => {
    setSnapshot(cloneProcessScenario(profile));
    setRunIterations(Math.max(1, Math.min(5000, Math.floor(iterations || 1))));
    setRunSeed(Math.floor(seed || 1));
    setRunSlaHours(Math.max(0, slaHours || 0));
    persist(profile);
  };

  return <div className="urel-app">
    <style>{`
      *{box-sizing:border-box}body{margin:0}.urel-app{min-height:100vh;background:#f6f8fb;color:#0f172a;font-family:Inter,system-ui,sans-serif}.urel-top{border-bottom:1px solid #e2e8f0;background:#fff}.urel-topin,.urel-main{max-width:1800px;margin:auto}.urel-topin{padding:12px 18px;display:flex;align-items:center;gap:10px}.urel-mark{width:42px;height:40px;border-radius:12px;background:#0f172a;color:#fff;display:grid;place-items:center;font-weight:900}.urel-brand b{display:block;font-size:14px}.urel-brand span{font-size:10px;color:#64748b}.urel-nav{margin-left:auto;display:flex;gap:6px}.urel-btn,.urel-input,.urel-select{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 10px;font:inherit;font-size:10px}.urel-btn{cursor:pointer;font-weight:800}.urel-btn.primary{background:#0f172a;color:#fff;border-color:#0f172a}.urel-main{padding:24px 18px 50px}.urel-hero h1{font-size:clamp(30px,4vw,50px);letter-spacing:-.045em;margin:5px 0 8px}.urel-hero p{max-width:1100px;color:#475569;line-height:1.55}.urel-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:end;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:14px}.urel-field{display:flex;flex-direction:column;gap:4px}.urel-field label{font-size:8px;text-transform:uppercase;color:#64748b;font-weight:900}.urel-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin-top:14px}.urel-kpi,.urel-panel{background:#fff;border:1px solid #e2e8f0;border-radius:13px;padding:11px}.urel-kpi span{display:block;font-size:8px;text-transform:uppercase;color:#64748b}.urel-kpi b{display:block;font-size:17px;margin-top:4px}.urel-grid{display:grid;grid-template-columns:minmax(380px,.9fr) minmax(600px,1.4fr);gap:14px;margin-top:14px}.urel-panel h2{font-size:14px;margin:0 0 9px}.urel-resource{border:1px solid #e2e8f0;border-radius:10px;padding:9px;margin:7px 0}.urel-rhead{display:flex;gap:8px;align-items:center}.urel-rhead b{font-size:10px}.urel-rhead small{margin-left:auto;color:#64748b;font-size:8px}.urel-rgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}.urel-rgrid label{display:flex;flex-direction:column;gap:3px;font-size:8px;color:#64748b;font-weight:800}.urel-check{flex-direction:row!important;align-items:center}.urel-table{width:100%;border-collapse:collapse;font-size:9px}.urel-table th,.urel-table td{padding:7px;border-bottom:1px solid #eef2f7;text-align:left}.urel-table th{font-size:8px;text-transform:uppercase;color:#64748b}.urel-error,.urel-warn{padding:8px;border-radius:9px;font-size:9px;margin-top:6px}.urel-error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.urel-warn{background:#fffbeb;border:1px solid #fde68a;color:#92400e}@media(max-width:1050px){.urel-grid{grid-template-columns:1fr}.urel-rgrid{grid-template-columns:1fr 1fr}}
    `}</style>
    <header className="urel-top"><div className="urel-topin"><div className="urel-mark">R</div><div className="urel-brand"><b>Universal Reliability Twin</b><span>paired baseline vs failures · same ProcessScenarioProfile</span></div><div className="urel-nav"><button className="urel-btn" onClick={()=>window.location.href='/?view=process-digital-twin'}>Digital Twin</button><button className="urel-btn" onClick={()=>window.location.href='/?view=process-risk'}>Risk</button></div></div></header>
    <main className="urel-main">
      <section className="urel-hero"><h1>MTBF/MTTR — ещё одна policy профиля</h1><p>Каждая итерация сравнивает полный профиль с тем же профилем без failures на одинаковом seed. Поэтому added delay отражает вклад отказов, сохраняя остальные stochastic, batch, compatibility, changeover и retry условия одинаковыми.</p></section>
      <section className="urel-tools"><div className="urel-field"><label>Iterations</label><input className="urel-input" type="number" min="1" max="5000" value={iterations} onChange={e=>setIterations(Math.max(1,Math.min(5000,Number(e.target.value)||1)))}/></div><div className="urel-field"><label>Seed</label><input className="urel-input" type="number" value={seed} onChange={e=>setSeed(Number(e.target.value)||1)}/></div><div className="urel-field"><label>SLA makespan, h</label><input className="urel-input" type="number" min="0" step="0.5" value={slaHours} onChange={e=>setSlaHours(Math.max(0,Number(e.target.value)||0))}/></div><button className="urel-btn primary" onClick={run}>Run paired reliability MC</button></section>
      {result.ok && <section className="urel-kpis"><div className="urel-kpi"><span>Makespan P95</span><b>{formatDuration(result.makespanSeconds.p95)}</b></div><div className="urel-kpi"><span>Baseline P95</span><b>{formatDuration(result.baselineMakespanSeconds.p95)}</b></div><div className="urel-kpi"><span>Added delay P95</span><b>{formatDuration(result.addedDelaySeconds.p95)}</b></div><div className="urel-kpi"><span>Throughput P50</span><b>{roundSmart(result.throughputPerHour.p50)}/ч</b></div><div className="urel-kpi"><span>Availability P50</span><b>{roundSmart(result.availabilityPercent.p50)}%</b></div><div className="urel-kpi"><span>SLA confidence</span><b>{result.slaProbabilityPercent==null?'—':`${roundSmart(result.slaProbabilityPercent)}%`}</b></div><div className="urel-kpi"><span>Changeover P95</span><b>{formatDuration(result.changeoverSeconds.p95)}</b></div><div className="urel-kpi"><span>Rework P95</span><b>{roundSmart(result.reworkRatePercent.p95)}%</b></div></section>}
      <div className="urel-grid"><section className="urel-panel"><h2>Failure policies</h2>{profile.resources.map(resource=>{const policy=failurePolicyForResource(profile,resource.id);const enabled=Boolean(policy);const update=(patch:Partial<{enabled:boolean;mtbfHours:number;mttrHours:number;distribution:RepairDistributionKind;spread:number}>)=>{const nextEnabled=patch.enabled??enabled;commit(setResourceFailurePolicy(profile,resource.id,{enabled:nextEnabled,mtbfSeconds:Math.max(.001,patch.mtbfHours??((policy?.mtbfSeconds||168*HOUR)/HOUR))*HOUR,mttrSeconds:Math.max(.001,patch.mttrHours??((policy?.mttrSeconds||2*HOUR)/HOUR))*HOUR,repairDistribution:patch.distribution??policy?.repairDistribution??'triangular',repairSpreadPercent:patch.spread??policy?.repairSpreadPercent??25}));};return <div className="urel-resource" key={resource.id}><div className="urel-rhead"><b>{resource.name}</b><small>{resource.id} · capacity {resource.capacity}</small></div><div className="urel-rgrid"><label className="urel-check"><input type="checkbox" checked={enabled} onChange={e=>update({enabled:e.target.checked})}/>MTBF/MTTR</label><label>MTBF, h<input className="urel-input" type="number" min=".001" value={(policy?.mtbfSeconds||168*HOUR)/HOUR} onChange={e=>update({mtbfHours:Number(e.target.value)})}/></label><label>MTTR, h<input className="urel-input" type="number" min=".001" value={(policy?.mttrSeconds||2*HOUR)/HOUR} onChange={e=>update({mttrHours:Number(e.target.value)})}/></label><label>Distribution<select className="urel-select" value={policy?.repairDistribution||'triangular'} onChange={e=>update({distribution:e.target.value as RepairDistributionKind})}><option value="fixed">Fixed</option><option value="uniform">Uniform</option><option value="triangular">Triangular</option></select></label><label>Spread ±%<input className="urel-input" type="number" min="0" max="95" value={policy?.repairSpreadPercent??25} onChange={e=>update({spread:Number(e.target.value)})}/></label></div></div>;})}</section>
      <section className="urel-panel"><h2>Paired reliability result</h2>{result.errors.map((e,i)=><div className="urel-error" key={i}>{e}</div>)}{result.warnings.slice(0,6).map((w,i)=><div className="urel-warn" key={i}>{w}</div>)}{result.ok&&<table className="urel-table"><thead><tr><th>Resource</th><th>Mean failures</th><th>P95 failures</th><th>Mean availability</th><th>P05 availability</th></tr></thead><tbody>{result.resourceStats.map(stat=><tr key={stat.resourceId}><td>{stat.resourceName}</td><td>{roundSmart(stat.meanFailureWindows)}</td><td>{roundSmart(stat.p95FailureWindows)}</td><td>{roundSmart(stat.meanAvailabilityPercent)}%</td><td>{roundSmart(stat.p05AvailabilityPercent)}%</td></tr>)}</tbody></table>}</section></div>
    </main>
  </div>;
}
