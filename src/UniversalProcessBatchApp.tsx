import React, { useMemo, useState } from 'react';
import { ProcessScenarioProfile, cloneProcessScenario } from './processDomain';
import { formatDuration, roundSmart } from './processMath';
import { parseProcessScenario, serializeProcessScenario } from './processProfileIO';
import {
  LEGACY_BATCH_SIMULATION_STORAGE_KEY,
  defaultBatchPolicyForBlock,
  evaluateProcessBatchReadiness,
  getBatchPolicy,
  migrateLegacyBatchPolicies,
  removeProcessBatchPolicy,
  setProcessBatchPolicy,
} from './processBatchProfile';
import { ProcessBatchConfig } from './processBatchSimulation';
import {
  PROCESS_SIMULATION_PROFILE_STORAGE_KEY,
  createBlankProcessSimulationScenario,
} from './processSimulationProfile';
import { simulateUniversalScenario } from './processUniversalCompiler';
import { runUniversalProcessMonteCarlo } from './processUniversalRisk';

function persist(profile: ProcessScenarioProfile): void {
  try {
    localStorage.setItem(PROCESS_SIMULATION_PROFILE_STORAGE_KEY, serializeProcessScenario(profile));
  } catch {
    // Continue in memory.
  }
}

function loadProfile(): ProcessScenarioProfile {
  let profile = createBlankProcessSimulationScenario();
  try {
    const raw = localStorage.getItem(PROCESS_SIMULATION_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = parseProcessScenario(raw);
      if (parsed.ok && parsed.value) profile = parsed.value;
    }
  } catch {
    // Use fallback profile.
  }
  if (!profile.batchPolicies?.length) {
    try {
      const raw = localStorage.getItem(LEGACY_BATCH_SIMULATION_STORAGE_KEY);
      if (raw) {
        const legacy = JSON.parse(raw) as ProcessBatchConfig[];
        if (Array.isArray(legacy) && legacy.length) {
          profile = migrateLegacyBatchPolicies(profile, legacy);
          persist(profile);
        }
      }
    } catch {
      // Invalid legacy batch state is ignored.
    }
  }
  return profile;
}

