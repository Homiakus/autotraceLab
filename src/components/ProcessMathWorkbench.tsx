import React, { useEffect, useMemo, useState } from 'react';
import {
  LBC_AUTOMATION_COLORS,
  LBC_AUTOMATION_LABELS,
  LBC_PLATFORMS,
  LbcPlatform,
} from '../data/lbcWorkflowData';
import {
  calculateProcessStats,
  evaluateFormula,
  extractInitialDuration,
  formatDuration,
  ProcessStageMathState,
  ProcessTimeUnit,
  resolveStageTimes,
  roundSmart,
} from '../processMath';

interface StageMathCardProps {
  key?: React.Key;
  stage: ProcessStageMathState;
  sourceTime: string;
  index: number;
  seconds?: number;
  error?: string;
  onChange: (next: ProcessStageMathState) => void;
}

const units: Array<{ value: ProcessTimeUnit; label: string }> = [
  { value: 'ms', label: 'мс' },
  { value: 's', label: 'с' },
  { value: 'min', label: 'мин' },
  { value: 'h', label: 'ч' },
];

function StageMathCard({ stage, sourceTime, index, seconds, error, onChange }: StageMathCardProps) {
  const color = LBC_AUTOMATION_COLORS[stage.automation as keyof typeof LBC_AUTOMATION_COLORS] || '#64748B';
  const automationLabel = LBC_AUTOMATION_LABELS[stage.automation as keyof typeof LBC_AUTOMATION_LABELS] || stage.automation;
  return (
    <article className="pm-stage" style={{ borderTopColor: color }}>
      <div className="pm-stage-head">
        <span className="pm-step">{String(index + 1).padStart(2, '0')}</span>
        <span className="pm-auto" style={{ color, borderColor: color }}>{automationLabel}</span>
      </div>
      <h3>{stage.title}</h3>
      <div className="pm-source-time">Источник: {sourceTime}</div>
      <label>Фиксированное время</label>
      <div className="pm-time-row">
        <input
          type="number"
          min="0"
          step="any"
          value={stage.time.value ?? ''}
          onChange={(e) => onChange({ ...stage, time: { ...stage.time, value: e.target.value === '' ? null : Number(e.target.value) } })}
          disabled={Boolean(stage.time.formula?.trim())}
        />
        <select
          value={stage.time.unit}
          onChange={(e) => onChange({ ...stage, time: { ...stage.time, unit: e.target.value as ProcessTimeUnit } })}
          disabled={Boolean(stage.time.formula?.trim())}
        >
          {units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
        </select>
      </div>
      <label>Формула времени, результат в секундах</label>
      <input
        className="pm-formula"
        value={stage.time.formula || ''}
        placeholder={index === 0 ? 'например: 90' : `например: ${index > 0 ? 'receipt.time + 30' : '90'}`}
        onChange={(e) => onChange({ ...stage, time: { ...stage.time, formula: e.target.value } })}
      />
      <div className="pm-var">переменная: <code>{stage.id}.time</code></div>
      <div className={`pm-result ${error ? 'error' : ''}`}>
        {error ? error : seconds != null ? `= ${formatDuration(seconds)} (${roundSmart(seconds)} с)` : '= время не задано'}
      </div>
    </article>
  );
}

function initialStageState(platform: LbcPlatform): ProcessStageMathState[] {
  return platform.stages.map((stage) => ({
    id: stage.phase,
    title: stage.title,
    automation: stage.automation,
    time: extractInitialDuration(stage.time),
  }));
}

function storageKey(platformId: string): string {
  return `autotrace:lbc-process-math:v1:${platformId}`;
}

export default function ProcessMathWorkbench() {
  const [platformId, setPlatformId] = useState(LBC_PLATFORMS[0]?.id || '');
  const platform = useMemo(() => LBC_PLATFORMS.find((item) => item.id === platformId) || LBC_PLATFORMS[0], [platformId]);
  const [stages, setStages] = useState<ProcessStageMathState[]>(() => platform ? initialStageState(platform) : []);
  const [batchSize, setBatchSize] = useState(1);
  const [customFormula, setCustomFormula] = useState('total.time / batch.count');

  useEffect(() => {
    if (!platform) return;
    try {
      const saved = localStorage.getItem(storageKey(platform.id));
      setStages(saved ? JSON.parse(saved) : initialStageState(platform));
    } catch {
      setStages(initialStageState(platform));
    }
  }, [platform?.id]);

  useEffect(() => {
    if (!platform) return;
    localStorage.setItem(storageKey(platform.id), JSON.stringify(stages));
  }, [platform?.id, stages]);

  const resolved = useMemo(() => resolveStageTimes(stages, { 'batch.count': batchSize }), [stages, batchSize]);
  const stats = useMemo(() => calculateProcessStats(stages, resolved.secondsByStage, batchSize), [stages, resolved.secondsByStage, batchSize]);

  const formulaContext = useMemo(() => ({
    ...resolved.context,
    'batch.count': batchSize,
    'total.time': stats.totalSeconds,
    'manual.time': stats.manualSeconds,
    'automatic.time': stats.automaticSeconds,
    'mixed.time': stats.mixedSeconds,
    'wait.time': stats.waitSeconds,
    'external.time': stats.externalSeconds,
    'qc.time': stats.qcSeconds,
    'bottleneck.time': stats.bottleneckSeconds,
    'coverage.percent': stats.coveragePercent,
  }), [resolved.context, batchSize, stats]);

  const customResult = useMemo(() => evaluateFormula(customFormula, formulaContext), [customFormula, formulaContext]);

  if (!platform) return null;

  const reset = () => {
    const next = initialStageState(platform);
    setStages(next);
    localStorage.removeItem(storageKey(platform.id));
  };

  return (
    <section className="pm-shell" id="process-math">
      <style>{`
        .pm-shell{background:#07111f;color:#e5edf7;padding:30px 22px 40px;border-top:1px solid #1e293b;font-family:Inter,ui-sans-serif,system-ui,sans-serif}
        .pm-inner{max-width:1800px;margin:0 auto}.pm-kicker{font-size:11px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;color:#60a5fa}
        .pm-title{font-size:clamp(25px,3vw,40px);letter-spacing:-.04em;margin:7px 0 8px}.pm-sub{color:#94a3b8;max-width:1000px;line-height:1.55;font-size:13px}
        .pm-controls{display:flex;gap:10px;flex-wrap:wrap;align-items:end;margin:18px 0}.pm-field{display:flex;flex-direction:column;gap:5px}.pm-field label,.pm-stage label{font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:800}
        .pm-controls select,.pm-controls input,.pm-stage input,.pm-stage select{background:#0f1b2d;border:1px solid #26364e;color:#e5edf7;border-radius:9px;padding:8px 9px;font:inherit;font-size:12px;outline:none}.pm-controls select{min-width:250px}.pm-controls button{background:#172337;border:1px solid #334155;color:#e2e8f0;border-radius:9px;padding:8px 11px;cursor:pointer}
        .pm-flow{display:flex;gap:12px;overflow-x:auto;padding:8px 2px 18px;align-items:stretch}.pm-stage{flex:0 0 255px;background:#0d1828;border:1px solid #22324a;border-top:4px solid;border-radius:13px;padding:12px;box-shadow:0 10px 25px rgba(0,0,0,.12)}
        .pm-stage-head{display:flex;justify-content:space-between;align-items:center}.pm-step{font-size:18px;font-weight:900;color:#475569}.pm-auto{font-size:8px;border:1px solid;border-radius:999px;padding:3px 6px;font-weight:900}.pm-stage h3{font-size:13px;line-height:1.25;margin:9px 0}.pm-source-time{font-size:9px;line-height:1.35;color:#64748b;min-height:35px;margin-bottom:10px}.pm-time-row{display:grid;grid-template-columns:1fr 72px;gap:6px;margin:4px 0 9px}.pm-formula{width:100%;box-sizing:border-box;margin-top:4px}.pm-var{font-size:9px;color:#64748b;margin-top:5px}.pm-var code{color:#93c5fd}.pm-result{margin-top:8px;border-radius:8px;background:#0b2531;color:#5eead4;padding:7px;font-size:10px;font-weight:800}.pm-result.error{background:#32151b;color:#fca5a5}
        .pm-stats{flex:0 0 305px;background:linear-gradient(180deg,#132238,#0d1828);border:1px solid #3b82f6;border-top:4px solid #3b82f6;border-radius:13px;padding:13px}.pm-stats h3{margin:0 0 10px;font-size:16px}.pm-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.pm-stat{background:#0b1524;border:1px solid #20314a;border-radius:9px;padding:8px}.pm-stat span{display:block;color:#64748b;font-size:8px;text-transform:uppercase}.pm-stat b{font-size:12px}.pm-stats .wide{grid-column:1/-1}.pm-custom{margin-top:10px;padding-top:10px;border-top:1px dashed #334155}.pm-custom input{width:100%;box-sizing:border-box;background:#07111f;border:1px solid #334155;color:#e5edf7;border-radius:8px;padding:8px}.pm-help{font-size:10px;color:#94a3b8;line-height:1.5;margin-top:12px}.pm-help code{color:#bfdbfe}.pm-arrow{display:flex;align-items:center;color:#475569;font-size:22px;flex:0 0 15px}
        @media(max-width:700px){.pm-shell{padding-left:12px;padding-right:12px}.pm-stage{flex-basis:230px}.pm-controls select{min-width:200px}}
      `}</style>
      <div className="pm-inner">
        <div className="pm-kicker">AutoTrace Process Math · формулы прямо на этапах</div>
        <h2 className="pm-title">Время каждого блока → формулы → итоговая статистика</h2>
        <p className="pm-sub">Все вычисления выполняются локально безопасным парсером без <code>eval</code>. Базовая единица формул — секунда. Каждый предыдущий блок доступен как <code>phase.time</code>; итоговый блок автоматически агрегирует процесс.</p>
        <div className="pm-controls">
          <div className="pm-field"><label>Платформа</label><select value={platform.id} onChange={(e) => setPlatformId(e.target.value)}>{LBC_PLATFORMS.map((item) => <option key={item.id} value={item.id}>{item.vendor} · {item.name}</option>)}</select></div>
          <div className="pm-field"><label>Размер партии</label><input type="number" min="1" step="1" value={batchSize} onChange={(e) => setBatchSize(Math.max(1, Number(e.target.value) || 1))} /></div>
          <button onClick={reset}>Сбросить расчёт</button>
        </div>
        <div className="pm-flow">
          {stages.map((stage, index) => {
            const source = platform.stages.find((item) => item.phase === stage.id)?.time || 'не опубликовано';
            return (
              <React.Fragment key={stage.id}>
                <StageMathCard
                  stage={stage}
                  sourceTime={source}
                  index={index}
                  seconds={resolved.secondsByStage[stage.id]}
                  error={resolved.errorsByStage[stage.id]}
                  onChange={(next) => setStages((prev) => prev.map((item) => item.id === next.id ? next : item))}
                />
                {index < stages.length - 1 && <div className="pm-arrow">→</div>}
              </React.Fragment>
            );
          })}
          <div className="pm-arrow">→</div>
          <article className="pm-stats">
            <h3>Σ Статистика процесса</h3>
            <div className="pm-stat-grid">
              <div className="pm-stat wide"><span>Суммарное серийное время</span><b>{formatDuration(stats.totalSeconds)}</b></div>
              <div className="pm-stat"><span>Ручное</span><b>{formatDuration(stats.manualSeconds)}</b></div>
              <div className="pm-stat"><span>Автоматическое</span><b>{formatDuration(stats.automaticSeconds)}</b></div>
              <div className="pm-stat"><span>Смешанное</span><b>{formatDuration(stats.mixedSeconds)}</b></div>
              <div className="pm-stat"><span>Внешний модуль</span><b>{formatDuration(stats.externalSeconds)}</b></div>
              <div className="pm-stat"><span>Покрытие таймингами</span><b>{roundSmart(stats.coveragePercent)}%</b></div>
              <div className="pm-stat"><span>Доля авто-времени</span><b>{roundSmart(stats.automationTimeSharePercent)}%</b></div>
              <div className="pm-stat wide"><span>Узкое место</span><b>{stats.bottleneckStageTitle || '—'} · {formatDuration(stats.bottleneckSeconds)}</b></div>
              <div className="pm-stat wide"><span>Модельная производительность партии</span><b>{stats.throughputPerHour == null ? '—' : `${roundSmart(stats.throughputPerHour)} образца/ч`}</b></div>
            </div>
            <div className="pm-custom">
              <label>Пользовательская формула</label>
              <input value={customFormula} onChange={(e) => setCustomFormula(e.target.value)} />
              <div className={`pm-result ${customResult.ok ? '' : 'error'}`}>{customResult.ok ? `= ${roundSmart(customResult.value || 0)}` : customResult.error}</div>
            </div>
            <div className="pm-help">Доступно: <code>total.time</code>, <code>manual.time</code>, <code>automatic.time</code>, <code>bottleneck.time</code>, <code>batch.count</code>, а также каждый этап. Функции: <code>sum</code>, <code>avg</code>, <code>min</code>, <code>max</code>, <code>round</code>, <code>ceil</code>, <code>floor</code>, <code>abs</code>, <code>sqrt</code>.</div>
          </article>
        </div>
      </div>
    </section>
  );
}
