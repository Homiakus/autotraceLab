import React, { useMemo, useState } from 'react';
import { ProcessScenarioProfile } from './processDomain';
import { formatDuration, roundSmart } from './processMath';
import { parseProcessScenario, serializeProcessScenario } from './processProfileIO';
import { PROCESS_SIMULATION_PROFILE_STORAGE_KEY, createBlankProcessSimulationScenario } from './processSimulationProfile';
import { optimizeUniversalBatchPolicy, UniversalOptimizerWeights } from './processUniversalOptimizer';

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

function persist(profile: ProcessScenarioProfile): void {
  try { localStorage.setItem(PROCESS_SIMULATION_PROFILE_STORAGE_KEY, serializeProcessScenario(profile)); } catch { /* in-memory only */ }
}

export default function UniversalProcessOptimizerApp() {
  const [profile, setProfile] = useState<ProcessScenarioProfile>(() => loadProfile());
  const [seed, setSeed] = useState(20260828);
  const [slaMinutes, setSlaMinutes] = useState(60);
  const [maxScenarios, setMaxScenarios] = useState(500);
  const [weights, setWeights] = useState<UniversalOptimizerWeights>({ throughput: 20, p95Cycle: 20, averageWait: 15, batchFill: 20, partialCycles: 10, sla: 15 });
  const [notice, setNotice] = useState('');

  const result = useMemo(() => optimizeUniversalBatchPolicy(profile, {
    seed,
    searches: (profile.batchPolicies || []).map(config => ({
      blockId: config.blockId,
      minBatchValues: [1, Math.ceil(config.batchCapacity / 2), config.batchCapacity],
      maxWaitValuesSeconds: [0, 60, 300, 600, 1200],
    })),
    maxScenarios,
    slaP95CycleSeconds: slaMinutes > 0 ? slaMinutes * 60 : null,
    weights,
  }), [profile, seed, slaMinutes, maxScenarios, weights]);

  const saveBest = () => {
    if (!result.best) return;
    setProfile(result.best.profile);
    persist(result.best.profile);
    setNotice('Лучший сценарий записан в ProcessScenarioProfile.batchPolicies');
  };

  const weightField = (key: keyof UniversalOptimizerWeights, label: string) => (
    <label className="uopt-field">{label}<input type="number" min="0" value={weights[key]} onChange={event => setWeights(current => ({ ...current, [key]: Math.max(0, Number(event.target.value) || 0) }))} /></label>
  );

  return <div className="uopt-app">
    <style>{`
      *{box-sizing:border-box}body{margin:0}.uopt-app{min-height:100vh;background:#f7f8fb;color:#0f172a;font-family:Inter,system-ui,sans-serif}.uopt-top{border-bottom:1px solid #e2e8f0;background:#fff}.uopt-topin,.uopt-main{max-width:1800px;margin:auto}.uopt-topin{padding:12px 18px;display:flex;align-items:center;gap:10px}.uopt-mark{width:44px;height:40px;border-radius:12px;background:#0f172a;color:white;display:grid;place-items:center;font-size:10px;font-weight:900}.uopt-brand b{display:block;font-size:14px}.uopt-brand span{font-size:10px;color:#64748b}.uopt-nav{margin-left:auto;display:flex;gap:6px}.uopt-btn{border:1px solid #cbd5e1;background:white;border-radius:9px;padding:8px 10px;font:inherit;font-size:10px;font-weight:800;cursor:pointer}.uopt-btn.primary{background:#0f172a;color:white;border-color:#0f172a}.uopt-main{padding:24px 18px 50px}.uopt-hero h1{font-size:clamp(30px,4vw,50px);letter-spacing:-.045em;margin:5px 0 8px}.uopt-hero p{max-width:1100px;color:#475569;line-height:1.55}.uopt-controls{display:flex;flex-wrap:wrap;gap:7px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:14px}.uopt-field{display:flex;flex-direction:column;gap:3px;font-size:8px;text-transform:uppercase;color:#64748b;font-weight:900}.uopt-field input{width:105px;border:1px solid #cbd5e1;border-radius:8px;padding:7px;font:inherit;font-size:10px}.uopt-grid{display:grid;grid-template-columns:minmax(390px,.8fr) minmax(650px,1.4fr);gap:14px;margin-top:14px}.uopt-panel{background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:13px}.uopt-panel h2{font-size:14px;margin:0 0 10px}.uopt-config{border:1px solid #e2e8f0;border-radius:10px;padding:8px;margin:6px 0;font-size:9px}.uopt-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px}.uopt-kpi{border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:9px}.uopt-kpi span{display:block;font-size:7px;text-transform:uppercase;color:#64748b}.uopt-kpi b{display:block;font-size:15px;margin-top:4px}.uopt-table{width:100%;border-collapse:collapse;font-size:9px;margin-top:10px}.uopt-table th,.uopt-table td{padding:6px;border-bottom:1px solid #eef2f7;text-align:left}.uopt-table th{font-size:7px;text-transform:uppercase;color:#64748b}.uopt-note{font-size:9px;color:#64748b;line-height:1.5}.uopt-warn{padding:8px;border-radius:8px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:9px;margin:5px 0}.uopt-good{color:#047857;font-weight:900}@media(max-width:1050px){.uopt-grid{grid-template-columns:1fr}.uopt-kpis{grid-template-columns:repeat(2,1fr)}}
    `}</style>
    <header className="uopt-top"><div className="uopt-topin"><div className="uopt-mark">OPT</div><div className="uopt-brand"><b>Universal Process Optimizer</b><span>batch-policy search · full universal scheduler semantics</span></div><div className="uopt-nav"><button className="uopt-btn" onClick={()=>window.location.href='/?view=process-unified-twin'}>Twin</button><button className="uopt-btn" onClick={()=>window.location.href='/?view=process-batch'}>Batch</button></div></div></header>
    <main className="uopt-main"><section className="uopt-hero"><h1>Оптимизация того же цифрового двойника</h1><p>Каждый кандидат — clone исходного ProcessScenarioProfile с изменёнными только minBatch/maxWait. Compatibility, changeovers, calendars, failures, retry, priority, uncertainty и objectives сохраняются и исполняются Universal Scheduler.</p></section>
    <section className="uopt-controls"><label className="uopt-field">Seed<input type="number" value={seed} onChange={e=>setSeed(Number(e.target.value)||1)}/></label><label className="uopt-field">SLA P95, min<input type="number" min="0" value={slaMinutes} onChange={e=>setSlaMinutes(Math.max(0,Number(e.target.value)||0))}/></label><label className="uopt-field">Max scenarios<input type="number" min="1" max="5000" value={maxScenarios} onChange={e=>setMaxScenarios(Math.max(1,Math.min(5000,Number(e.target.value)||1)))}/></label>{weightField('throughput','W throughput')}{weightField('p95Cycle','W P95')}{weightField('averageWait','W wait')}{weightField('batchFill','W fill')}{weightField('partialCycles','W partial')}{weightField('sla','W SLA')}</section>
    <div className="uopt-grid"><section className="uopt-panel"><h2>Search space</h2><p className="uopt-note">Profile: <b>{profile.name}</b>. Для каждого batch block: minBatch = 1 / 50% / capacity; maxWait = 0 / 1 / 5 / 10 / 20 min. Кандидаты сохраняют все остальные policies.</p>{(profile.batchPolicies||[]).map(config=><div className="uopt-config" key={config.blockId}><b>{profile.blocks.find(block=>block.id===config.blockId)?.title||config.blockId}</b><div>capacity {config.batchCapacity} · current min {config.minBatchSize} · current wait {formatDuration(config.maxWaitSeconds)}</div></div>)}{result.warnings.map((warning,index)=><div className="uopt-warn" key={index}>{warning}</div>)}<p className="uopt-note">Generated {result.generatedScenarios} · evaluated {result.evaluatedScenarios} · Pareto {result.pareto.length}</p>{result.best&&<button className="uopt-btn primary" onClick={saveBest}>Apply best to profile</button>}{notice&&<p className="uopt-note">{notice}</p>}</section>
    <section className="uopt-panel"><h2>Best universal scenario</h2>{result.best?<><div className="uopt-kpis"><div className="uopt-kpi"><span>Score</span><b>{roundSmart(result.best.score*100)}</b></div><div className="uopt-kpi"><span>Objective</span><b>{roundSmart(result.best.objectiveScore*100)}%</b></div><div className="uopt-kpi"><span>P95 cycle</span><b>{formatDuration(result.best.simulation.stats.p95CycleSeconds)}</b></div><div className="uopt-kpi"><span>Throughput</span><b>{roundSmart(result.best.simulation.stats.throughputPerHour||0)}/ч</b></div><div className="uopt-kpi"><span>Batch fill</span><b>{roundSmart(result.best.simulation.stats.averageBatchFillPercent)}%</b></div></div><p className={result.best.slaMet===true?'uopt-good':'uopt-note'}>SLA: {result.best.slaMet==null?'not set':result.best.slaMet?'PASS':'FAIL'} · changeover {formatDuration(result.best.simulation.policyStats.totalChangeoverSeconds)} · rework {roundSmart(result.best.simulation.core.stats.reworkRatePercent)}%</p>{result.best.configs.map(config=><div className="uopt-config" key={config.blockId}>{config.blockId}: minBatch <b>{config.minBatchSize}</b> · maxWait <b>{formatDuration(config.maxWaitSeconds)}</b></div>)}<table className="uopt-table"><thead><tr><th>#</th><th>Score</th><th>Objective</th><th>P95</th><th>Throughput</th><th>Wait</th><th>Fill</th><th>Pareto</th></tr></thead><tbody>{result.scenarios.slice(0,20).map(item=><tr key={item.rank}><td>{item.rank}</td><td>{roundSmart(item.score*100)}</td><td>{roundSmart(item.objectiveScore*100)}%</td><td>{formatDuration(item.simulation.stats.p95CycleSeconds)}</td><td>{roundSmart(item.simulation.stats.throughputPerHour||0)}/ч</td><td>{formatDuration(item.simulation.stats.averageWaitSeconds)}</td><td>{roundSmart(item.simulation.stats.averageBatchFillPercent)}%</td><td>{item.pareto?'●':'—'}</td></tr>)}</tbody></table></>:<div className="uopt-warn">{result.errors.join(' · ')}</div>}</section></div>
    </main>
  </div>;
}
