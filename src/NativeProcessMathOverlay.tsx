import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatDuration, ProcessTimeInput, ProcessTimeUnit, roundSmart } from './processMath';
import {
  GraphProcessBlock,
  ProcessAutomationKind,
  analyzeGraphProcess,
} from './processGraphMath';
import { inferCanvasTopology } from './nativeCanvasTopology';

const STORAGE_KEY = 'autotrace:native-canvas-process-math:v1';

interface NativeMathConfig {
  enabled: boolean;
  key: string;
  automation: ProcessAutomationKind;
  time: ProcessTimeInput;
  dependencies: string[];
}

interface DiscoveredBlock {
  id: string;
  title: string;
  rect: DOMRect;
}

const AUTOMATION: Array<{ id: ProcessAutomationKind; label: string; color: string }> = [
  { id: 'manual', label: 'РУЧНО', color: '#F59E0B' },
  { id: 'automatic', label: 'АВТО', color: '#10B981' },
  { id: 'mixed', label: 'СМЕШАННО', color: '#8B5CF6' },
  { id: 'wait', label: 'ОЖИДАНИЕ', color: '#3B82F6' },
  { id: 'external', label: 'ВНЕШНИЙ', color: '#06B6D4' },
  { id: 'qc', label: 'QC', color: '#EF4444' },
];

function safeKey(id: string): string {
  const value = id
    .replace(/[^A-Za-zА-Яа-яЁё0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^([0-9])/, '_$1');
  return value || 'stage';
}

function loadConfigs(): Record<string, NativeMathConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, NativeMathConfig>;
    }
  } catch {
    // Ignore invalid local data.
  }
  return {};
}

function colorFor(kind: ProcessAutomationKind): string {
  return AUTOMATION.find(item => item.id === kind)?.color || '#64748B';
}

function titleFromNode(group: Element, fallback: string): string {
  const texts = Array.from(group.querySelectorAll('text'));
  const likelyTitle = texts.find(text => {
    const fontSize = Number(text.getAttribute('font-size') || text.getAttribute('fontSize') || 0);
    return fontSize >= 9 && text.textContent?.trim();
  });
  return likelyTitle?.textContent?.trim() || texts[0]?.textContent?.trim() || fallback;
}