export default function UniversalProcessBatchApp() {
  const initial = useMemo(loadProfile, []);
  const [profile, setProfile] = useState<ProcessScenarioProfile>(initial);
  const [seed, setSeed] = useState(20260828);
  const [iterations, setIterations] = useState(200);
  const [riskProfile, setRiskProfile] = useState<ProcessScenarioProfile>(() => cloneProcessScenario(initial));
  const [riskSeed, setRiskSeed] = useState(20260828);
  const [riskIterations, setRiskIterations] = useState(200);
  const [notice, setNotice] = useState('');

  const readiness = useMemo(() => evaluateProcessBatchReadiness(profile), [profile]);
  const simulation = useMemo(() => simulateUniversalScenario(profile, seed), [profile, seed]);
  const monteCarlo = useMemo(() => runUniversalProcessMonteCarlo(riskProfile, { iterations: riskIterations, seed: riskSeed }), [riskProfile, riskIterations, riskSeed]);
  const maxTimeline = Math.max(1, simulation.stats.makespanSeconds);
  const visibleCycles = simulation.core.batchCycles.slice(0, 100);

  const commit = (next: ProcessScenarioProfile, message?: string) => {
    setProfile(next);
    persist(next);
    if (message) setNotice(message);
  };

  const reload = () => {
    const next = loadProfile();
    setProfile(next);
    setRiskProfile(cloneProcessScenario(next));
    setNotice('Universal Simulation profile перечитан');
  };

  const toggle = (blockId: string) => {
    const existing = getBatchPolicy(profile, blockId);
    commit(existing
      ? removeProcessBatchPolicy(profile, blockId)
      : setProcessBatchPolicy(profile, defaultBatchPolicyForBlock(profile, blockId)));
  };

  const update = (blockId: string, patch: Partial<ProcessBatchConfig>) => {
    const current = getBatchPolicy(profile, blockId);
    if (!current) return;
    commit(setProcessBatchPolicy(profile, { ...current, ...patch }));
  };

  const runRisk = () => {
    setRiskProfile(cloneProcessScenario(profile));
    setRiskSeed(Math.floor(seed || 1));
    setRiskIterations(Math.max(1, Math.min(5000, Math.floor(iterations || 1))));
    persist(profile);
    setNotice(`Batch Monte Carlo snapshot: ${Math.max(1, Math.min(5000, Math.floor(iterations || 1)))} iterations`);
  };

  return (
    <div className="ubatch-app">
      <style>{`
        *{box-sizing:border-box}body{margin:0}.ubatch-app{min-height:100vh;background:#f7f8fb;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.ubatch-top{position:sticky;top:0;z-index:30;background:rgba(247,248,251,.95);backdrop-filter:blur(14px);border-bottom:1px solid #e2e8f0}.ubatch-topin{max-width:1800px;margin:auto;padding:12px 18px;display:flex;gap:10px;align-items:center}.ubatch-mark{width:42px;height:40px;border-radius:12px;background:#0f172a;color:#fff;display:grid;place-items:center;font-weight:900}.ubatch-brand b{display:block;font-size:14px}.ubatch-brand span{font-size:10px;color:#64748b}.ubatch-nav{margin-left:auto;display:flex;gap:6px}.ubatch-btn,.ubatch-input{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 10px;font:inherit;font-size:10px;color:#0f172a}.ubatch-btn{font-weight:800;cursor:pointer}.ubatch-btn.primary{background:#0f172a;color:#fff;border-color:#0f172a}.ubatch-hero,.ubatch-tools,.ubatch-grid{max-width:1800px;margin:auto}.ubatch-hero{padding:24px 18px 10px}.ubatch-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;font-weight:900}.ubatch-hero h1{font-size:clamp(30px,4vw,50px);letter-spacing:-.045em;line-height:1.03;margin:5px 0 8px}.ubatch-hero p{max-width:1120px;color:#475569;line-height:1.55;margin:0}.ubatch-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:end;padding:10px 18px 15px}.ubatch-model{border:1px solid #e2e8f0;background:#fff;border-radius:9px;padding:8px 10px;font-size:10px;color:#475569}.ubatch-field{display:flex;flex-direction:column;gap:4px}.ubatch-field label{font-size:8px;text-transform:uppercase;color:#64748b;font-weight:900}.ubatch-chip{border:1px solid #dbe3ee;background:#fff;border-radius:999px;padding:5px 8px;font-size:8px;color:#475569}.ubatch-chip.ok{color:#166534;background:#f0fdf4;border-color:#bbf7d0}.ubatch-notice{max-width:1800px;margin:0 auto;padding:0 18px 10px;font-size:10px;color:#475569}.ubatch-grid{padding:0 18px 40px;display:grid;grid-template-columns:minmax(370px,.85fr) minmax(600px,1.5fr);gap:14px}.ubatch-panel{background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:13px;box-shadow:0 5px 16px rgba(15,23,42,.04)}.ubatch-panel h2{font-size:14px;margin:0 0 9px}.ubatch-panel h3{font-size:11px;margin:14px 0 7px}.ubatch-stage{border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin:7px 0}.ubatch-head{display:flex;align-items:center;gap:6px}.ubatch-head b{font-size:10px}.ubatch-head small{margin-left:auto;color:#64748b;font-size:8px}.ubatch-check{display:flex;align-items:center;gap:5px;font-size:8px;color:#475569}.ubatch-config{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:7px}.ubatch-config label{display:flex;flex-direction:column;gap:3px;font-size:8px;text-transform:uppercase;color:#64748b;font-weight:900}.ubatch-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.ubatch-kpi{border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:9px}.ubatch-kpi span{display:block;font-size:8px;text-transform:uppercase;color:#64748b}.ubatch-kpi b{display:block;margin-top:4px;font-size:14px}.ubatch-error,.ubatch-warning{padding:7px;border-radius:9px;font-size:9px;line-height:1.45;margin-top:6px}.ubatch-error{border:1px solid #fecaca;background:#fef2f2;color:#991b1b}.ubatch-warning{border:1px solid #fde68a;background:#fffbeb;color:#92400e}.ubatch-table{width:100%;border-collapse:collapse;font-size:9px}.ubatch-table th,.ubatch-table td{text-align:left;padding:6px;border-bottom:1px solid #eef2f7}.ubatch-table th{font-size:8px;text-transform:uppercase;color:#64748b}.ubatch-timeline{border:1px solid #e2e8f0;border-radius:10px;padding:7px;max-height:320px;overflow:auto}.ubatch-cycle{display:grid;grid-template-columns:120px 1fr 55px;gap:6px;align-items:center;margin:4px 0;font-size:8px}.ubatch-track{height:12px;background:#f1f5f9;border-radius:4px;position:relative;overflow:hidden}.ubatch-track i{position:absolute;height:100%;background:#7c3aed;border-radius:4px}.ubatch-note{font-size:9px;color:#64748b;line-height:1.5}.ubatch-risk{margin-top:12px;border-top:1px solid #eef2f7;padding-top:12px}@media(max-width:1050px){.ubatch-grid{grid-template-columns:1fr}.ubatch-kpis{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <header className="ubatch-top"><div className="ubatch-topin"><div className="ubatch-mark">B×N</div><div className="ubatch-brand"><b>Universal Batch Policies</b><span>deterministic + Monte Carlo · same ProcessScenarioProfile</span></div><div className="ubatch-nav"><button className="ubatch-btn" onClick={()=>window.location.href='/?view=process-sim'}>Simulation</button><button className="ubatch-btn" onClick={()=>window.location.href='/?view=process-risk'}>Risk</button><button className="ubatch-btn" onClick={()=>window.location.href='/'}>AutoTrace</button></div></div></header>
      <section className="ubatch-hero"><div className="ubatch-eyebrow">Universal batch cycle editor v2</div><h1>Batch — политика профиля, а не отдельный формат</h1><p>`batchPolicies` редактируются прямо в том же profile. Compatibility/changeover правила из Domain Pack остаются нетронутыми и автоматически применяются Universal Scheduler. BatchRisk теперь является Monte Carlo snapshot этого же цифрового двойника.</p></section>
      <section className="ubatch-tools"><div className="ubatch-model"><b>{profile.name}</b> · jobs {profile.jobs.length} · batch blocks {profile.batchPolicies?.length||0}</div><span className={`ubatch-chip ${readiness.ready?'ok':''}`}>compatibility policies {readiness.compatibilityPolicyCount}</span><button className="ubatch-btn" onClick={reload}>↻ перечитать Simulation v2</button><div className="ubatch-field"><label>Seed</label><input className="ubatch-input" type="number" value={seed} onChange={event=>setSeed(Number(event.target.value)||1)}/></div><div className="ubatch-field"><label>MC iterations</label><input className="ubatch-input" type="number" min="1" max="5000" value={iterations} onChange={event=>setIterations(Math.max(1,Number(event.target.value)||1)}/></div><button className="ubatch-btn primary" onClick={runRisk}>Run BatchRisk snapshot</button></section>{notice&&<div className="ubatch-notice">{notice}</div>}

      <main className="ubatch-grid"><section className="ubatch-panel"><h2>Batch policies by operation</h2><p className="ubatch-note">Capacity — физическая вместимость одного общего цикла. Min batch — сколько jobs достаточно для обычного запуска. Max wait — максимальное ожидание anchor job до разрешения неполной партии.</p>{profile.blocks.map(block=>{const policy=getBatchPolicy(profile,block.id);return <div className="ubatch-stage" key={block.id}><div className="ubatch-head"><label className="ubatch-check"><input type="checkbox" checked={Boolean(policy)} onChange={()=>toggle(block.id)}/>Batch cycle</label><b>{block.title}</b><small>{block.time.formula?`ƒ ${block.time.formula}`:`${block.time.value??'?'} ${block.time.unit}`}</small></div>{policy&&<div className="ubatch-config"><label>Capacity<input className="ubatch-input" type="number" min="1" value={policy.batchCapacity} onChange={event=>update(block.id,{batchCapacity:Number(event.target.value)})}/></label><label>Min batch<input className="ubatch-input" type="number" min="1" max={policy.batchCapacity} value={policy.minBatchSize} onChange={event=>update(block.id,{minBatchSize:Number(event.target.value)})}/></label><label>Max wait, sec<input className="ubatch-input" type="number" min="0" value={policy.maxWaitSeconds} onChange={event=>update(block.id,{maxWaitSeconds:Number(event.target.value)})}/></label></div>}</div>;})}</section>

      <section className="ubatch-panel"><h2>Deterministic universal result</h2>{simulation.errors.map((error,index)=><div className="ubatch-error" key={index}>{error}</div>)}{simulation.warnings.slice(0,6).map((warning,index)=><div className="ubatch-warning" key={index}>{warning}</div>)}{simulation.ok&&<><div className="ubatch-kpis"><div className="ubatch-kpi"><span>Makespan</span><b>{formatDuration(simulation.stats.makespanSeconds)}</b></div><div className="ubatch-kpi"><span>Throughput</span><b>{simulation.stats.throughputPerHour==null?'—':`${roundSmart(simulation.stats.throughputPerHour)}/ч`}</b></div><div className="ubatch-kpi"><span>Batch cycles</span><b>{simulation.core.stats.batchCycles}</b></div><div className="ubatch-kpi"><span>Avg fill</span><b>{roundSmart(simulation.stats.averageBatchFillPercent)}%</b></div><div className="ubatch-kpi"><span>Partial cycles</span><b>{simulation.core.stats.partialBatchCycles}</b></div><div className="ubatch-kpi"><span>P95 wait</span><b>{formatDuration(simulation.stats.p95WaitSeconds)}</b></div><div className="ubatch-kpi"><span>Changeover</span><b>{formatDuration(simulation.policyStats.totalChangeoverSeconds)}</b></div><div className="ubatch-kpi"><span>Rework</span><b>{roundSmart(simulation.core.stats.reworkRatePercent)}%</b></div></div><h3>Physical batch cycles</h3><div className="ubatch-timeline">{visibleCycles.map(cycle=>{const left=cycle.startSeconds/maxTimeline*100;const width=Math.max(.3,(cycle.finishSeconds-cycle.startSeconds)/maxTimeline*100);return <div className="ubatch-cycle" key={cycle.batchId}><span>{cycle.blockTitle} · n={cycle.jobIndexes.length}</span><div className="ubatch-track"><i style={{left:`${left}%`,width:`${width}%`}}/></div><span>{roundSmart(cycle.fillPercent)}%</span></div>;})}</div></>}

      <div className="ubatch-risk"><h2>BatchRisk · Universal Monte Carlo</h2>{monteCarlo.errors.map((error,index)=><div className="ubatch-error" key={index}>{error}</div>)}{monteCarlo.ok&&<div className="ubatch-kpis"><div className="ubatch-kpi"><span>Makespan P95</span><b>{formatDuration(monteCarlo.makespanSeconds.p95)}</b></div><div className="ubatch-kpi"><span>Throughput P50</span><b>{roundSmart(monteCarlo.throughputPerHour.p50)}/ч</b></div><div className="ubatch-kpi"><span>Fill P50</span><b>{roundSmart(monteCarlo.averageBatchFillPercent.p50)}%</b></div><div className="ubatch-kpi"><span>Fill P05 proxy</span><b>{roundSmart(monteCarlo.averageBatchFillPercent.min)}%</b></div><div className="ubatch-kpi"><span>Partial rate P95</span><b>{roundSmart(monteCarlo.partialBatchRatePercent.p95)}%</b></div><div className="ubatch-kpi"><span>Wait P95</span><b>{formatDuration(monteCarlo.p95WaitSeconds.p95)}</b></div><div className="ubatch-kpi"><span>Changeover P95</span><b>{formatDuration(monteCarlo.changeoverSeconds.p95)}</b></div><div className="ubatch-kpi"><span>Rework P95</span><b>{roundSmart(monteCarlo.reworkRatePercent.p95)}%</b></div></div>}<p className="ubatch-note">Risk snapshot использует profile на момент последнего Run BatchRisk. Изменения batch policy сразу видны в deterministic result, но Monte Carlo пересчитывается только по кнопке.</p></div></section></main>
    </div>
  );
}
