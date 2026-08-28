import React, { useMemo, useState } from 'react';
import { ProcessScenarioProfile, cloneProcessScenario } from './processDomain';
import { formatDuration, roundSmart } from './processMath';
import { parseProcessScenario, serializeProcessScenario } from './processProfileIO';
import {
  PROCESS_SIMULATION_PROFILE_STORAGE_KEY,
  createBlankProcessSimulationScenario,
  evaluateProcessSimulationReadiness,
} from './processSimulationProfile';
import {
  planUniversalResourceCapacity,
  runUniversalProcessMonteCarlo,
  setSymmetricBlockUncertainty,
  uncertaintyPercent,
} from './processUniversalRisk';

interface RiskRunSettings {
  iterations: number;
  seed: number;
  slaMakespanSeconds: number | null;
}

function persist(profile: ProcessScenarioProfile): void {
  try {
    localStorage.setItem(PROCESS_SIMULATION_PROFILE_STORAGE_KEY, serializeProcessScenario(profile));
  } catch {
    // Risk analysis remains usable without persistence.
  }
}

function loadSimulationProfile(): ProcessScenarioProfile {
  try {
    const raw = localStorage.getItem(PROCESS_SIMULATION_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = parseProcessScenario(raw);
      if (parsed.ok && parsed.value) return parsed.value;
    }
  } catch {
    // Fall back to a valid generic scenario.
  }
  return createBlankProcessSimulationScenario();
}

function defaultRiskProfile(profile: ProcessScenarioProfile): ProcessScenarioProfile {
  const next = cloneProcessScenario(profile);
  next.uncertaintyByBlock = { ...(next.uncertaintyByBlock || {}) };
  for (const block of next.blocks) {
    if (!next.uncertaintyByBlock[block.id]) {
      next.uncertaintyByBlock[block.id] = block.automation === 'wait'
        ? { kind: 'fixed' }
        : { kind: 'triangular', minFactor: 0.9, modeFactor: 1, maxFactor: 1.1 };
    }
  }
  return next;
}

