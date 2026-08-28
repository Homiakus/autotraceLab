import React, { useMemo, useState } from 'react';
import { formatDuration, roundSmart } from './processMath';
import { cloneProcessScenario, ProcessScenarioProfile } from './processDomain';
import { orderJobsByChangeover, partitionCompatibleJobs } from './processCompatibility';
import { simulateUniversalScenario } from './processUniversalCompiler';
import { scoreUniversalScenario } from './processUniversalObjectives';
import { PROCESS_PROFILE_CATALOG } from './processProfiles';

function exportProfile(profile: ProcessScenarioProfile) {
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${profile.id}.process.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function UniversalProcessLabApp() {
  const [profileId, setProfileId] = useState(PROCESS_PROFILE_CATALOG[0].id);
  const profile = useMemo(
    () => cloneProcessScenario(PROCESS_PROFILE_CATALOG.find(item => item.id === profileId) || PROCESS_PROFILE_CATALOG[0]),
    [profileId],
  );
  const result = useMemo(() => simulateUniversalScenario(profile), [profile]);
  const score = useMemo(() => scoreUniversalScenario(result, profile.objectives || []), [result, profile.objectives]);

  const compatibilityPreview = useMemo(() => {
    const batch = profile.batchPolicies?.[0];
    if (!batch || !profile.compatibility?.length) return null;
    return {
      blockId: batch.blockId,
      groups: partitionCompatibleJobs(profile.jobs, batch.blockId, profile.compatibility, batch.batchCapacity),
    };
  }, [profile]);

  const changeoverPreview = useMemo(() => {
    const policy = profile.changeovers?.[0];
    if (!policy) return null;
    return { policy, sequence: orderJobsByChangeover(profile.jobs, policy) };
  }, [profile]);

  return (
    <div className="upl-app">
      <style>{`
        *{box-sizing:border-box}body{margin:0}.upl-app{min-height:100vh;background:#f6f8fb;color:#0f172a;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.upl-top{position:sticky;top:0;z-index:20;background:rgba(246,248,251,.94);backdrop-filter:blur(14px);border-bottom:1px solid #e2e8f0}.upl-topin{max-width:1760px;margin:auto;padding:13px 18px;display:flex;align-items:center;gap:10px}.upl-mark{width:40px;height:40px;border-radius:12px;background:#0f172a;color:#fff;display:grid;place-items:center;font-weight:900}.upl-brand b{display:block;font-size:14px}.upl-brand span{font-size:10px;color:#64748b}.upl-btn{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 10px;font:inherit;font-size:10px;font-weight:800;cursor:pointer}.upl-nav{margin-left:auto;display:flex;gap:6px}.upl-main{max-width:1760px;margin:auto;padding:24px 18px 56px}.upl-hero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:20px;align-items:end}.upl-eyebrow{text-transform:uppercase;letter-spacing:.12em;color:#64748b;font-size:9px;font-weight:900}.upl-hero h1{font-size:clamp(30px,4vw,52px);letter-spacing:-.045em;line-height:1.03;margin:7px 0}.upl-hero p{max-width:980px;color:#475569;line-height:1.55;margin:0}.upl-select{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:9px 10px;font:inherit;min-width:280px}.upl-grid{display:grid;grid-template-columns:minmax(350px,.8fr) minmax(560px,1.4fr);gap:14px;margin-top:18px}.upl-panel{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;box-shadow:0 5px 18px rgba(15,23,42,.04)}.upl-panel h2{font-size:14px;margin:0 0 10px}.upl-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.upl-kpi{border:1px solid #e2e8f0;border-radius:11px;padding:10px;background:#fafbfc}.upl-kpi span{display:block;color:#64748b;text-transform:uppercase;font-size:8px;letter-spacing:.06em;font-weight:900}.upl-kpi b{display:block;margin-top:4px;font-size:16px}.upl-list{display:grid;gap:6px}.upl-row{border:1px solid #e2e8f0;border-radius:10px;padding:8px;font-size:10px}.upl-row b{font-size:10px}.upl-row small{color:#64748b;margin-left:6px}.upl-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}.upl-tag{font-size:8px;background:#eef2ff;color:#3730a3;border-radius:999px;padding:3px 6px}.upl-table{width:100%;border-collapse:collapse;font-size:9px}.upl-table th,.upl-table td{text-align:left;padding:6px;border-bottom:1px solid #edf2f7}.upl-table th{font-size:8px;color:#64748b;text-transform:uppercase}.upl-note{font-size:9px;color:#64748b;line-height:1.5}.upl-ok{color:#166534}.upl-warn{color:#92400e}.upl-error{color:#991b1b}.upl-json{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:8px;max-height:280px;overflow:auto;white-space:pre-wrap;background:#0f172a;color:#e2e8f0;border-radius:10px;padding:10px}.upl-section{margin-top:12px}.upl-objective{display:grid;grid-template-columns:1fr auto auto;gap:8px;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:9px}@media(max-width:1000px){.upl-grid{grid-template-columns:1fr}.upl-kpis{grid-template-columns:repeat(2,1fr)}.upl-hero{grid-template-columns:1fr}.upl-select{width:100%}}
      `}</style>

      <header className="upl-top"><div className="upl-topin">
        <div className="upl-mark">UP</div>
        <div className="upl-brand"><b>Universal Process Lab</b><span>domain-neutral process profile · one simulation core</span></div>
        <div className="upl-nav"><button className="upl-btn" onClick={() => { window.location.href='/?view=process-unified-twin'; }}>Twin</button><button className="upl-btn" onClick={() => { window.location.href='/'; }}>Canvas</button></div>
      </div></header>

      <main className="upl-main">
        <section className="upl-hero">
          <div><div className="upl-eyebrow">AutoTrace · universal process contracts</div><h1>Один движок — разные предметные области</h1><p>Job, operation, resource, batch, calendar, retry, failure, compatibility, changeover и objective описываются нейтральными контрактами. Предметная область задаётся профилем, а не кодом ядра.</p></div>
          <div><select className="upl-select" value={profileId} onChange={event => setProfileId(event.target.value)}>{PROCESS_PROFILE_CATALOG.map(item => <option key={item.id} value={item.id}>{item.name} · {item.domain}</option>)}</select><button className="upl-btn" style={{ marginLeft: 6 }} onClick={() => exportProfile(profile)}>Экспорт JSON</button></div>
        </section>

        <div className="upl-grid">
          <section className="upl-panel">
            <h2>Профиль</h2>
            <div className="upl-row"><b>{profile.name}</b><small>{profile.domain || 'generic'}</small><div className="upl-note">{profile.description || 'Domain-neutral process profile'}</div></div>
            <div className="upl-section"><h2>Jobs</h2><div className="upl-list">{profile.jobs.slice(0, 12).map(job => <div className="upl-row" key={job.id}><b>{job.label || job.id}</b><small>priority {job.priority || 0}</small><div className="upl-tags">{Object.entries(job.attributes || {}).map(([key,value]) => <span className="upl-tag" key={key}>{key}={String(value)}</span>)}</div></div>)}</div></div>
            <div className="upl-section"><h2>Operations / resources</h2><table className="upl-table"><thead><tr><th>Operation</th><th>Depends</th><th>Resources</th></tr></thead><tbody>{profile.blocks.map(block => <tr key={block.id}><td>{block.title}</td><td>{block.dependencies.join(', ') || '—'}</td><td>{(profile.requirementsByBlock?.[block.id] || []).map(req => `${req.resourceId}×${req.units}`).join(', ') || '—'}</td></tr>)}</tbody></table></div>
          </section>

          <section className="upl-panel">
            <h2>Simulation result</h2>
            <div className="upl-kpis"><div className="upl-kpi"><span>Makespan</span><b>{formatDuration(result.stats.makespanSeconds)}</b></div><div className="upl-kpi"><span>P95 cycle</span><b>{formatDuration(result.stats.p95CycleSeconds)}</b></div><div className="upl-kpi"><span>Throughput</span><b>{result.stats.throughputPerHour == null ? '—' : `${roundSmart(result.stats.throughputPerHour)}/ч`}</b></div><div className="upl-kpi"><span>Objective score</span><b>{roundSmart(score.score * 100)}%</b></div><div className="upl-kpi"><span>Avg wait</span><b>{formatDuration(result.stats.averageWaitSeconds)}</b></div><div className="upl-kpi"><span>Batch fill</span><b>{roundSmart(result.stats.averageBatchFillPercent)}%</b></div><div className="upl-kpi"><span>Partial rate</span><b>{roundSmart(result.stats.partialBatchRate * 100)}%</b></div><div className="upl-kpi"><span>Status</span><b className={result.ok ? 'upl-ok' : 'upl-error'}>{result.ok ? 'OK' : 'ERROR'}</b></div></div>

            {profile.objectives?.length ? <div className="upl-section"><h2>Objectives</h2>{score.objectives.map(item => <div className="upl-objective" key={item.objectiveId}><span>{item.objectiveId} · {item.metric}</span><b>{item.rawValue == null ? '—' : roundSmart(item.rawValue)}</b><span>{roundSmart(item.weightedScore * 100)}%</span></div>)}</div> : null}

            {compatibilityPreview ? <div className="upl-section"><h2>Compatibility preview · {compatibilityPreview.blockId}</h2><div className="upl-note">Jobs разбиваются по декларативным правилам совместимости, а не по domain-specific коду.</div><div className="upl-list">{compatibilityPreview.groups.map((group,index) => <div className="upl-row" key={index}><b>Compatible group {index + 1}</b><small>{group.length} jobs</small><div className="upl-tags">{group.map(job => <span className="upl-tag" key={job.id}>{job.id}</span>)}</div></div>)}</div></div> : null}

            {changeoverPreview ? <div className="upl-section"><h2>Changeover preview · {changeoverPreview.policy.name || changeoverPreview.policy.id}</h2><table className="upl-table"><thead><tr><th>Job</th><th>Setup state</th><th>Changeover</th><th>Σ</th></tr></thead><tbody>{changeoverPreview.sequence.slice(0, 12).map(step => <tr key={step.jobId}><td>{step.jobId}</td><td>{step.setupState}</td><td>{formatDuration(step.changeoverSeconds)}</td><td>{formatDuration(step.cumulativeChangeoverSeconds)}</td></tr>)}</tbody></table></div> : null}

            {result.warnings.length ? <div className="upl-section"><h2>Compiler notes</h2>{result.warnings.map((warning,index) => <div className="upl-row upl-warn" key={index}>{warning}</div>)}</div> : null}
            <div className="upl-section"><h2>Portable profile JSON</h2><div className="upl-json">{JSON.stringify({ schemaVersion: profile.schemaVersion, id: profile.id, domain: profile.domain, jobs: profile.jobs.length, operations: profile.blocks.map(block => block.id), resources: profile.resources.map(resource => resource.id), compatibility: profile.compatibility, changeovers: profile.changeovers, objectives: profile.objectives }, null, 2)}</div></div>
          </section>
        </div>
      </main>
    </div>
  );
}
