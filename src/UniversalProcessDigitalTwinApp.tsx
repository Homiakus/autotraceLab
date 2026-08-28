import React, { useMemo, useState } from 'react';
import { ProcessScenarioProfile } from './processDomain';
import { formatDuration, roundSmart } from './processMath';
import { parseProcessScenario, serializeProcessScenario } from './processProfileIO';
import {
  PROCESS_SIMULATION_PROFILE_STORAGE_KEY,
  createBlankProcessSimulationScenario,
  resizeSimulationJobs,
} from './processSimulationProfile';
import { simulateUniversalScenario } from './processUniversalCompiler';
import { setSymmetricBlockUncertainty, uncertaintyPercent } from './processUniversalRisk';
import {
  DailyResourceScheduleInput,
  evaluateDigitalTwinReadiness,
  retryPercent,
  setDailyResourceSchedule,
  setPeriodicJobPriority,
  setProcessArrival,
  setProcessRetry,
} from './processDigitalTwinProfile';

const HOUR = 3600;

function persist(profile: ProcessScenarioProfile): void {
  try {
    localStorage.setItem(PROCESS_SIMULATION_PROFILE_STORAGE_KEY, serializeProcessScenario(profile));
  } catch {
    // Continue in memory when storage is unavailable.
  }
}

function loadProfile(): ProcessScenarioProfile {
  try {
    const raw = localStorage.getItem(PROCESS_SIMULATION_PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = parseProcessScenario(raw);
      if (parsed.ok && parsed.value) return parsed.value;
    }
  } catch {
    // Fall through.
  }
  return createBlankProcessSimulationScenario();
}

function scheduleFromProfile(profile: ProcessScenarioProfile, resourceId: string): DailyResourceScheduleInput {
  const policy = profile.calendars?.[resourceId];
  const window = policy?.workingWindows?.[0];
  const downtime = policy?.plannedDowntime?.[0];
  return {
    shiftEnabled: Boolean(window),
    shiftStartHour: window ? window.startOffsetSeconds / HOUR : 8,
    shiftEndHour: window ? window.endOffsetSeconds / HOUR : 17,
    downtimeEnabled: Boolean(downtime),
    downtimeStartHour: downtime ? downtime.startSeconds / HOUR : 12,
    downtimeDurationHour: downtime ? (downtime.endSeconds - downtime.startSeconds) / HOUR : 1,
  };
}

