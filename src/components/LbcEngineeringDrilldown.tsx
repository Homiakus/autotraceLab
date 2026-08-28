import React, { useMemo, useState } from 'react';
import { LBC_AUTOMATION_COLORS, LBC_PLATFORMS, LbcPlatform } from '../data/lbcWorkflowData';

interface DrillStep {
  title: string;
  mode: 'manual' | 'automatic' | 'mixed' | 'wait' | 'external' | 'qc';
  time: string;
  description: string;
  formula?: string;
}

interface DrillTemplate {
  id: string;
  label: string;
  when: (platform: LbcPlatform) => boolean;
  steps: DrillStep[];
}

const templates: DrillTemplate[] = [
  {
    id: 'thinprep-filtration',
    label: 'ThinPrep · мембранный сбор и перенос',
    when: (p) => p.family.toLowerCase().includes('thinprep'),
    steps: [
      { title: 'Диспергирование', mode: 'automatic', time: 'внутри цикла', description: 'Суспензия перемешивается для снижения агрегатов и более равномерного распределения клеток.' },
      { title: 'Погружение фильтра', mode: 'automatic', time: 'секунды', description: 'Одноразовая мембрана входит в виалу и становится рабочей поверхностью сбора.' },
      { title: 'Контролируемый поток', mode: 'automatic', time: 'до достижения критерия', description: 'Жидкость проходит через мембрану, клетки накапливаются; изменение потока/сопротивления используется как обратная связь.', formula: 'J = ΔP / (μ · Rtotal)' },
      { title: 'Нормализация клеточности', mode: 'automatic', time: 'внутри фильтрации', description: 'Сбор завершается по алгоритму платформы до избыточной перегрузки поверхности.' },
      { title: 'Контакт со стеклом', mode: 'automatic', time: 'секунды', description: 'Мембрана контактирует со стеклом, формируя стандартизированную диагностическую область.' },
      { title: 'Фиксация', mode: 'mixed', time: 'сразу после переноса', description: 'Препарат переводится в валидированный фиксирующий контур без высыхания.' },
    ],
  },
  {
    id: 'surepath-density',
    label: 'SurePath / Totalys · density-gradient enrichment',
    when: (p) => /surepath|totalys/i.test(`${p.name} ${p.family}`),
    steps: [
      { title: 'Гомогенизация', mode: 'automatic', time: 'минуты/внутри партии', description: 'Материал со щётки переводится в более однородную суспензию перед дозированием.' },
      { title: 'Перенос на Density Reagent', mode: 'automatic', time: 'секунды на дозирование', description: 'Определённый объём образца наслаивается на реагент плотности.' },
      { title: 'Центрифугирование', mode: 'automatic', time: 'зависит от валидированного протокола', description: 'Компоненты перераспределяются по эффективной плотности и размеру, диагностическая фракция концентрируется.', formula: 'RCF = 1.118·10⁻⁵ · r(cm) · rpm²' },
      { title: 'Аспирация / декантирование', mode: 'automatic', time: 'внутри цикла', description: 'Надосадочная и мешающая фракция удаляется без потери целевого клеточного концентрата.' },
      { title: 'Ресуспендирование pellet', mode: 'automatic', time: 'секунды–минуты', description: 'Клеточный осадок переводится обратно в однородную рабочую суспензию.' },
      { title: 'Седиментация на стекло', mode: 'automatic', time: 'зависит от платформы', description: 'Клетки осаждаются в ограниченной области предварительно подготовленного стекла.', formula: 'v ≈ 2(ρp−ρf)gr² / (9μ)' },
    ],
  },
  {
    id: 'centrifuge-sedimentation',
    label: 'Центрифугирование + седиментация',
    when: (p) => /easy|cytoreference|lts/i.test(`${p.name} ${p.family}`),
    steps: [
      { title: 'Перемешивание / аликвота', mode: 'mixed', time: 'зависит от партии', description: 'Образец гомогенизируется и дозируется в рабочий расходник.' },
      { title: 'Обогащение', mode: 'automatic', time: 'по протоколу', description: 'Центрифугальный этап удаляет часть фона и концентрирует клеточную фракцию.', formula: 'RCF ∝ r · rpm²' },
      { title: 'Удаление супернатанта', mode: 'automatic', time: 'внутри цикла', description: 'Жидкая фаза удаляется дозированно или декантированием.' },
      { title: 'Ресуспендирование', mode: 'automatic', time: 'внутри цикла', description: 'Осадок диспергируется до рабочей концентрации.' },
      { title: 'Осадочная камера', mode: 'mixed', time: 'минуты', description: 'Суспензия дозируется в камеру над стеклом и формирует тонкослойное пятно.' },
      { title: 'Pap staining', mode: 'automatic', time: 'если модуль встроен', description: 'В интегрированных системах стекло автоматически проходит красители, промывки и спиртовые переходы.' },
    ],
  },
  {
    id: 'membrane-transfer',
    label: 'CellPrep / HURO PATH / CellSlide · фильтрационная ветвь',
    when: (p) => /cellprep|huro|cellslide/i.test(`${p.name} ${p.family}`),
    steps: [
      { title: 'Гомогенизация', mode: 'mixed', time: 'короткий pre-process', description: 'Снижаются крупные агрегаты и обеспечивается воспроизводимый забор.' },
      { title: 'Мембранный сбор', mode: 'automatic', time: 'секунды–минуты', description: 'Клетки задерживаются на мембране при управляемом перепаде давления.', formula: 'J = ΔP / (μ · Rtotal)' },
      { title: 'Контроль нагрузки фильтра', mode: 'automatic', time: 'внутри сбора', description: 'Система ограничивает чрезмерную клеточную нагрузку и фон.' },
      { title: 'Обратный перенос', mode: 'automatic', time: 'секунды', description: 'Клетки переводятся с мембраны на стекло контактом, обратным потоком или воздушным импульсом.' },
      { title: 'Фиксация', mode: 'mixed', time: 'немедленно', description: 'После нанесения препарат фиксируется и передаётся на окраску.' },
      { title: 'Внешняя Pap-окраска', mode: 'external', time: 'по рецепту стейнера', description: 'Окраска выполняется отдельным валидированным stainer workflow.' },
    ],
  },
  {
    id: 'novaprep',
    label: 'NOVAprep · differential/double decantation',
    when: (p) => /nova/i.test(`${p.name} ${p.family}`),
    steps: [
      { title: 'Идентификация и загрузка', mode: 'mixed', time: 'batch-dependent', description: 'Виалы и стекла связываются с маршрутом партии.' },
      { title: 'Роботизированное дозирование', mode: 'automatic', time: 'внутри цикла', description: 'Жидкостная система перемещает заданные объёмы между рабочими позициями.' },
      { title: 'Дифференциальное декантирование', mode: 'automatic', time: 'по протоколу', description: 'Последовательные жидкостные/осадочные переходы используются для уменьшения фона и концентрации клеток.' },
      { title: 'Концентрированная фракция', mode: 'automatic', time: 'внутри цикла', description: 'Рабочая клеточная фракция доводится до состояния, пригодного для нанесения.' },
      { title: 'Нанесение на стекло', mode: 'automatic', time: 'внутри цикла', description: 'Робот формирует ограниченную диагностическую область.' },
      { title: 'Передача на окраску / QC', mode: 'mixed', time: 'конфигурационно', description: 'Дальнейшая окраска зависит от комплектации конкретной линии.' },
    ],
  },
];