export default function UniversalProcessRiskApp() {
  const initial = useMemo(() => defaultRiskProfile(loadSimulationProfile()), []);
  const [profile, setProfile] = useState<ProcessScenarioProfile>(initial);
  const [runProfile, setRunProfile] = useState<ProcessScenarioProfile>(() => cloneProcessScenario(initial));
  const [iterations, setIterations] = useState(400);
  const [seed, setSeed] = useState(20260828);
  const [slaMinutes, setSlaMinutes] = useState<number | ''>('');
  const [runSettings, setRunSettings] = useState<RiskRunSettings>({ iterations: 400, seed: 20260828, slaMakespanSeconds: null });
  const [notice, setNotice] = useState('');

  const readiness = useMemo(() => evaluateProcessSimulationReadiness(profile), [profile]);
  const monteCarlo = useMemo(() => runUniversalProcessMonteCarlo(runProfile, runSettings), [runProfile, runSettings]);
  const capacityPlan = useMemo(() => planUniversalResourceCapacity(runProfile, runSettings.seed), [runProfile, runSettings.seed]);

  const updateUncertainty = (blockId: string, percent: number) => {
    const next = setSymmetricBlockUncertainty(profile, blockId, percent);
    setProfile(next);
    persist(next);
  };

  const reload = () => {
    const next = defaultRiskProfile(loadSimulationProfile());
    setProfile(next);
    setRunProfile(cloneProcessScenario(next));
    setNotice('Universal Simulation profile перечитан');
  };

  const run = () => {
    const settings: RiskRunSettings = {
      iterations: Math.max(1, Math.min(5000, Math.floor(iterations || 1))),
      seed: Math.floor(seed || 1),
      slaMakespanSeconds: slaMinutes === '' ? null : Math.max(0, Number(slaMinutes)) * 60,
    };
    persist(profile);
    setRunProfile(cloneProcessScenario(profile));
    setRunSettings(settings);
    setNotice(`Monte Carlo snapshot: ${settings.iterations} iterations · seed ${settings.seed}`);
  };

  const best = capacityPlan.bestScenario;

  return (
    <div className="urisk-app">
      <style>{`
        *{box-sizing:border-box}body{margin:0}.urisk-app{min-height:100vh;background:#f7f8fb;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.urisk-top{position:sticky;top:0;z-index:30;background:rgba(247,248,251,.95);backdrop-filter:blur(14px);border-bottom:1px solid #e2e8f0}.urisk-topin{max-width:1800px;margin:auto;padding:12px 18px;display:flex;align-items:center;gap:10px}.urisk-mark{width:40px;height:40px;border-radius:12px;background:#111827;color:white;display:grid;place-items:center;font-weight:900}.urisk-brand b{display:block;font-size:14px}.urisk-brand span{font-size:10px;color:#64748b}.urisk-nav{margin-left:auto;display:flex;gap:6px}.urisk-btn,.urisk-input{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 10px;font:inherit;font-size:10px;color:#0f172a}.urisk-btn{font-weight:800;cursor:pointer}.urisk-btn.primary{background:#111827;color:#fff;border-color:#111827}.urisk-hero,.urisk-controls,.urisk-grid{max-width:1800px;margin:auto}.urisk-hero{padding:24px 18px 10px}.urisk-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;font-weight:900}.urisk-hero h1{margin:5px 0 8px;font-size:clamp(30px,4vw,50px);letter-spacing:-.045em;line-height:1.03}.urisk-hero p{max-width:1100px;color:#475569;line-height:1.55;margin:0}.urisk-controls{display:flex;gap:8px;align-items:end;flex-wrap:wrap;padding:10px 18px 16px}.urisk-model{border:1px solid #e2e8f0;background:#fff;border-radius:9px;padding:8px 10px;font-size:10px;color:#475569}.urisk-field{display:flex;flex-direction:column;gap:4px}.urisk-field label{font-size:8px;text-transform:uppercase;color:#64748b;font-weight:900}.urisk-chip{border:1px solid #dbe3ee;border-radius:999px;padding:5px 8px;font-size:8px;background:#fff}.urisk-chip.ok{color:#166534;background:#f0fdf4;border-color:#bbf7d0}.urisk-chip.warn{color:#92400e;background:#fffbeb;border-color:#fde68a}.urisk-notice{max-width:1800px;margin:0 auto;padding:0 18px 10px;font-size:10px;color:#475569}.urisk-grid{padding:0 18px 40px;display:grid;grid-template-columns:minmax(350px,.78fr) minmax(580px,1.5fr);gap:14px}.urisk-panel{background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:13px;box-shadow:0 5px 16px rgba(15,23,42,.04)}.urisk-panel h2{font-size:14px;margin:0 0 9px}.urisk-panel h3{font-size:11px;margin:14px 0 7px}.urisk-block{display:grid;grid-template-columns:1fr 75px 20px;gap:6px;align-items:center;padding:7px 0;border-bottom:1px solid #eef2f7}.urisk-block b{font-size:10px}.urisk-block small{display:block;color:#64748b;font-size:8px;margin-top:2px}.urisk-block input{width:100%}.urisk-pct{font-size:9px;color:#64748b}.urisk-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.urisk-kpi{border:1px solid #e2e8f0;background:#f8fafc;border-radius:10px;padding:9px}.urisk-kpi span{display:block;font-size:8px;text-transform:uppercase;color:#64748b}.urisk-kpi b{display:block;margin-top:4px;font-size:14px}.urisk-error,.urisk-warning{border-radius:9px;padding:7px;font-size:9px;line-height:1.45;margin-top:6px}.urisk-error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b}.urisk-warning{background:#fffbeb;border:1px solid #fde68a;color:#92400e}.urisk-best{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;border-radius:10px;padding:9px;font-size:9px;line-height:1.5}.urisk-best b{font-size:12px}.urisk-table{width:100%;border-collapse:collapse;font-size:9px}.urisk-table th,.urisk-table td{text-align:left;padding:6px;border-bottom:1px solid #eef2f7}.urisk-table th{font-size:8px;text-transform:uppercase;color:#64748b}.urisk-note{font-size:9px;color:#64748b;line-height:1.5}@media(max-width:1050px){.urisk-grid{grid-template-columns:1fr}.urisk-kpis{grid-template-columns:repeat(2,1fr)}}
      `}</style>

      <header className="urisk-top"><div className="urisk-topin"><div className="urisk-mark">MC</div><div className="urisk-brand"><b>Universal Process Risk</b><span>same ProcessScenarioProfile · Monte Carlo · capacity what-if</span></div><div className="urisk-nav"><button className="urisk-btn" onClick={() => window.location.href='/?view=process-sim'}>Simulation</button><button className="urisk-btn" onClick={() => window.location.href='/'}>AutoTrace</button></div></div></header>

      <section className="urisk-hero"><div className="urisk-eyebrow">Universal stochastic analysis v2</div><h1>Risk-анализ того же цифрового двойника</h1><p>Monte Carlo больше не переключается на упрощённый legacy scheduler. Каждая итерация запускает тот же Universal Scheduler, поэтому учитываются ресурсы, партии, совместимость, переналадки, календари, MTBF/MTTR и rework.</p></section>

      <section className="urisk-controls"><div className="urisk-model"><b>{profile.name}</b> · jobs {profile.jobs.length} · resources {profile.resources.length}</div><span className={`urisk-chip ${readiness.simulationReady?'ok':'warn'}`}>{readiness.simulationReady?'simulation-ready':`${readiness.unresolvedTimeBlockIds.length} unresolved timings`}</span><button className="urisk-btn" onClick={reload}>↻ перечитать Simulation v2</button><div className="urisk-field"><label>Итераций</label><input className="urisk-input" type="number" min="1" max="5000" value={iterations} onChange={event=>setIterations(Math.max(1,Number(event.target.value)||1))}/></div><div className="urisk-field"><label>Seed</label><input className="urisk-input" type="number" value={seed} onChange={event=>setSeed(Number(event.target.value)||1)}/></div><div className="urisk-field"><label>SLA makespan, мин</label><input className="urisk-input" type="number" min="0" placeholder="не задан" value={slaMinutes} onChange={event=>setSlaMinutes(event.target.value===''?'':Number(event.target.value))}/></div><button className="urisk-btn primary" onClick={run}>Запустить snapshot</button></section>
      {notice&&<div className="urisk-notice">{notice}</div>}

      <main className="urisk-grid"><section className="urisk-panel"><h2>Uncertainty in ProcessScenarioProfile</h2><p className="urisk-note">Значение сохраняется прямо в `profile.uncertaintyByBlock`. ±10% означает triangular [0.90, 1.00, 1.10]. Анализ запускается по snapshot после кнопки «Запустить», поэтому ввод не пересчитывает сотни итераций на каждый символ.</p>{profile.blocks.map(block=><div className="urisk-block" key={block.id}><div><b>{block.title}</b><small>{block.automation} · {block.time.formula?`ƒ ${block.time.formula}`:`${block.time.value??'?'} ${block.time.unit}`}</small></div><input className="urisk-input" type="number" min="0" max="200" value={roundSmart(uncertaintyPercent(profile.uncertaintyByBlock?.[block.id]))} onChange={event=>updateUncertainty(block.id,Math.max(0,Number(event.target.value)||0))}/><span className="urisk-pct">±%</span></div>)}</section>

      <section className="urisk-panel"><h2>Universal Monte Carlo result</h2>{monteCarlo.errors.map((error,index)=><div className="urisk-error" key={index}>{error}</div>)}{monteCarlo.warnings.slice(0,6).map((warning,index)=><div className="urisk-warning" key={index}>{warning}</div>)}{monteCarlo.ok&&<><div className="urisk-kpis"><div className="urisk-kpi"><span>Makespan P50</span><b>{formatDuration(monteCarlo.makespanSeconds.p50)}</b></div><div className="urisk-kpi"><span>Makespan P95</span><b>{formatDuration(monteCarlo.makespanSeconds.p95)}</b></div><div className="urisk-kpi"><span>Cycle P95</span><b>{formatDuration(monteCarlo.p95CycleSeconds.p95)}</b></div><div className="urisk-kpi"><span>Wait P95</span><b>{formatDuration(monteCarlo.p95WaitSeconds.p95)}</b></div><div className="urisk-kpi"><span>Throughput P50</span><b>{roundSmart(monteCarlo.throughputPerHour.p50)}/ч</b></div><div className="urisk-kpi"><span>Changeover P95</span><b>{formatDuration(monteCarlo.changeoverSeconds.p95)}</b></div><div className="urisk-kpi"><span>Rework P95</span><b>{roundSmart(monteCarlo.reworkRatePercent.p95)}%</b></div><div className="urisk-kpi"><span>SLA confidence</span><b>{monteCarlo.slaProbabilityPercent==null?'—':`${roundSmart(monteCarlo.slaProbabilityPercent)}%`}</b></div></div><p className="urisk-note">Completed {monteCarlo.completedIterations}/{monteCarlo.requestedIterations} iterations.</p></>}

      <h3>Capacity planner · +1 resource unit</h3>{best&&<div className="urisk-best">Лучший what-if: <b>{best.resourceName} {best.baselineCapacity}→{best.candidateCapacity}</b><br/>makespan −{roundSmart(best.makespanReductionPercent)}% · throughput +{roundSmart(best.throughputGainPercent)}% · wait −{roundSmart(best.waitReductionPercent)}%</div>}{capacityPlan.errors.map((error,index)=><div className="urisk-error" key={index}>{error}</div>)}<table className="urisk-table"><thead><tr><th>Resource</th><th>Capacity</th><th>Makespan Δ</th><th>Throughput Δ</th><th>Wait Δ</th><th>Utilization</th><th>Score</th></tr></thead><tbody>{capacityPlan.scenarios.map(item=><tr key={item.resourceId}><td>{item.resourceName}</td><td>{item.baselineCapacity}→{item.candidateCapacity}</td><td>−{roundSmart(item.makespanReductionPercent)}%</td><td>+{roundSmart(item.throughputGainPercent)}%</td><td>−{roundSmart(item.waitReductionPercent)}%</td><td>{roundSmart(item.baselineUtilizationPercent)}→{roundSmart(item.candidateUtilizationPercent)}%</td><td>{roundSmart(item.score)}</td></tr>)}</tbody></table></section></main>
    </div>
  );
}