export default function NativeProcessMathOverlay() {
  const [enabled, setEnabled] = useState(false);
  const [configs, setConfigs] = useState<Record<string, NativeMathConfig>>(loadConfigs);
  const [blocks, setBlocks] = useState<DiscoveredBlock[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState(1);
  const [summaryFormula, setSummaryFormula] = useState('critical.time / batch.count');
  const [collapsed, setCollapsed] = useState(false);
  const [topologyNotice, setTopologyNotice] = useState('');
  const lastSignature = useRef('');

  const persist = (next: Record<string, NativeMathConfig>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    if (!enabled) return;

    const scan = () => {
      const groups = Array.from(document.querySelectorAll<SVGGElement>('[id^="block-node-"]'));
      const discovered = groups.map(group => {
        const id = group.id.replace(/^block-node-/, '');
        return {
          id,
          title: titleFromNode(group, id),
          rect: group.getBoundingClientRect(),
        };
      });
      const signature = discovered
        .map(item => `${item.id}:${Math.round(item.rect.left)}:${Math.round(item.rect.top)}:${Math.round(item.rect.width)}:${Math.round(item.rect.height)}:${item.title}`)
        .join('|');
      if (signature !== lastSignature.current) {
        lastSignature.current = signature;
        setBlocks(discovered);
      }
    };

    scan();
    const interval = window.setInterval(scan, 180);
    const onResize = () => scan();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const group = target?.closest?.('[id^="block-node-"]') as SVGGElement | null;
      if (!group) return;
      setSelectedId(group.id.replace(/^block-node-/, ''));
    };
    document.addEventListener('click', onPointer, true);
    return () => document.removeEventListener('click', onPointer, true);
  }, [enabled]);

  const mathBlocks = useMemo<GraphProcessBlock[]>(() => {
    return blocks
      .filter(block => configs[block.id]?.enabled)
      .map(block => {
        const config = configs[block.id];
        return {
          id: block.id,
          key: config.key || safeKey(block.id),
          title: block.title,
          automation: config.automation,
          time: config.time,
          dependencies: config.dependencies.filter(dep => configs[dep]?.enabled),
        };
      });
  }, [blocks, configs]);

  const analysis = useMemo(
    () => analyzeGraphProcess(mathBlocks, { batchSize, summaryFormula }),
    [mathBlocks, batchSize, summaryFormula],
  );

  const selectedBlock = blocks.find(block => block.id === selectedId) || null;
  const selectedConfig = selectedId ? configs[selectedId] : undefined;

  const ensureConfig = (id: string): NativeMathConfig => configs[id] || {
    enabled: false,
    key: safeKey(id),
    automation: 'automatic',
    time: { value: 1, unit: 'min' },
    dependencies: [],
  };

  const updateConfig = (id: string, updater: (current: NativeMathConfig) => NativeMathConfig) => {
    setConfigs(current => {
      const next = { ...current, [id]: updater(current[id] || ensureConfig(id)) };
      persist(next);
      return next;
    });
  };

  const autoLinkByCanvasOrder = () => {
    const ordered = [...blocks]
      .filter(block => configs[block.id]?.enabled)
      .sort((a, b) => (a.rect.left - b.rect.left) || (a.rect.top - b.rect.top));
    setConfigs(current => {
      const next = { ...current };
      ordered.forEach((block, index) => {
        const existing = next[block.id] || ensureConfig(block.id);
        next[block.id] = {
          ...existing,
          dependencies: index > 0 ? [ordered[index - 1].id] : [],
        };
      });
      persist(next);
      return next;
    });
    setTopologyNotice(`Последовательность построена по экранному порядку для ${ordered.length} блоков.`);
  };

  const syncDependenciesFromCanvasArrows = () => {
    const inferred = inferCanvasTopology();
    setConfigs(current => {
      const next = { ...current };
      let updated = 0;
      for (const block of blocks) {
        const existing = next[block.id];
        if (!existing?.enabled) continue;
        const dependencies = (inferred.dependenciesByTarget[block.id] || [])
          .filter(dep => next[dep]?.enabled && dep !== block.id);
        next[block.id] = { ...existing, dependencies };
        updated += 1;
      }
      persist(next);
      return next;
    });
    const warningSuffix = inferred.warnings.length
      ? ` Предупреждений: ${inferred.warnings.length}.`
      : '';
    setTopologyNotice(`По SVG-стрелкам распознано ${inferred.edges.length} связей.${warningSuffix}`);
  };

  const clearAllMath = () => {
    setConfigs({});
    localStorage.removeItem(STORAGE_KEY);
    setSelectedId(null);
    setTopologyNotice('Math-конфигурация очищена.');
  };

  if (!enabled) {
    return (
      <button
        onClick={() => setEnabled(true)}
        title="Включить Process Math поверх обычных блоков AutoTrace"
        style={{
          position: 'fixed', right: 18, bottom: 18, zIndex: 90,
          border: '1px solid rgba(255,255,255,.16)', borderRadius: 12,
          background: '#0F172A', color: '#fff', padding: '10px 13px',
          fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 800,
          boxShadow: '0 10px 30px rgba(15,23,42,.35)', cursor: 'pointer',
        }}
      >
        Σ Process Math
      </button>
    );
  }

  const stats = analysis.stats;

  return (
    <>
      <style>{`
        .npm-badge { position:fixed; z-index:72; pointer-events:none; min-width:92px; max-width:190px; border-radius:8px; padding:5px 7px; color:white; font:700 9px/1.25 ui-monospace,SFMono-Regular,Menlo,monospace; box-shadow:0 6px 18px rgba(15,23,42,.25); backdrop-filter:blur(6px); }
        .npm-badge small { display:block; opacity:.72; font-size:7px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .npm-panel { position:fixed; right:14px; top:78px; z-index:95; width:340px; max-height:calc(100vh - 96px); overflow:auto; border:1px solid rgba(255,255,255,.12); border-radius:16px; background:rgba(15,23,42,.96); color:#E2E8F0; box-shadow:0 18px 50px rgba(2,6,23,.45); backdrop-filter:blur(18px); font-family:Inter,system-ui,sans-serif; }
        .npm-panel.collapsed { width:230px; max-height:none; }
        .npm-head { position:sticky; top:0; z-index:2; display:flex; align-items:center; gap:8px; padding:11px 12px; background:rgba(15,23,42,.98); border-bottom:1px solid rgba(255,255,255,.1); }
        .npm-head b { font-size:11px; }
        .npm-head span { color:#94A3B8; font-size:9px; }
        .npm-head-actions { margin-left:auto; display:flex; gap:4px; }
        .npm-mini-btn { border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.06); color:#CBD5E1; border-radius:7px; padding:4px 6px; cursor:pointer; font-size:9px; }
        .npm-body { padding:11px; }
        .npm-field { margin-bottom:9px; }
        .npm-field label { display:block; margin-bottom:4px; color:#94A3B8; font:800 8px/1.2 ui-monospace,monospace; text-transform:uppercase; letter-spacing:.07em; }
        .npm-input,.npm-select { width:100%; min-height:31px; border:1px solid #334155; border-radius:8px; background:#0B1220; color:#E2E8F0; padding:6px 8px; outline:none; font:500 10px/1.2 ui-monospace,monospace; }
        .npm-row { display:grid; grid-template-columns:1fr 1fr; gap:7px; }
        .npm-switch { display:flex; align-items:center; gap:7px; margin-bottom:10px; padding:8px; border-radius:9px; background:rgba(255,255,255,.04); font-size:10px; }
        .npm-deps { max-height:112px; overflow:auto; border:1px solid #334155; border-radius:8px; background:#0B1220; padding:6px; }
        .npm-deps label { display:flex; align-items:center; gap:6px; margin:0; padding:3px 1px; color:#CBD5E1; font-size:9px; text-transform:none; letter-spacing:0; }
        .npm-eval { border-radius:9px; border:1px solid #334155; background:#111827; padding:8px; font-size:9px; color:#94A3B8; }
        .npm-eval b { display:block; margin-top:2px; color:#F8FAFC; font-size:15px; }
        .npm-error { margin-top:5px; color:#FCA5A5; font-size:8px; line-height:1.4; }
        .npm-notice { margin-top:7px; color:#93C5FD; font-size:8px; line-height:1.4; }
        .npm-stats { margin-top:10px; border-top:1px solid rgba(255,255,255,.1); padding-top:10px; }
        .npm-stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
        .npm-stat { padding:7px; border-radius:8px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); }
        .npm-stat span { display:block; color:#94A3B8; font-size:7px; text-transform:uppercase; }
        .npm-stat b { display:block; margin-top:2px; font-size:10px; color:#F8FAFC; }
        .npm-tools { display:flex; gap:5px; flex-wrap:wrap; margin-top:9px; }
        .npm-tools button { border:1px solid #334155; background:#111827; color:#CBD5E1; border-radius:7px; padding:5px 7px; font-size:8px; cursor:pointer; }
        .npm-tools button.primary { border-color:#2563EB; color:#BFDBFE; background:#172554; }
        .npm-formula-help { color:#64748B; font-size:8px; line-height:1.45; margin-top:4px; }
        .npm-empty { color:#94A3B8; font-size:10px; line-height:1.5; padding:6px 0; }
        @media(max-width:700px){ .npm-panel{right:8px;left:8px;top:auto;bottom:8px;width:auto;max-height:56vh}.npm-badge{display:none} }
      `}</style>

      {blocks.map(block => {
        const config = configs[block.id];
        if (!config?.enabled) return null;
        const result = analysis.results[block.id];
        const color = result?.error ? '#B91C1C' : colorFor(config.automation);
        const left = Math.max(4, Math.min(window.innerWidth - 200, block.rect.left + 7));
        const top = Math.max(4, block.rect.top + 25);
        return (
          <div
            key={block.id}
            className="npm-badge"
            style={{ left, top, background: `${color}E6`, border: `1px solid ${color}` }}
          >
            {result?.seconds != null ? `⏱ ${formatDuration(result.seconds)}` : '⏱ —'}
            <small>{config.time.formula?.trim() ? `ƒ ${config.time.formula}` : `${config.key}.time`}</small>
          </div>
        );
      })}

      <aside className={`npm-panel ${collapsed ? 'collapsed' : ''}`}>
        <div className="npm-head">
          <div>
            <b>Σ Native Process Math</b>
            <span style={{ display: 'block' }}>{mathBlocks.length} математических блоков</span>
          </div>
          <div className="npm-head-actions">
            <button className="npm-mini-btn" onClick={() => setCollapsed(value => !value)}>{collapsed ? '□' : '—'}</button>
            <button className="npm-mini-btn" onClick={() => setEnabled(false)}>×</button>
          </div>
        </div>

        {!collapsed && (
          <div className="npm-body">
            {selectedBlock ? (
              <>
                <div className="npm-field">
                  <label>Выбранный блок</label>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#F8FAFC' }}>{selectedBlock.title}</div>
                  <div style={{ fontSize: 8, color: '#64748B', fontFamily: 'ui-monospace,monospace' }}>{selectedBlock.id}</div>
                </div>

                <label className="npm-switch">
                  <input
                    type="checkbox"
                    checked={selectedConfig?.enabled ?? false}
                    onChange={event => updateConfig(selectedBlock.id, current => ({ ...current, enabled: event.target.checked }))}
                  />
                  Использовать этот SVG-блок в Process Math
                </label>

                {(selectedConfig?.enabled ?? false) && (
                  <>
                    <div className="npm-row">
                      <div className="npm-field">
                        <label>Math key</label>
                        <input className="npm-input" value={selectedConfig?.key || safeKey(selectedBlock.id)} onChange={event => updateConfig(selectedBlock.id, current => ({ ...current, key: event.target.value }))} />
                      </div>
                      <div className="npm-field">
                        <label>Тип</label>
                        <select className="npm-select" value={selectedConfig?.automation || 'automatic'} onChange={event => updateConfig(selectedBlock.id, current => ({ ...current, automation: event.target.value as ProcessAutomationKind }))}>
                          {AUTOMATION.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="npm-row">
                      <div className="npm-field">
                        <label>Время</label>
                        <input
                          className="npm-input"
                          type="number"
                          min="0"
                          step="any"
                          disabled={Boolean(selectedConfig?.time.formula?.trim())}
                          value={selectedConfig?.time.value ?? ''}
                          onChange={event => updateConfig(selectedBlock.id, current => ({ ...current, time: { ...current.time, value: event.target.value === '' ? null : Number(event.target.value) } }))}
                        />
                      </div>
                      <div className="npm-field">
                        <label>Единица</label>
                        <select
                          className="npm-select"
                          disabled={Boolean(selectedConfig?.time.formula?.trim())}
                          value={selectedConfig?.time.unit || 'min'}
                          onChange={event => updateConfig(selectedBlock.id, current => ({ ...current, time: { ...current.time, unit: event.target.value as ProcessTimeUnit } }))}
                        >
                          <option value="ms">мс</option><option value="s">с</option><option value="min">мин</option><option value="h">ч</option>
                        </select>
                      </div>
                    </div>

                    <div className="npm-field">
                      <label>Формула времени → секунды</label>
                      <input
                        className="npm-input"
                        placeholder="prep.time + 30"
                        value={selectedConfig?.time.formula || ''}
                        onChange={event => updateConfig(selectedBlock.id, current => ({ ...current, time: { ...current.time, formula: event.target.value } }))}
                      />
                      <div className="npm-formula-help">Можно ссылаться на другие включённые блоки: <code>other_key.time</code>.</div>
                    </div>

                    <div className="npm-field">
                      <label>Зависимости DAG</label>
                      <div className="npm-deps">
                        {blocks.filter(block => block.id !== selectedBlock.id && configs[block.id]?.enabled).length === 0 && <div className="npm-empty">Сначала включите ещё один блок.</div>}
                        {blocks.filter(block => block.id !== selectedBlock.id && configs[block.id]?.enabled).map(block => (
                          <label key={block.id}>
                            <input
                              type="checkbox"
                              checked={selectedConfig?.dependencies.includes(block.id) ?? false}
                              onChange={event => updateConfig(selectedBlock.id, current => ({
                                ...current,
                                dependencies: event.target.checked
                                  ? Array.from(new Set([...current.dependencies, block.id]))
                                  : current.dependencies.filter(dep => dep !== block.id),
                              }))}
                            />
                            {block.title}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="npm-eval">
                      Результат
                      <b>{analysis.results[selectedBlock.id]?.seconds != null ? formatDuration(analysis.results[selectedBlock.id].seconds!) : '—'}</b>
                      {analysis.results[selectedBlock.id]?.criticalFinishSeconds != null && <div>Финиш по графу: {formatDuration(analysis.results[selectedBlock.id].criticalFinishSeconds!)}</div>}
                      {analysis.results[selectedBlock.id]?.error && <div className="npm-error">⚠ {analysis.results[selectedBlock.id].error}</div>}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="npm-empty">Кликните по обычному блоку AutoTrace — его математические свойства откроются здесь.</div>
            )}

            <div className="npm-stats">
              <div className="npm-row">
                <div className="npm-field">
                  <label>Размер партии</label>
                  <input className="npm-input" type="number" min="1" value={batchSize} onChange={event => setBatchSize(Math.max(1, Number(event.target.value) || 1))} />
                </div>
                <div className="npm-field">
                  <label>Польз. Σ-формула</label>
                  <input className="npm-input" value={summaryFormula} onChange={event => setSummaryFormula(event.target.value)} />
                </div>
              </div>
              <div className="npm-stat-grid">
                <div className="npm-stat"><span>Σ времён</span><b>{formatDuration(stats.totalStageSeconds)}</b></div>
                <div className="npm-stat"><span>Critical path</span><b>{formatDuration(stats.criticalPathSeconds)}</b></div>
                <div className="npm-stat"><span>Ручное</span><b>{formatDuration(stats.manualSeconds)}</b></div>
                <div className="npm-stat"><span>Автоматическое</span><b>{formatDuration(stats.automaticSeconds)}</b></div>
                <div className="npm-stat"><span>Bottleneck</span><b>{stats.bottleneckBlockTitle || '—'}</b></div>
                <div className="npm-stat"><span>Throughput</span><b>{stats.throughputPerHour == null ? '—' : `${roundSmart(stats.throughputPerHour)}/ч`}</b></div>
              </div>
              {analysis.summaryFormula && <div className="npm-eval" style={{ marginTop: 7 }}>Σ formula <b>{analysis.summaryFormula.ok ? roundSmart(analysis.summaryFormula.value ?? 0) : '—'}</b>{!analysis.summaryFormula.ok && <div className="npm-error">{analysis.summaryFormula.error}</div>}</div>}
              {stats.hasCycle && <div className="npm-error">Цикл зависимостей: {stats.cycleBlockIds.join(', ')}</div>}
              {topologyNotice && <div className="npm-notice">{topologyNotice}</div>}

              <div className="npm-tools">
                <button className="primary" onClick={syncDependenciesFromCanvasArrows}>Связи ← SVG-стрелки</button>
                <button onClick={autoLinkByCanvasOrder}>Автосвязь слева → вправо</button>
                <button onClick={() => window.location.assign(`${window.location.pathname}?view=process-math`)}>Полный Workbench ↗</button>
                <button onClick={clearAllMath}>Очистить Math</button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