function pickTemplate(platform: LbcPlatform): DrillTemplate {
  return templates.find((template) => template.when(platform)) || {
    id: 'generic',
    label: 'Обобщённая LBC-подготовка',
    when: () => true,
    steps: platform.stages.map((stage) => ({
      title: stage.title,
      mode: stage.automation,
      time: stage.time,
      description: stage.description,
    })),
  };
}

export default function LbcEngineeringDrilldown() {
  const [platformId, setPlatformId] = useState(LBC_PLATFORMS[0]?.id || '');
  const platform = useMemo(() => LBC_PLATFORMS.find((item) => item.id === platformId) || LBC_PLATFORMS[0], [platformId]);
  const template = useMemo(() => platform ? pickTemplate(platform) : null, [platform]);
  if (!platform || !template) return null;

  return (
    <section className="ed-shell" id="engineering-drilldown">
      <style>{`
        .ed-shell{background:#f8fafc;color:#0f172a;padding:34px 22px;border-top:1px solid #dbe4ef;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.ed-inner{max-width:1800px;margin:auto}.ed-head{display:flex;justify-content:space-between;gap:20px;align-items:end;flex-wrap:wrap}.ed-kicker{font-size:10px;font-weight:900;letter-spacing:.14em;color:#7c3aed;text-transform:uppercase}.ed-head h2{font-size:clamp(24px,3vw,38px);letter-spacing:-.04em;margin:6px 0}.ed-head p{max-width:900px;color:#64748b;font-size:12px;line-height:1.6}.ed-select{display:flex;flex-direction:column;gap:5px}.ed-select label{font-size:9px;text-transform:uppercase;color:#64748b;font-weight:800}.ed-select select{min-width:300px;border:1px solid #cbd5e1;border-radius:9px;background:white;padding:9px;color:#0f172a}.ed-flow{display:flex;align-items:stretch;gap:10px;overflow-x:auto;padding:22px 2px}.ed-card{flex:0 0 245px;background:white;border:1px solid #dbe4ef;border-top:4px solid;border-radius:13px;padding:13px;box-shadow:0 4px 12px rgba(15,23,42,.04)}.ed-card h3{font-size:14px;margin:8px 0}.ed-mode{font-size:8px;font-weight:900;text-transform:uppercase;border:1px solid;border-radius:999px;padding:3px 6px}.ed-time{font-size:10px;background:#f1f5f9;border-radius:7px;padding:6px 7px;font-weight:800}.ed-card p{font-size:10px;color:#64748b;line-height:1.5}.ed-formula{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:#ede9fe;color:#5b21b6;border-radius:7px;padding:7px;font-size:10px}.ed-arrow{display:flex;align-items:center;color:#94a3b8;font-size:22px}.ed-summary{background:#0f172a;color:#e2e8f0;border-radius:14px;padding:15px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.ed-summary div{background:#172033;border-radius:9px;padding:9px}.ed-summary span{display:block;color:#94a3b8;font-size:8px;text-transform:uppercase}.ed-summary b{font-size:11px}.ed-note{margin-top:12px;color:#64748b;font-size:10px;line-height:1.55}@media(max-width:750px){.ed-shell{padding-left:12px;padding-right:12px}.ed-select select{min-width:230px}.ed-summary{grid-template-columns:1fr 1fr}}
      `}</style>
      <div className="ed-inner">
        <div className="ed-head">
          <div>
            <div className="ed-kicker">Второй масштаб · инженерная декомпозиция</div>
            <h2>Что физически происходит внутри крупного LBC-блока</h2>
            <p>Здесь укрупнённая стадия раскрывается в последовательность внутренних операций. Формулы показывают физический смысл процесса, но не заменяют валидированные настройки конкретного прибора.</p>
          </div>
          <div className="ed-select"><label>Платформа</label><select value={platform.id} onChange={(e) => setPlatformId(e.target.value)}>{LBC_PLATFORMS.map((item) => <option key={item.id} value={item.id}>{item.vendor} · {item.name}</option>)}</select></div>
        </div>
        <h3 style={{ marginTop: 20 }}>{template.label}</h3>
        <div className="ed-flow">
          {template.steps.map((step, index) => {
            const color = LBC_AUTOMATION_COLORS[step.mode] || '#64748B';
            return <React.Fragment key={`${template.id}-${index}`}>
              <article className="ed-card" style={{ borderTopColor: color }}>
                <span className="ed-mode" style={{ color, borderColor: color }}>{step.mode}</span>
                <h3>{step.title}</h3>
                <div className="ed-time">⏱ {step.time}</div>
                <p>{step.description}</p>
                {step.formula && <div className="ed-formula">{step.formula}</div>}
              </article>
              {index < template.steps.length - 1 && <div className="ed-arrow">→</div>}
            </React.Fragment>;
          })}
        </div>
        <div className="ed-summary">
          <div><span>Суммарное последовательное время</span><b>T = Σ tᵢ</b></div>
          <div><span>Производительность</span><b>Q = N / T</b></div>
          <div><span>Параллельные ветви</span><b>Tcritical = max(T₁, T₂, …)</b></div>
          <div><span>Доля автоматизации</span><b>A = ΣTauto / ΣTprocess</b></div>
        </div>
        <div className="ed-note">RCF, закон Стокса и Darcy-подобная формула потока приведены как инженерные модели для понимания зависимости параметров. По ним нельзя самостоятельно восстанавливать или менять RPM, время центрифугирования, давление фильтрации либо клинически валидированный staining recipe.</div>
      </div>
    </section>
  );
}
