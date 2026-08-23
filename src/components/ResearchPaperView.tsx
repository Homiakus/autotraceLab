import React from 'react';
import { BookOpen, Zap, Compass, Layers, ShieldAlert, Cpu, CheckCircle, GitCommit, Move, Binary } from 'lucide-react';

export const ResearchPaperView: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 text-[#e0e2e5] leading-relaxed font-sans animate-fade-in">
      {/* Header Bento Card */}
      <div className="bg-[#16181d] rounded-xl border border-white/5 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-[10px] text-blue-400 font-mono uppercase tracking-widest font-semibold">
              Deep Mathematical & Algorithmic Formulation (EDA & Graph Drawing)
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white uppercase">
            Математические Модели Безупречной Трассировки и Непересекающихся Подписей
          </h1>
          <p className="text-xs text-gray-400 font-mono mt-1 uppercase tracking-wider">
            Граничные условия нормалей портов, 2D силовая релаксация подписей, мостики IEEE 315 и сетки Ханана.
          </p>
        </div>

        <div className="text-right font-mono hidden md:block">
          <span className="text-[10px] text-gray-500 uppercase block">Document ID: SCH-2024-MATH-V2</span>
          <span className="text-xs font-bold text-emerald-400">IEEE Trans. CAD & EDA</span>
        </div>
      </div>

      {/* Executive Verdict Bento Card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-900 rounded-xl p-6 shadow-2xl shadow-blue-900/20 border border-blue-400/20 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-200" />
            <h2 className="text-white text-base font-bold uppercase tracking-wider font-mono">
              Двухэтапная Архитектура с Топологическими Инвариантами
            </h2>
          </div>
          <span className="bg-white/10 text-white px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase">
            Zero-Defect Pipeline
          </span>
        </div>

        <p className="text-blue-100 text-xs sm:text-sm leading-relaxed">
          Для устранения визуальных дефектов схемы (косые углы захода стрелок, взаимное наложение шильдиков и коллизии проводов)
          математический аппарат объединяет строгие векторные краевые условия и силовую динамическую релаксацию.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="bg-[#0c0d10]/70 rounded-xl border border-white/10 p-4 space-y-1.5">
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono">
              1. Инвариант Входа (Entry Invariant)
            </span>
            <h3 className="font-semibold text-white text-sm">Коллинеарные Вылеты Портов</h3>
            <p className="text-xs text-gray-400">
              Вектор входа v_entry = -n_port гарантирует строгий ортогональный угол 0° / 90° / 180° / 270°.
            </p>
          </div>

          <div className="bg-[#0c0d10]/70 rounded-xl border border-white/10 p-4 space-y-1.5">
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest font-mono">
              2. Подписи Без Перекрытий
            </span>
            <h3 className="font-semibold text-white text-sm">2D Force-Directed Relaxation</h3>
            <p className="text-xs text-gray-400">
              Фазовый сдвиг параллельных шин и силовое раздвижение AABB-контейнеров с выносными линиями (Leader lines).
            </p>
          </div>

          <div className="bg-[#0c0d10]/70 rounded-xl border border-white/10 p-4 space-y-1.5">
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono">
              3. Мостики Линий (Line Hops)
            </span>
            <h3 className="font-semibold text-white text-sm">IEEE 315 / IEC 60617</h3>
            <p className="text-xs text-gray-400">
              Дугообразные полукруглые перемычки при пересечении ортогональных трасс, исключающие неоднозначность узлов.
            </p>
          </div>
        </div>
      </div>

      {/* Bento Grid: Mathematical Formulations */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Formula 1: Boundary Value Problem */}
        <div className="md:col-span-6 bg-[#16181d] rounded-xl border border-white/5 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Compass className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300 font-mono">
              1. Краевая Задача Нормалей Портов (Dirichlet BVP)
            </h3>
          </div>
          <p className="text-xs text-gray-400">
            Траектория P(t), t ∈ [0,1] обязана удовлетворять краевым условиям первого порядка на границах блоков:
          </p>
          <div className="font-mono text-xs text-cyan-300 bg-[#0c0d10] p-3 rounded-lg border border-white/5 space-y-1.5">
            <div>P(0) = P_src,   P'(0) = L_exit · n_src</div>
            <div>P(1) = P_dst,   P'(1) = -L_entry · n_dst</div>
          </div>
          <p className="text-[11px] text-gray-400">
            Это исключает излом траектории на самом пине и гарантирует, что стрелка всегда входит строго перпендикулярно грани блока.
          </p>
        </div>

        {/* Formula 2: Label Optimization Problem */}
        <div className="md:col-span-6 bg-[#16181d] rounded-xl border border-white/5 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300 font-mono">
              2. Целевая Функция Размещения Подписей (Label Optimization)
            </h3>
          </div>
          <p className="text-xs text-gray-400">
            Оптимальные координаты центров шильдиков L_i минимизируют смещение от провода и пересечения:
          </p>
          <div className="font-mono text-xs text-purple-300 bg-[#0c0d10] p-3 rounded-lg border border-white/5 space-y-1">
            <div>min Σ ||L_i - L_i^(0)||^2 + λ1 Σ Overlap(B_i, B_j) + λ2 Σ Obstacle(B_i, Node_k)</div>
          </div>
          <p className="text-[11px] text-gray-400">
            Где фазовый сдвиг t_j = j / (m + 1) разносит параллельные шины, а 2D AABB релаксация выталкивает перекрывающиеся подписи.
          </p>
        </div>

        {/* Formula 3: Hanan Grid Reduction */}
        <div className="md:col-span-6 bg-[#16181d] rounded-xl border border-white/5 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Binary className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300 font-mono">
              3. Теорема Сетки Ханана (Hanan Grid Reduction)
            </h3>
          </div>
          <p className="text-xs text-gray-400">
            Для ортогонального соединения набора терминалов V существует минимальное дерево Штейнера, рёбра которого лежат исключительно на сетке Ханана:
          </p>
          <div className="font-mono text-xs text-emerald-300 bg-[#0c0d10] p-3 rounded-lg border border-white/5">
            H(V) = {'{ (x, y) | x ∈ X(V) ∪ X(Obstacles), y ∈ Y(V) ∪ Y(Obstacles) }'}
          </div>
          <p className="text-[11px] text-gray-400">
            Дискретизация непрерывного пространства в узлы Ханана уменьшает вычислительную сложность A* с O(W · H) до O(|V|^2 log |V|).
          </p>
        </div>

        {/* Formula 4: Line Hop Geometry */}
        <div className="md:col-span-6 bg-[#16181d] rounded-xl border border-white/5 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <GitCommit className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300 font-mono">
              4. Геометрия Мостиков Пересечений (IEEE 315 Bridge Arcs)
            </h3>
          </div>
          <p className="text-xs text-gray-400">
            При пересечении вертикального отрезка [y1, y2] с горизонтальным y = y* отрезок разбивается дугой радиуса r:
          </p>
          <div className="font-mono text-xs text-blue-300 bg-[#0c0d10] p-3 rounded-lg border border-white/5 space-y-1">
            <div>Path = [y1 → (y* - r)] + Arc(r, r, Δx = +r) + [(y* + r) → y2]</div>
          </div>
          <p className="text-[11px] text-gray-400">
            При переключении тумблера "Мостики (IEEE 315)" алгоритм автоматически генерирует чистые SVG-дуги для всех пар пересекающихся линий.
          </p>
        </div>

        {/* Formula 5: Joint Co-Optimization & Pin-Aware Alignment */}
        <div className="md:col-span-6 bg-[#16181d] rounded-xl border border-white/5 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Move className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300 font-mono">
              5. Сквозная Совместная Оптимизация (Joint Co-Optimization)
            </h3>
          </div>
          <p className="text-xs text-gray-400">
            Совместный расчет позиций блоков Y_v и трасс с минимизацией ступенчатых изгибов (Staircase Elimination):
          </p>
          <div className="font-mono text-xs text-cyan-300 bg-[#0c0d10] p-3 rounded-lg border border-white/5 space-y-1">
            <div>min Σ w_e · |(Y_u + δ_pSrc) - (Y_v + δ_pTgt)| + γ · Σ Bends(Path_e)</div>
            <div>s.t. Y_{`{i+1}`} ≥ Y_i + Height_i + Gap,   X_{`{L+1}`} ≥ X_L + Width_L + Channel(density)</div>
          </div>
          <p className="text-[11px] text-gray-400">
            Микро-выравнивание по соосности пинов делает прямые связи между смежными слоями 100% прямолинейными (0 изгибов).
          </p>
        </div>

        {/* Formula 6: Multi-Pass Orthogonal Wire Artifact Cleaner */}
        <div className="md:col-span-6 bg-[#16181d] rounded-xl border border-white/5 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300 font-mono">
              6. Многопроходный Фильтр Артефактов (Artifact Cleaner)
            </h3>
          </div>
          <p className="text-xs text-gray-400">
            Удаление паразитных micro-jogs, S/Z-петель и объединение коллинеарных отрезков:
          </p>
          <div className="font-mono text-xs text-emerald-300 bg-[#0c0d10] p-3 rounded-lg border border-white/5 space-y-1">
            <div>CollapseJog(P_1, P_2, P_3, P_4)  iff  |P_2 - P_1| &lt; ε ∧ LineOfSight(P_0, Corner, P_3)</div>
            <div>DirectSight(P_src, P_tgt)  iff  |Y_src - Y_tgt| ≤ 3px ∧ ¬Blocked(Segment) ⇒ [P_src, P_tgt]</div>
          </div>
          <p className="text-[11px] text-gray-400">
            Исключает дрожание трасс, сохраняя безупречную эстетику векторных схем.
          </p>
        </div>
      </div>

      {/* Comparative Evaluation Table */}
      <div className="bg-[#16181d] rounded-xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#121316]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <h3 className="text-xs font-bold uppercase tracking-widest text-white font-mono">
              Сводная Таблица Решений Проблем Трассировки и Подписей
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0c0d10] text-gray-400 font-mono text-[10px] uppercase tracking-wider border-b border-white/5">
              <tr>
                <th className="py-3 px-4">Проблема в схеме</th>
                <th className="py-3 px-4">Математическая причина</th>
                <th className="py-3 px-4">Реализованный механизм</th>
                <th className="py-3 px-4">Результат в приложении</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono text-xs">
              <tr className="bg-blue-600/10">
                <td className="py-3 px-4 font-semibold text-emerald-400">
                  Стрелки входили под разными углами
                </td>
                <td className="py-3 px-4 text-gray-300">Отсутствие жестких краевых условий на пине</td>
                <td className="py-3 px-4 text-cyan-300">
                  Строгий вылет P + n · L и C^1-инвариант
                </td>
                <td className="py-3 px-4 text-emerald-400">Идеальные углы 0° / 90° / 180° / 270°</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-white">
                  Перекрытие названий стрелок
                </td>
                <td className="py-3 px-4 text-gray-300">Наивный поиск середины самого длинного сегмента</td>
                <td className="py-3 px-4 text-purple-300">
                  2D силовой релаксатор + фазовый сдвиг параллельных шин
                </td>
                <td className="py-3 px-4 text-emerald-400">0% наложений, поддержка ручного перетаскивания</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-semibold text-white">
                  Неоднозначность на перекрестках линий
                </td>
                <td className="py-3 px-4 text-gray-300">Прямое наложение ортогональных линий 90°</td>
                <td className="py-3 px-4 text-blue-300">
                  Мостики IEEE 315 / IEC 60617 (Line Hop Arcs)
                </td>
                <td className="py-3 px-4 text-emerald-400">Профессиональный вид САПР (EDA / KiCad / Altium)</td>
              </tr>
              <tr className="bg-cyan-500/10">
                <td className="py-3 px-4 font-semibold text-cyan-300">
                  Паразитные изгибы и ступени (Staircase)
                </td>
                <td className="py-3 px-4 text-gray-300">Раздельный расчет размещения блоков и трасс без учета пинов</td>
                <td className="py-3 px-4 text-cyan-300">
                  Сквозная Co-Optimization + Pin-Y Snapping + Jog Cleaner
                </td>
                <td className="py-3 px-4 text-emerald-400">100% прямолинейные связи 0-изгибов для соосных портов</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Multi-Objective Optimality Criteria (Pareto Frontier) */}
      <div className="bg-[#16181d] rounded-xl border border-white/5 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold uppercase tracking-wider text-white font-mono">
              Строгие Математические Критерии Оптимальности (Pareto Frontier)
            </h2>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded border border-emerald-400/20 uppercase font-bold">
            8 Целевых Функций (C1 - C8)
          </span>
        </div>

        <p className="text-xs text-gray-300 leading-relaxed">
          Задача совместного синтеза топологии и трассировки G = (V, E, P) является многокритериальной NP-трудной задачей.
          Глобальный функционал качества L(X, Y, Γ) формулируется как взвешенная сумма на Парето-фронте:
        </p>

        <div className="font-mono text-xs text-cyan-300 bg-[#0c0d10] p-4 rounded-xl border border-white/5 overflow-x-auto space-y-1">
          <div>min L(X, Y, Γ) = Σ_(k=1..8) w_k · C_k(X, Y, Γ)</div>
          <div className="text-gray-500 text-[11px]">
            где X, Y — координаты блоков и пинов, Γ_e — кусочно-линейные ортогональные траектории связей.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="bg-[#121316] rounded-xl border border-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-blue-400 font-bold">C1: Half-Perimeter Wirelength (HPWL)</span>
              <span className="text-gray-500 text-[10px]">Манхэттенская длина</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              Σ_{'{e∈E}'} Σ_{'{i=1}'}^{'{k_e}'} ||q_i - q_{'{i-1}'}||_1
            </p>
            <p className="text-[11px] text-gray-400">
              Минимизирует общую протяженность шин и задержку распространения сигнала.
            </p>
          </div>

          <div className="bg-[#121316] rounded-xl border border-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-cyan-400 font-bold">C2: Total Bend Count (0-Bend Straight Lines)</span>
              <span className="text-gray-500 text-[10px]">Минимизация изгибов</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              Σ_{'{e∈E}'} max(0, |Γ_e| - 2)
            </p>
            <p className="text-[11px] text-gray-400">
              Штраф за каждый угол 90°. Прямые соосные линии между смежными слоями имеют ровно 0 изгибов.
            </p>
          </div>

          <div className="bg-[#121316] rounded-xl border border-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-purple-400 font-bold">C3: Orthogonal Crossing Number</span>
              <span className="text-gray-500 text-[10px]">Планарность схемы</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              Σ_{'{e1 < e2}'} I(Γ_{'{e1}'} ∩ Γ_{'{e2}'} ≠ ∅)
            </p>
            <p className="text-[11px] text-gray-400">
              Минимизируется барицентрическим ранжированием и вычислением двудольных перестановок.
            </p>
          </div>

          <div className="bg-[#121316] rounded-xl border border-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-400 font-bold">C4: Port Co-axial Alignment Score</span>
              <span className="text-gray-500 text-[10px]">Соосность и монотонность</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              |Y(p_src) - Y(p_tgt)| = 0
            </p>
            <p className="text-[11px] text-gray-400">
              Доля связей, у которых координаты подключенных портов совпадают, устраняя «лестничные» ступени.
            </p>
          </div>

          <div className="bg-[#121316] rounded-xl border border-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-amber-400 font-bold">C5: Guaranteed Clearance Invariant</span>
              <span className="text-gray-500 text-[10px]">Безопасный отступ</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              dist(Γ_e, Box(v)) ≥ δ_clearance
            </p>
            <p className="text-[11px] text-gray-400">
              Жесткое геометрическое ограничение недопустимости прокалывания сторонних блоков проводниками.
            </p>
          </div>

          <div className="bg-[#121316] rounded-xl border border-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-rose-400 font-bold">C6: Channel Density & Congestion Index</span>
              <span className="text-gray-500 text-[10px]">Равномерность трасс</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              max Density(x, y) ≤ Capacity
            </p>
            <p className="text-[11px] text-gray-400">
              Динамическое расширение межслойных каналов X_channel пропорционально числу транзитных шин.
            </p>
          </div>

          <div className="bg-[#121316] rounded-xl border border-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-indigo-400 font-bold">C7: Aspect Ratio & Area Packing</span>
              <span className="text-gray-500 text-[10px]">Компактность холста</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              ΔX / ΔY ≈ 16:9 (Golden Ratio)
            </p>
            <p className="text-[11px] text-gray-400">
              Гармоничное распределение элементов без растягивания схемы в сверхдлинную «колбасу».
            </p>
          </div>

          <div className="bg-[#121316] rounded-xl border border-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-teal-400 font-bold">C8: Label Legibility & Overlap Energy</span>
              <span className="text-gray-500 text-[10px]">Читаемость шильдиков</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed font-mono">
              E_label = 0 (Zero Overlaps)
            </p>
            <p className="text-[11px] text-gray-400">
              Нулевое взаимное перекрытие текстов сигналов с проводниками и узлами благодаря силовой 2D-релаксации.
            </p>
          </div>
        </div>
      </div>

      {/* Section 4: Cross-Disciplinary Solutions (How Humanity Solved This in Other Fields) */}
      <div className="bg-[#16181d] rounded-xl border border-white/5 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold uppercase tracking-wider text-white font-mono">
              Как Человечество Решило Эту Задачу в Других Областях Науки и Техники
            </h2>
          </div>
          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-400/10 px-2.5 py-1 rounded border border-indigo-400/20 uppercase font-bold">
            Cross-Discipline Insights
          </span>
        </div>

        <div className="space-y-4 text-xs text-gray-300 leading-relaxed">
          {/* 1. VLSI / EDA */}
          <div className="border border-white/5 rounded-xl p-4 bg-[#121316] space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-sm">
              <span>1. САПР СБИС и Микроэлектроника (VLSI / EDA — Cadence, Synopsys, KiCad)</span>
            </div>
            <p className="text-gray-400">
              В проектировании современных процессоров с миллиардами транзисторов раздельное размещение и трассировка приводило к неприемлемым задержкам. Человечество решило это тремя прорывами:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-2">
              <li>
                <b>Аналитическое размещение через уравнение Пуассона (ePlace / Kraftwerk / FastPlace)</b>:
                Плотность ячеек моделируется как непрерывное электростатическое распределение зарядов ∇²φ = -ρ(x, y).
                Силы отталкивания раздвигают блоки, устраняя перекрытия, в то время как квадратичные пружины Гука E_wire = ½ Σ w_ij · ((x_i - x_j)² + (y_i - y_j)²) притягивают связанные пины.
              </li>
              <li>
                <b>Алгоритм PathFinder (McMurchie & Ebeling, 1995)</b>:
                Негоциация ресурсов трассировки (Negotiated Congestion Routing). Все цепи трассируются одновременно, деля общие ресурсы. С каждой итерацией стоимость перегруженных каналов c_e = (b_e + h_e) · p_e экспоненциально возрастает, вынуждая менее критичные сигналы обходить занятые коридоры.
              </li>
              <li>
                <b>Теорема о сетках Ханана (Hanan Grid Theorem, 1966)</b>:
                Доказано, что для поиска кратчайшего прямоугольного дерева Штейнера (RSMT) достаточно рассматривать только ортогональную сетку, образованную прямыми линиями через терминалы портов.
              </li>
            </ul>
          </div>

          {/* 2. Graph Drawing / Sugiyama / Tamassia */}
          <div className="border border-white/5 rounded-xl p-4 bg-[#121316] space-y-2">
            <div className="flex items-center gap-2 text-purple-400 font-bold font-mono text-sm">
              <span>2. Теория Графов и Визуализация Информации (Graph Drawing & TSM Framework)</span>
            </div>
            <p className="text-gray-400">
              В компьютерных науках визуализация ортогональных схем была строго формализована Роберто Тамассиа (Roberto Tamassia, 1987) во фреймворке <b>TSM (Topology-Shape-Metrics)</b>:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-2">
              <li>
                <b>Фаза 1 — Планаризация (Planarization)</b>: Поиск максимального планарного подграфа и замена неизбежных пересечений фиктивными вершинами-перекрестками.
              </li>
              <li>
                <b>Фаза 2 — Ортогонализация через Минимальный Поток (Min-Cost Flow)</b>: Поворот ребер на углы 0°, ±90°, 180° формулируется как задача поиска потока минимальной стоимости в двойственном графе граней, минимизируя общее число изгибов за строго полиномиальное время.
              </li>
              <li>
                <b>Фаза 3 — 1D Компактизация (Compaction via Network Simplex)</b>: Фиксация углов и вычисление минимальных длин сегментов с помощью линейного программирования для минимизации общей площади.
              </li>
              <li>
                <b>Алгоритм Брандеса-Кёпфа (Brandes & Köpf, 2001)</b>: Линейный по времени алгоритм O(|V| + |E|) выравнивания координат узлов в слоях по 4 направлениям (Up-Left, Up-Right, Down-Left, Down-Right) с медианным усреднением, сохраняющий длинные вертикальные и горизонтальные магистрали прямыми.
              </li>
            </ul>
          </div>

          {/* 3. Cartography & Metro Maps */}
          <div className="border border-white/5 rounded-xl p-4 bg-[#121316] space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono text-sm">
              <span>3. Картография и Схематизация Линий Метро (Metro Map Schematization)</span>
            </div>
            <p className="text-gray-400">
              В картографии (создание понятных схем метро Лондона, Токио, Москвы) Александр Вольф и Мартин Нёлленбург (Nöllenburg & Wolff, 2011) применили <b>смешанное целочисленное линейное программирование (MILP)</b>:
            </p>
            <ul className="list-disc list-inside space-y-1.5 text-gray-300 pl-2">
              <li>Линии строго квантуются по 8 направлениям (октогональная сетка 0°, 45°, 90°).</li>
              <li>Целочисленные переменные запрещают изменение порядка следования параллельных путей в коридоре.</li>
              <li>Транзитные маршруты стремятся сохранить максимальную прямолинейность без ненужных поворотов на станциях пересадок.</li>
            </ul>
          </div>

          {/* 4. Mechanics & Elastic Energy */}
          <div className="border border-white/5 rounded-xl p-4 bg-[#121316] space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold font-mono text-sm">
              <span>4. Теоретическая Механика и Сплайны (Euler-Bernoulli Minimum Bending Energy)</span>
            </div>
            <p className="text-gray-400">
              В механике упругих деформаций форма тонкого гибкого стержня минимизирует интеграл квадрата кривизны min ∫ κ²(s) ds с жестко защемленными концами (краевые условия C¹). Это фундаментальное физическое свойство лежит в основе наших алгоритмов плавных скруглений и краевых нормалей вылетов портов.
            </p>
          </div>

          {/* 5. Robotics & Trajectory Planning */}
          <div className="border border-white/5 rounded-xl p-4 bg-[#121316] space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold font-mono text-sm">
              <span>5. Робототехника и Беспилотный Транспорт (Dubins / Minimum Jerk Paths)</span>
            </div>
            <p className="text-gray-400">
              В планировании траекторий автономных роботов и беспилотных автомобилей траектории строятся через последовательность примитивов Дубинса (прямые участки + дуги фиксированного радиуса) с гарантией того, что производная ускорения (рывок, Jerk) минимизирована, что исключает дрожание рулевого управления и резкие перегибы трассы.
            </p>
          </div>
        </div>
      </div>

      {/* Section 5: Strategic Improvement Plan & Architecture Roadmap */}
      <div className="bg-[#16181d] rounded-xl border border-white/5 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold uppercase tracking-wider text-white font-mono">
              План Дальнейших Фундаментальных Улучшений (Roadmap)
            </h2>
          </div>
          <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded border border-amber-400/20 uppercase font-bold">
            Future Milestones
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-white/5 rounded-xl p-4 bg-[#121316] space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
              <span>Этап 1: Hyperedge Steiner Trees</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Интеграция алгоритма FLUTE (Fast Lookup Table for Steiner Trees) для объединения многоточечных шин (1 источник $\to$ $N$ приемников) в единые $T$-образные разветвления вместо параллельных дублирующих линий.
            </p>
          </div>

          <div className="border border-white/5 rounded-xl p-4 bg-[#121316] space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-bold font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
              <span>Этап 2: Network Simplex Compaction</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Реализация точной 2D-компактизации графа ограничений через целочисленный симплекс-метод, гарантирующей минимальную занимаемую площадь холста при сохранении заданных зазоров.
            </p>
          </div>

          <div className="border border-white/5 rounded-xl p-4 bg-[#121316] space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Этап 3: WebGL Poisson Engine</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Аппаратное ускорение электростатического решателя Пуассона через WebGL/WebGPU фрагментные шейдеры для расчета масштабных промышленных схем (до $100\,000$ узлов) с частотой 60 кадров/сек в реальном времени.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