export default function UniversalProcessDigitalTwinApp() {
  const initial = useMemo(loadProfile, []);
  const [profile, setProfile] = useState(initial);
  const [seed, setSeed] = useState(20260828);
  const [priorityEveryN, setPriorityEveryN] = useState(0);
  const [notice, setNotice] = useState('');

  const readiness = useMemo(() => evaluateDigitalTwinReadiness(profile), [profile]);
  const simulation = useMemo(() => simulateUniversalScenario(profile, seed), [profile, seed]);

  const commit = (next: ProcessScenarioProfile, message?: string) => {
    setProfile(next);
    persist(next);
    if (message) setNotice(message);
  };

  const arrivalKind = profile.arrivals?.kind || 'fixed';
  const arrivalSeconds = arrivalKind === 'poisson'
    ? profile.arrivals?.meanIntervalSeconds || 60
    : profile.arrivals?.intervalSeconds || 0;

  const applyPriorityPattern = () => {
    commit(setPeriodicJobPriority(profile, priorityEveryN, 100, 0), 'Priority pattern записан в jobs[]');
  };

  return (
    <div className="utwin-app">
      <style>{`
        *{box-sizing:border-box}body{margin:0}.utwin-app{min-height:100vh;background:#f6f8fb;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
        .utwin-top{position:sticky;top:0;z-index:30;background:rgba(246,248,251,.95);backdrop-filter:blur(14px);border-bottom:1px solid #e2e8f0}.utwin-topin,.utwin-main{max-width:1800px;margin:auto}.utwin-topin{padding:12px 18px;display:flex;align-items:center;gap:10px}.utwin-mark{width:42px;height:40px;border-radius:12px;background:#0f172a;color:#fff;display:grid;place-items:center;font-weight:900}.utwin-brand b{display:block;font-size:14px}.utwin-brand span{font-size:10px;color:#64748b}.utwin-nav{margin-left:auto;display:flex;gap:6px}
        .utwin-btn,.utwin-input,.utwin-select{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 10px;font:inherit;font-size:10px;color:#0f172a}.utwin-btn{font-weight:800;cursor:pointer}.utwin-btn.primary{background:#0f172a;color:#fff;border-color:#0f172a}.utwin-main{padding:24px 18px 50px}.utwin-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#64748b;font-weight:900}.utwin-hero h1{font-size:clamp(30px,4vw,50px);letter-spacing:-.045em;line-height:1.03;margin:6px 0 8px}.utwin-hero p{max-width:1120px;color:#475569;line-height:1.55;margin:0}
        .utwin-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:end;margin-top:16px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:14px}.utwin-field{display:flex;flex-direction:column;gap:4px}.utwin-field label{font-size:8px;text-transform:uppercase;color:#64748b;font-weight:900}.utwin-chip{border:1px solid #e2e8f0;border-radius:999px;padding:5px 8px;font-size:8px;color:#475569}.utwin-chip.ok{background:#f0fdf4;border-color:#bbf7d0;color:#166534}.utwin-notice{font-size:10px;color:#475569;margin-top:8px}
        .utwin-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:14px}.utwin-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px}.utwin-kpi span{display:block;font-size:8px;text-transform:uppercase;color:#64748b}.utwin-kpi b{display:block;font-size:17px;margin-top:4px}.utwin-grid{display:grid;grid-template-columns:minmax(370px,.9fr) minmax(600px,1.45fr);gap:14px;margin-top:14px}.utwin-panel{background:#fff;border:1px solid #e2e8f0;border-radius:15px;padding:13px}.utwin-panel h2{font-size:14px;margin:0 0 9px}.utwin-panel h3{font-size:11px;margin:14px 0 7px}.utwin-stage,.utwin-resource{border:1px solid #e2e8f0;border-radius:10px;padding:9px;margin:7px 0}.utwin-stage-head,.utwin-resource-head{display:flex;align-items:center;gap:7px}.utwin-stage-head b,.utwin-resource-head b{font-size:10px}.utwin-stage-head small,.utwin-resource-head small{margin-left:auto;font-size:8px;color:#64748b}.utwin-row3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}.utwin-row3 label{display:flex;flex-direction:column;gap:3px;font-size:8px;color:#64748b;font-weight:800}.utwin-check{display:flex!important;flex-direction:row!important;align-items:center;gap:5px!important}.utwin-check input{width:auto}.utwin-table{width:100%;border-collapse:collapse;font-size:9px}.utwin-table th,.utwin-table td{text-align:left;padding:6px;border-bottom:1px solid #eef2f7}.utwin-table th{font-size:8px;text-transform:uppercase;color:#64748b}.utwin-error,.utwin-warning{padding:7px;border-radius:9px;font-size:9px;line-height:1.45;margin-top:6px}.utwin-error{border:1px solid #fecaca;background:#fef2f2;color:#991b1b}.utwin-warning{border:1px solid #fde68a;background:#fffbeb;color:#92400e}@media(max-width:1050px){.utwin-grid{grid-template-columns:1fr}.utwin-row3{grid-template-columns:1fr 1fr}}
      `}</style>

      <header className="utwin-top">
        <div className="utwin-topin">
          <div className="utwin-mark">DT</div>
          <div className="utwin-brand"><b>Universal Process Digital Twin</b><span>arrivals · uncertainty · retry · priority · calendars · all policies</span></div>
          <div className="utwin-nav">
            <button className="utwin-btn" onClick={() => { window.location.href = '/?view=process-sim'; }}>Simulation</button>
            <button className="utwin-btn" onClick={() => { window.location.href = '/?view=process-risk'; }}>Risk</button>
            <button className="utwin-btn" onClick={() => { window.location.href = '/'; }}>AutoTrace</button>
          </div>
        </div>
      </header>

      <main className="utwin-main">
        <section className="utwin-hero">
          <div className="utwin-eyebrow">Digital Twin v2 · one ProcessScenarioProfile</div>
          <h1>Стохастический двойник больше не отдельная модель</h1>
          <p>Все настройки записываются в тот же profile, который используют Math, Simulation, Risk и Batch. Universal Scheduler одновременно учитывает batch compatibility, changeovers, arrivals, uncertainty, retry, priorities, calendars и failures.</p>
        </section>

        <section className="utwin-controls">
          <span className={`utwin-chip ${readiness.ready ? 'ok' : ''}`}>{readiness.ready ? 'profile ready' : 'profile incomplete'}</span>
          <span className="utwin-chip">retry {readiness.retryPolicies}</span>
          <span className="utwin-chip">calendars {readiness.calendarPolicies}</span>
          <span className="utwin-chip">priority jobs {readiness.priorityJobs}</span>
          <div className="utwin-field"><label>Jobs</label><input className="utwin-input" type="number" min="1" value={profile.jobs.length} onChange={(event) => commit(resizeSimulationJobs(profile, Math.max(1, Number(event.target.value) || 1)))} /></div>
          <div className="utwin-field"><label>Seed</label><input className="utwin-input" type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 1)} /></div>
          <div className="utwin-field"><label>Arrival</label><select className="utwin-select" value={arrivalKind} onChange={(event) => commit(setProcessArrival(profile, event.target.value as 'fixed' | 'poisson', arrivalSeconds))}><option value="fixed">Fixed</option><option value="poisson">Poisson</option></select></div>
          <div className="utwin-field"><label>Arrival seconds</label><input className="utwin-input" type="number" min="0" value={arrivalSeconds} onChange={(event) => commit(setProcessArrival(profile, arrivalKind, Number(event.target.value)))} /></div>
          <div className="utwin-field"><label>Expedite every N</label><input className="utwin-input" type="number" min="0" value={priorityEveryN} onChange={(event) => setPriorityEveryN(Math.max(0, Number(event.target.value) || 0))} /></div>
          <button className="utwin-btn" onClick={applyPriorityPattern}>Apply priority</button>
        </section>
        {notice && <div className="utwin-notice">{notice}</div>}

        {simulation.ok && (
          <section className="utwin-kpis">
            <div className="utwin-kpi"><span>Makespan</span><b>{formatDuration(simulation.stats.makespanSeconds)}</b></div>
            <div className="utwin-kpi"><span>Throughput</span><b>{simulation.stats.throughputPerHour == null ? '—' : `${roundSmart(simulation.stats.throughputPerHour)}/ч`}</b></div>
            <div className="utwin-kpi"><span>P95 cycle</span><b>{formatDuration(simulation.stats.p95CycleSeconds)}</b></div>
            <div className="utwin-kpi"><span>P95 wait</span><b>{formatDuration(simulation.stats.p95WaitSeconds)}</b></div>
            <div className="utwin-kpi"><span>Rework</span><b>{roundSmart(simulation.core.stats.reworkRatePercent)}%</b></div>
            <div className="utwin-kpi"><span>Batch fill</span><b>{roundSmart(simulation.stats.averageBatchFillPercent)}%</b></div>
            <div className="utwin-kpi"><span>Changeover</span><b>{formatDuration(simulation.policyStats.totalChangeoverSeconds)}</b></div>
            <div className="utwin-kpi"><span>Priority advantage</span><b>{simulation.stats.priorityAdvantagePercent == null ? '—' : `${roundSmart(simulation.stats.priorityAdvantagePercent)}%`}</b></div>
          </section>
        )}

        <div className="utwin-grid">
          <section className="utwin-panel">
            <h2>Operation stochastic policies</h2>
            {profile.blocks.map((block) => {
              const spread = uncertaintyPercent(profile.uncertaintyByBlock?.[block.id]);
              const retry = retryPercent(profile, block.id);
              const repeats = profile.retryByBlock?.[block.id]?.maxRepeats || 1;
              return (
                <div className="utwin-stage" key={block.id}>
                  <div className="utwin-stage-head"><b>{block.title}</b><small>{block.automation}</small></div>
                  <div className="utwin-row3">
                    <label>Duration ±%<input className="utwin-input" type="number" min="0" max="95" value={roundSmart(spread)} onChange={(event) => commit(setSymmetricBlockUncertainty(profile, block.id, Number(event.target.value)))} /></label>
                    <label>Retry %<input className="utwin-input" type="number" min="0" max="100" value={roundSmart(retry)} onChange={(event) => commit(setProcessRetry(profile, block.id, Number(event.target.value), repeats))} /></label>
                    <label>Max repeats<input className="utwin-input" type="number" min="0" value={repeats} onChange={(event) => commit(setProcessRetry(profile, block.id, retry, Number(event.target.value)))} /></label>
                  </div>
                </div>
              );
            })}

            <h2 style={{ marginTop: 16 }}>Resource calendars</h2>
            {profile.resources.map((resource) => {
              const schedule = scheduleFromProfile(profile, resource.id);
              const updateSchedule = (patch: Partial<DailyResourceScheduleInput>) => commit(setDailyResourceSchedule(profile, resource.id, { ...schedule, ...patch }));
              return (
                <div className="utwin-resource" key={resource.id}>
                  <div className="utwin-resource-head"><b>{resource.name}</b><small>capacity {resource.capacity}</small></div>
                  <div className="utwin-row3">
                    <label className="utwin-check"><input type="checkbox" checked={schedule.shiftEnabled} onChange={(event) => updateSchedule({ shiftEnabled: event.target.checked })} />Daily shift</label>
                    <label>Start hour<input className="utwin-input" type="number" min="0" max="24" value={schedule.shiftStartHour} onChange={(event) => updateSchedule({ shiftStartHour: Number(event.target.value) })} /></label>
                    <label>End hour<input className="utwin-input" type="number" min="0" max="24" value={schedule.shiftEndHour} onChange={(event) => updateSchedule({ shiftEndHour: Number(event.target.value) })} /></label>
                    <label className="utwin-check"><input type="checkbox" checked={schedule.downtimeEnabled} onChange={(event) => updateSchedule({ downtimeEnabled: event.target.checked })} />Planned downtime</label>
                    <label>Downtime start<input className="utwin-input" type="number" min="0" value={schedule.downtimeStartHour} onChange={(event) => updateSchedule({ downtimeStartHour: Number(event.target.value) })} /></label>
                    <label>Duration h<input className="utwin-input" type="number" min="0" value={schedule.downtimeDurationHour} onChange={(event) => updateSchedule({ downtimeDurationHour: Number(event.target.value) })} /></label>
                  </div>
                </div>
              );
            })}
          </section>

          <section className="utwin-panel">
            <h2>Universal Scheduler result</h2>
            {simulation.errors.map((error, index) => <div className="utwin-error" key={index}>{error}</div>)}
            {simulation.warnings.slice(0, 6).map((warning, index) => <div className="utwin-warning" key={index}>{warning}</div>)}
            {simulation.ok && (
              <>
                <h3>Resources</h3>
                <table className="utwin-table"><thead><tr><th>Resource</th><th>Utilization</th><th>Availability</th><th>Peak</th><th>Failure windows</th></tr></thead><tbody>{simulation.core.resourceStats.map((resource) => <tr key={resource.id}><td>{resource.name}</td><td>{roundSmart(resource.utilizationPercent)}%</td><td>{roundSmart(resource.availabilityPercent)}%</td><td>{resource.peakUnits}/{resource.capacity}</td><td>{resource.generatedFailureWindows}</td></tr>)}</tbody></table>
                <h3>Operations</h3>
                <table className="utwin-table"><thead><tr><th>Operation</th><th>Runs</th><th>Rework</th><th>Avg wait</th><th>P95 wait</th><th>Batch cycles</th></tr></thead><tbody>{simulation.core.blockStats.map((block) => <tr key={block.blockId}><td>{block.blockTitle}</td><td>{block.runs}</td><td>{block.reworkRuns}</td><td>{formatDuration(block.averageWaitSeconds)}</td><td>{formatDuration(block.p95WaitSeconds)}</td><td>{block.batchCycles}</td></tr>)}</tbody></table>
                <h3>First 80 task runs</h3>
                <table className="utwin-table"><thead><tr><th>Job</th><th>Operation</th><th>Attempt</th><th>Priority</th><th>Start</th><th>Finish</th><th>Wait</th></tr></thead><tbody>{simulation.core.runs.slice(0, 80).map((run) => <tr key={run.taskId}><td>{profile.jobs[run.jobIndex]?.id || run.jobIndex}</td><td>{run.blockTitle}</td><td>{run.attempt}</td><td>{run.priority}</td><td>{formatDuration(run.startSeconds)}</td><td>{formatDuration(run.finishSeconds)}</td><td>{formatDuration(run.waitSeconds)}</td></tr>)}</tbody></table>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
